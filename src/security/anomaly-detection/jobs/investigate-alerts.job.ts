import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';

import { FraudAlert, FraudAlertStatus, FraudAlertAction } from '../entities/fraud-alert.entity';
import { Investigation, InvestigationStatus, InvestigationTimelineEntry } from '../entities/investigation.entity';
import { AnomalySeverity } from '../interfaces/anomaly-config.interface';

// Alerts older than this without review → auto-escalate
const CRITICAL_ESCALATION_HOURS = 4;
const HIGH_ESCALATION_HOURS = 24;
const STALE_ALERT_DAYS = 7;

/**
 * InvestigateAlertsJob performs automated triage on open fraud alerts:
 *
 *  - Auto-escalates CRITICAL/HIGH alerts that have not been reviewed
 *  - Closes stale LOW alerts with no evidence of ongoing activity
 *  - Updates investigation risk scores from constituent alert scores
 *  - Generates a daily summary log of the alert queue
 */
@Injectable()
export class InvestigateAlertsJob {
  private readonly logger = new Logger(InvestigateAlertsJob.name);

  constructor(
    @InjectRepository(FraudAlert)
    private readonly alertRepo: Repository<FraudAlert>,
    @InjectRepository(Investigation)
    private readonly investigationRepo: Repository<Investigation>,
  ) {}

  // ── Cron jobs ──────────────────────────────────────────────────────────────

  /** Auto-escalation check — every 30 minutes */
  @Cron('*/30 * * * *')
  async runEscalationCheck(): Promise<void> {
    try {
      const escalated = await this.autoEscalateCriticalAlerts();
      if (escalated > 0) {
        this.logger.warn(`Auto-escalated ${escalated} unreviewed critical/high alerts`);
      }
    } catch (err) {
      this.logger.error('Escalation check failed', (err as Error).stack);
    }
  }

  /** Stale alert cleanup — every day at 03:00 UTC */
  @Cron('0 3 * * *')
  async runStaleAlertCleanup(): Promise<void> {
    try {
      const closed = await this.closeStaleAlerts();
      this.logger.log(`Stale alert cleanup: closed ${closed} LOW alerts`);
    } catch (err) {
      this.logger.error('Stale alert cleanup failed', (err as Error).stack);
    }
  }

  /** Update investigation risk scores — every hour */
  @Cron(CronExpression.EVERY_HOUR)
  async updateInvestigationScores(): Promise<void> {
    try {
      const updated = await this.recomputeInvestigationScores();
      this.logger.debug(`Updated risk scores for ${updated} investigations`);
    } catch (err) {
      this.logger.error('Investigation score update failed', (err as Error).stack);
    }
  }

  /** Daily alert queue report — every day at 08:00 UTC */
  @Cron('0 8 * * *')
  async generateDailyReport(): Promise<void> {
    try {
      await this.logDailyQueueReport();
    } catch (err) {
      this.logger.error('Daily report generation failed', (err as Error).stack);
    }
  }

  // ── Auto-escalation ────────────────────────────────────────────────────────

  private async autoEscalateCriticalAlerts(): Promise<number> {
    let count = 0;

    // CRITICAL alerts unreviewed for > CRITICAL_ESCALATION_HOURS
    const criticalCutoff = new Date(Date.now() - CRITICAL_ESCALATION_HOURS * 3600 * 1000);
    const criticalAlerts = await this.alertRepo.find({
      where: {
        severity: AnomalySeverity.CRITICAL,
        status: FraudAlertStatus.OPEN,
        createdAt: LessThan(criticalCutoff),
      } as any,
    });

    for (const alert of criticalAlerts) {
      alert.status = FraudAlertStatus.UNDER_REVIEW;
      alert.actionTaken = FraudAlertAction.ACCOUNT_FLAGGED;
      await this.alertRepo.save(alert);
      count++;
      this.logger.warn(
        `Auto-flagged account for unreviewed CRITICAL alert: userId=${alert.userId}, alertId=${alert.id}`,
      );
    }

    // HIGH alerts unreviewed for > HIGH_ESCALATION_HOURS
    const highCutoff = new Date(Date.now() - HIGH_ESCALATION_HOURS * 3600 * 1000);
    const highAlerts = await this.alertRepo.find({
      where: {
        severity: AnomalySeverity.HIGH,
        status: FraudAlertStatus.OPEN,
        createdAt: LessThan(highCutoff),
      } as any,
    });

    for (const alert of highAlerts) {
      alert.status = FraudAlertStatus.UNDER_REVIEW;
      await this.alertRepo.save(alert);
      count++;
    }

    return count;
  }

  // ── Stale alert cleanup ────────────────────────────────────────────────────

  private async closeStaleAlerts(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_ALERT_DAYS * 24 * 3600 * 1000);

    const stale = await this.alertRepo.find({
      where: {
        severity: In([AnomalySeverity.LOW, AnomalySeverity.MEDIUM]),
        status: FraudAlertStatus.OPEN,
        createdAt: LessThan(cutoff),
      } as any,
    });

    if (stale.length === 0) return 0;

    for (const alert of stale) {
      alert.status = FraudAlertStatus.DISMISSED;
      alert.resolutionNote = 'Auto-dismissed: no further activity detected within 7 days';
      alert.resolvedAt = new Date();
    }

    await this.alertRepo.save(stale);
    return stale.length;
  }

  // ── Investigation score updates ────────────────────────────────────────────

  private async recomputeInvestigationScores(): Promise<number> {
    const openInvestigations = await this.investigationRepo.find({
      where: {
        status: In([InvestigationStatus.OPEN, InvestigationStatus.IN_PROGRESS]),
      },
    });

    if (openInvestigations.length === 0) return 0;

    for (const inv of openInvestigations) {
      if (inv.alertIds.length === 0) continue;

      const alerts = await this.alertRepo.find({
        where: { id: In(inv.alertIds) },
        select: ['id', 'riskScore', 'status'],
      });

      const maxScore = Math.max(...alerts.map((a) => a.riskScore));
      const allResolved = alerts.every((a) =>
        [
          FraudAlertStatus.DISMISSED,
          FraudAlertStatus.FALSE_POSITIVE,
          FraudAlertStatus.CONFIRMED,
        ].includes(a.status),
      );

      inv.riskScore = maxScore;

      if (allResolved) {
        const allConfirmed = alerts.every((a) => a.status === FraudAlertStatus.CONFIRMED);
        inv.status = allConfirmed
          ? InvestigationStatus.CLOSED_CONFIRMED
          : InvestigationStatus.CLOSED_CLEARED;

        inv.closedAt = new Date();
        const entry: InvestigationTimelineEntry = {
          at: new Date().toISOString(),
          actor: 'system',
          action: 'auto_closed',
          note: `All ${alerts.length} constituent alerts resolved`,
        };
        inv.timeline = [...inv.timeline, entry];
      }
    }

    await this.investigationRepo.save(openInvestigations);
    return openInvestigations.length;
  }

  // ── Reporting ──────────────────────────────────────────────────────────────

  private async logDailyQueueReport(): Promise<void> {
    const [open, underReview, escalated] = await Promise.all([
      this.alertRepo.count({ where: { status: FraudAlertStatus.OPEN } }),
      this.alertRepo.count({ where: { status: FraudAlertStatus.UNDER_REVIEW } }),
      this.alertRepo.count({ where: { status: FraudAlertStatus.ESCALATED } }),
    ]);

    const [critOpen, highOpen] = await Promise.all([
      this.alertRepo.count({
        where: { severity: AnomalySeverity.CRITICAL, status: FraudAlertStatus.OPEN },
      }),
      this.alertRepo.count({
        where: { severity: AnomalySeverity.HIGH, status: FraudAlertStatus.OPEN },
      }),
    ]);

    const openInvestigations = await this.investigationRepo.count({
      where: { status: In([InvestigationStatus.OPEN, InvestigationStatus.IN_PROGRESS]) },
    });

    this.logger.log(
      `[Daily Alert Report] ` +
        `Open: ${open} (CRITICAL: ${critOpen}, HIGH: ${highOpen}) | ` +
        `Under Review: ${underReview} | ` +
        `Escalated: ${escalated} | ` +
        `Open Investigations: ${openInvestigations}`,
    );
  }
}
