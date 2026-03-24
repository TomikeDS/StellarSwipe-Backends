import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import {
  SuspiciousActivity,
  SuspiciousActivityStatus,
  SuspiciousActivityReason,
} from './entities/suspicious-activity.entity';
import { PatternDetectionService } from './pattern-detection.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SarReport {
  sarId: string;
  userId: string;
  generatedAt: Date;
  reason: SuspiciousActivityReason;
  riskScore: number;
  description: string;
  totalValueUsd: string;
  evidence: Record<string, unknown>;
  relatedTradeIds: string[];
  status: SuspiciousActivityStatus;
}

export interface AmlScanSummary {
  userId: string;
  scannedAt: Date;
  patternsDetected: number;
  activitiesCreated: number;
  highestRiskScore: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AmlMonitoringService {
  private readonly logger = new Logger(AmlMonitoringService.name);

  constructor(
    @InjectRepository(SuspiciousActivity)
    private readonly suspiciousActivityRepo: Repository<SuspiciousActivity>,
    private readonly patternDetection: PatternDetectionService,
  ) {}

  // ─── Scanning ───────────────────────────────────────────────────────────────

  /**
   * Run a full AML scan for a single user.
   * Detects patterns, deduplicates against recent open flags, and persists new
   * SuspiciousActivity records. Returns a summary of what was found.
   */
  async scanUser(userId: string): Promise<AmlScanSummary> {
    const scannedAt = new Date();
    this.logger.debug(`AML scan started for user ${userId}`);

    const patterns = await this.patternDetection.detectForUser(userId);

    if (patterns.length === 0) {
      return {
        userId,
        scannedAt,
        patternsDetected: 0,
        activitiesCreated: 0,
        highestRiskScore: 0,
      };
    }

    let activitiesCreated = 0;

    for (const pattern of patterns) {
      // Deduplicate: skip if an OPEN/UNDER_REVIEW flag for same user+reason
      // already exists within the last 24 hours to avoid alert storms.
      const existing = await this.suspiciousActivityRepo.findOne({
        where: {
          userId,
          reason: pattern.reason,
          status: SuspiciousActivityStatus.OPEN,
          createdAt: Between(
            new Date(scannedAt.getTime() - 24 * 60 * 60 * 1000),
            scannedAt,
          ),
        },
      });

      if (existing) {
        this.logger.debug(
          `Skipping duplicate ${pattern.reason} flag for user ${userId}`,
        );
        continue;
      }

      await this.suspiciousActivityRepo.save(
        this.suspiciousActivityRepo.create({
          userId,
          reason: pattern.reason,
          riskScore: pattern.riskScore,
          description: pattern.description,
          evidence: pattern.evidence,
          relatedTradeIds: pattern.relatedTradeIds,
          totalValueUsd: pattern.totalValueUsd.toFixed(2),
          status: SuspiciousActivityStatus.OPEN,
        }),
      );

      activitiesCreated++;

      this.logger.warn(
        `AML flag: user=${userId} reason=${pattern.reason} score=${pattern.riskScore} value=$${pattern.totalValueUsd.toFixed(2)}`,
      );
    }

    const highestRiskScore = Math.max(...patterns.map((p) => p.riskScore));

    return {
      userId,
      scannedAt,
      patternsDetected: patterns.length,
      activitiesCreated,
      highestRiskScore,
    };
  }

  // ─── SAR Generation ─────────────────────────────────────────────────────────

  /**
   * Generate a Suspicious Activity Report for a flagged activity record.
   * Marks the record as SAR_FILED and stamps a reference number.
   */
  async generateSar(activityId: string): Promise<SarReport> {
    const activity = await this.suspiciousActivityRepo.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException(
        `Suspicious activity ${activityId} not found.`,
      );
    }

    if (activity.status === SuspiciousActivityStatus.SAR_FILED) {
      throw new BadRequestException(
        `SAR already filed for activity ${activityId} (ref: ${activity.sarReference}).`,
      );
    }

    if (activity.status === SuspiciousActivityStatus.DISMISSED) {
      throw new BadRequestException(
        `Cannot file SAR for a dismissed activity.`,
      );
    }

    // Generate a reference number: SAR-YYYYMMDD-<short uuid>
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sarReference = `SAR-${datePart}-${activity.id.slice(0, 8).toUpperCase()}`;

    activity.status = SuspiciousActivityStatus.SAR_FILED;
    activity.sarReference = sarReference;
    await this.suspiciousActivityRepo.save(activity);

    this.logger.warn(
      `SAR filed: ref=${sarReference} user=${activity.userId} reason=${activity.reason}`,
    );

    return this.toSarReport(activity);
  }

  /**
   * Auto-file SARs for all OPEN activities above a given risk score threshold.
   * Intended to be called by the scheduled AML scan job.
   */
  async autoFileSarsAboveThreshold(
    riskScoreThreshold: number = 80,
  ): Promise<SarReport[]> {
    const activities = await this.suspiciousActivityRepo
      .createQueryBuilder('sa')
      .where('sa.status = :status', {
        status: SuspiciousActivityStatus.OPEN,
      })
      .andWhere('sa.risk_score >= :threshold', {
        threshold: riskScoreThreshold,
      })
      .getMany();

    const reports: SarReport[] = [];

    for (const activity of activities) {
      try {
        reports.push(await this.generateSar(activity.id));
      } catch (err) {
        this.logger.error(
          `Failed to auto-file SAR for ${activity.id}: ${(err as Error).message}`,
        );
      }
    }

    return reports;
  }

  // ─── Review / Status Management ─────────────────────────────────────────────

  async updateStatus(
    activityId: string,
    status: SuspiciousActivityStatus,
    reviewedBy: string,
    reviewNotes?: string,
  ): Promise<SuspiciousActivity> {
    const activity = await this.suspiciousActivityRepo.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} not found.`);
    }

    activity.status = status;
    activity.reviewedBy = reviewedBy;
    activity.reviewedAt = new Date();
    if (reviewNotes) activity.reviewNotes = reviewNotes;

    return this.suspiciousActivityRepo.save(activity);
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async findAll(filters: {
    status?: SuspiciousActivityStatus;
    userId?: string;
    reason?: SuspiciousActivityReason;
    fromDate?: Date;
    toDate?: Date;
    minRiskScore?: number;
  }): Promise<SuspiciousActivity[]> {
    const qb = this.suspiciousActivityRepo
      .createQueryBuilder('sa')
      .orderBy('sa.created_at', 'DESC');

    if (filters.status) {
      qb.andWhere('sa.status = :status', { status: filters.status });
    }
    if (filters.userId) {
      qb.andWhere('sa.user_id = :userId', { userId: filters.userId });
    }
    if (filters.reason) {
      qb.andWhere('sa.reason = :reason', { reason: filters.reason });
    }
    if (filters.fromDate) {
      qb.andWhere('sa.created_at >= :fromDate', { fromDate: filters.fromDate });
    }
    if (filters.toDate) {
      qb.andWhere('sa.created_at <= :toDate', { toDate: filters.toDate });
    }
    if (filters.minRiskScore !== undefined) {
      qb.andWhere('sa.risk_score >= :minRiskScore', {
        minRiskScore: filters.minRiskScore,
      });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<SuspiciousActivity> {
    const activity = await this.suspiciousActivityRepo.findOne({
      where: { id },
    });
    if (!activity) throw new NotFoundException(`Activity ${id} not found.`);
    return activity;
  }

  async getUserRiskScore(userId: string): Promise<number> {
    const openActivities = await this.suspiciousActivityRepo.find({
      where: {
        userId,
        status: SuspiciousActivityStatus.OPEN,
      },
    });

    if (openActivities.length === 0) return 0;

    // Composite score: average of open flags, weighted by recency
    const now = Date.now();
    const weightedScores = openActivities.map((a) => {
      const ageHours = (now - a.createdAt.getTime()) / (1000 * 60 * 60);
      const decayFactor = Math.max(0.1, 1 - ageHours / (24 * 7)); // decay over 7 days
      return a.riskScore * decayFactor;
    });

    return Math.min(
      100,
      Math.round(
        weightedScores.reduce((s, v) => s + v, 0) / weightedScores.length,
      ),
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toSarReport(activity: SuspiciousActivity): SarReport {
    return {
      sarId: activity.id,
      userId: activity.userId,
      generatedAt: activity.updatedAt,
      reason: activity.reason,
      riskScore: activity.riskScore,
      description: activity.description,
      totalValueUsd: activity.totalValueUsd ?? '0',
      evidence: activity.evidence,
      relatedTradeIds: activity.relatedTradeIds ?? [],
      status: activity.status,
    };
  }
}
