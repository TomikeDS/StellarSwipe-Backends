import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';

import { Anomaly } from './entities/anomaly.entity';
import { FraudAlert, FraudAlertStatus, FraudAlertAction } from './entities/fraud-alert.entity';
import { Investigation, InvestigationStatus } from './entities/investigation.entity';
import { AnomalyCategory, AnomalySeverity } from './interfaces/anomaly-config.interface';
import { RiskCalculator } from './utils/risk-calculator';
import { FraudAlertDto, ResolveFraudAlertDto } from './dto/fraud-alert.dto';

/**
 * FraudAnalyzerService escalates raw Anomaly records into structured FraudAlerts
 * and groups related alerts into Investigations for compliance review.
 */
@Injectable()
export class FraudAnalyzerService {
  private readonly logger = new Logger(FraudAnalyzerService.name);

  // Severity → minimum ensemble score required to raise an alert
  private static readonly ESCALATION_THRESHOLDS: Record<AnomalySeverity, number> = {
    [AnomalySeverity.LOW]: 0.50,
    [AnomalySeverity.MEDIUM]: 0.65,
    [AnomalySeverity.HIGH]: 0.80,
    [AnomalySeverity.CRITICAL]: 0.92,
  };

  constructor(
    @InjectRepository(Anomaly)
    private readonly anomalyRepo: Repository<Anomaly>,
    @InjectRepository(FraudAlert)
    private readonly alertRepo: Repository<FraudAlert>,
    @InjectRepository(Investigation)
    private readonly investigationRepo: Repository<Investigation>,
  ) {}

  // ── Escalation ─────────────────────────────────────────────────────────────

  /**
   * Evaluates a newly persisted Anomaly and creates or updates a FraudAlert
   * if the severity warrants escalation.
   *
   * De-duplication: if an OPEN alert already exists for the same user and
   * category (created within 24 h), the anomaly is merged into it.
   */
  async escalateAnomaly(anomaly: Anomaly): Promise<FraudAlert | null> {
    if (anomaly.severity === null) return null;

    // Check for an existing open alert to merge into
    const existing = await this.alertRepo.findOne({
      where: {
        userId: anomaly.userId,
        category: anomaly.category,
        status: FraudAlertStatus.OPEN,
        createdAt: MoreThan(new Date(Date.now() - 24 * 3600 * 1000)),
      } as any,
    });

    if (existing) {
      return this.mergeIntoAlert(existing, anomaly);
    }

    return this.createAlert(anomaly);
  }

  /**
   * Bulk-escalates all unescalated anomalies for a user.
   * Called by the scan job after scanning a batch of users.
   */
  async escalatePendingAnomalies(userId: string): Promise<FraudAlert[]> {
    const unescalated = await this.anomalyRepo.find({
      where: {
        userId,
        fraudAlertId: null,
        isFalsePositive: false,
      },
    });

    const alerts: FraudAlert[] = [];
    for (const anomaly of unescalated) {
      const alert = await this.escalateAnomaly(anomaly);
      if (alert) alerts.push(alert);
    }

    return alerts;
  }

  // ── Alert management ───────────────────────────────────────────────────────

  async resolveAlert(alertId: string, dto: ResolveFraudAlertDto): Promise<FraudAlert> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException(`FraudAlert ${alertId} not found`);

    alert.status = dto.status;
    if (dto.action) alert.actionTaken = dto.action;
    if (dto.resolutionNote) alert.resolutionNote = dto.resolutionNote;
    if (dto.resolvedBy) alert.resolvedBy = dto.resolvedBy;
    alert.resolvedAt = new Date();

    if (dto.status === FraudAlertStatus.FALSE_POSITIVE) {
      await this.markAnomaliesAsFalsePositive(alert.anomalyIds, dto.resolvedBy);
    }

    const saved = await this.alertRepo.save(alert);
    this.logger.log(`FraudAlert ${alertId} resolved: ${dto.status} by ${dto.resolvedBy ?? 'system'}`);
    return saved;
  }

  async getOpenAlerts(options: {
    userId?: string;
    category?: AnomalyCategory;
    severity?: AnomalySeverity;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: FraudAlertDto[]; total: number }> {
    const where: Record<string, unknown> = { status: FraudAlertStatus.OPEN };
    if (options.userId) where.userId = options.userId;
    if (options.category) where.category = options.category;
    if (options.severity) where.severity = options.severity;

    const [alerts, total] = await this.alertRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });

    return { alerts: alerts.map(this.toAlertDto), total };
  }

  // ── Investigation management ───────────────────────────────────────────────

  /**
   * Scans for coordinated activity across users by finding multiple users
   * with CRITICAL alerts in the same category within a time window.
   * Creates or updates an Investigation grouping them.
   */
  async detectCoordinatedActivity(windowHours = 6): Promise<Investigation[]> {
    const cutoff = new Date(Date.now() - windowHours * 3600 * 1000);

    const criticalAlerts = await this.alertRepo.find({
      where: {
        severity: AnomalySeverity.CRITICAL,
        status: In([FraudAlertStatus.OPEN, FraudAlertStatus.UNDER_REVIEW]),
        createdAt: MoreThan(cutoff),
      } as any,
    });

    // Group by category
    const byCategory = new Map<AnomalyCategory, FraudAlert[]>();
    for (const alert of criticalAlerts) {
      const list = byCategory.get(alert.category) ?? [];
      list.push(alert);
      byCategory.set(alert.category, list);
    }

    const investigations: Investigation[] = [];

    for (const [category, alerts] of byCategory.entries()) {
      const userIds = [...new Set(alerts.map((a) => a.userId))];
      if (userIds.length < 2) continue; // Need at least 2 users

      const investigation = await this.upsertInvestigation(
        userIds,
        category,
        alerts,
      );
      investigations.push(investigation);
    }

    return investigations;
  }

  async getInvestigation(id: string): Promise<Investigation> {
    const inv = await this.investigationRepo.findOne({ where: { id } });
    if (!inv) throw new NotFoundException(`Investigation ${id} not found`);
    return inv;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async createAlert(anomaly: Anomaly): Promise<FraudAlert> {
    const washRiskLevel = anomaly.category === AnomalyCategory.WASH_TRADING
      ? RiskCalculator.washTradingRiskLevel(
          (anomaly.featureContributions?.washTradingScore ?? 0),
          (anomaly.evidence as any)?.tradeCount ?? 0,
          parseFloat((anomaly.evidence as any)?.totalValueUsd ?? '0'),
        )
      : null;

    const effectiveSeverity = washRiskLevel ?? anomaly.severity;
    const riskScore = Math.round(anomaly.ensembleScore * 100);

    const alert = this.alertRepo.create({
      userId: anomaly.userId,
      category: anomaly.category,
      severity: effectiveSeverity,
      status: FraudAlertStatus.OPEN,
      actionTaken: FraudAlertAction.NONE,
      riskScore,
      title: this.buildAlertTitle(anomaly.category, effectiveSeverity),
      description: anomaly.description,
      anomalyIds: [anomaly.id],
      evidence: anomaly.evidence,
      totalValueUsd: null,
      investigationId: null,
      assignedTo: null,
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      notificationSent: false,
    });

    const saved = await this.alertRepo.save(alert);

    // Link anomaly → alert
    await this.anomalyRepo.update(anomaly.id, { fraudAlertId: saved.id });

    this.logger.log(
      `FraudAlert created: ${saved.id} [${effectiveSeverity}] for user ${anomaly.userId}`,
    );
    return saved;
  }

  private async mergeIntoAlert(alert: FraudAlert, anomaly: Anomaly): Promise<FraudAlert> {
    alert.anomalyIds = [...alert.anomalyIds, anomaly.id];

    // Escalate severity if new anomaly is worse
    if (this.compareSeverity(anomaly.severity, alert.severity) > 0) {
      alert.severity = anomaly.severity;
    }

    // Update risk score to the higher value
    const newScore = Math.round(anomaly.ensembleScore * 100);
    if (newScore > alert.riskScore) alert.riskScore = newScore;

    const saved = await this.alertRepo.save(alert);
    await this.anomalyRepo.update(anomaly.id, { fraudAlertId: saved.id });

    this.logger.log(`Anomaly ${anomaly.id} merged into existing FraudAlert ${alert.id}`);
    return saved;
  }

  private async upsertInvestigation(
    userIds: string[],
    category: AnomalyCategory,
    alerts: FraudAlert[],
  ): Promise<Investigation> {
    const primaryUserId = userIds[0];
    const alertIds = alerts.map((a) => a.id);

    const existing = await this.investigationRepo.findOne({
      where: {
        primaryUserId,
        status: In([InvestigationStatus.OPEN, InvestigationStatus.IN_PROGRESS]),
      },
    });

    if (existing) {
      existing.relatedUserIds = [...new Set([...existing.relatedUserIds, ...userIds.slice(1)])];
      existing.alertIds = [...new Set([...existing.alertIds, ...alertIds])];
      existing.riskScore = Math.max(existing.riskScore, ...alerts.map((a) => a.riskScore));
      existing.timeline.push({
        at: new Date().toISOString(),
        actor: 'system',
        action: 'coordinated_activity_detected',
        note: `${userIds.length} users flagged for ${category}`,
      });
      return this.investigationRepo.save(existing);
    }

    const inv = this.investigationRepo.create({
      primaryUserId,
      relatedUserIds: userIds.slice(1),
      status: InvestigationStatus.OPEN,
      severity: AnomalySeverity.CRITICAL,
      title: `Coordinated ${category.replace(/_/g, ' ').toLowerCase()} investigation`,
      summary: null,
      alertIds,
      riskScore: Math.max(...alerts.map((a) => a.riskScore)),
      timeline: [
        {
          at: new Date().toISOString(),
          actor: 'system',
          action: 'investigation_created',
          note: `${userIds.length} users flagged for coordinated ${category}`,
        },
      ],
      assignedTo: null,
      closedBy: null,
      closedAt: null,
      referralReference: null,
      metadata: { category, detectedUserIds: userIds },
    });

    const saved = await this.investigationRepo.save(inv);

    // Link alerts to investigation
    await this.alertRepo.update(alertIds, { investigationId: saved.id });

    this.logger.log(
      `Investigation created: ${saved.id} — ${userIds.length} users, category=${category}`,
    );
    return saved;
  }

  private async markAnomaliesAsFalsePositive(
    anomalyIds: string[],
    reviewedBy?: string,
  ): Promise<void> {
    if (anomalyIds.length === 0) return;
    await this.anomalyRepo.update(anomalyIds, {
      isFalsePositive: true,
      reviewedBy: reviewedBy ?? null,
      reviewedAt: new Date(),
    });
  }

  private buildAlertTitle(category: AnomalyCategory, severity: AnomalySeverity): string {
    const cat = category.replace(/_/g, ' ').toLowerCase();
    return `[${severity}] Detected ${cat}`;
  }

  private compareSeverity(a: AnomalySeverity, b: AnomalySeverity): number {
    const ORDER: Record<AnomalySeverity, number> = {
      [AnomalySeverity.LOW]: 0,
      [AnomalySeverity.MEDIUM]: 1,
      [AnomalySeverity.HIGH]: 2,
      [AnomalySeverity.CRITICAL]: 3,
    };
    return ORDER[a] - ORDER[b];
  }

  private toAlertDto(alert: FraudAlert): FraudAlertDto {
    return {
      alertId: alert.id,
      userId: alert.userId,
      category: alert.category,
      severity: alert.severity,
      status: alert.status,
      actionTaken: alert.actionTaken,
      riskScore: alert.riskScore,
      title: alert.title,
      description: alert.description,
      anomalyIds: alert.anomalyIds,
      totalValueUsd: alert.totalValueUsd ?? undefined,
      investigationId: alert.investigationId ?? undefined,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }
}
