import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import { Trade, TradeStatus } from '../../../trades/entities/trade.entity';
import { TradingAnomalyDetectorService } from '../anomaly-detector.service';
import { FraudAnalyzerService } from '../fraud-analyzer.service';
import { Anomaly } from '../entities/anomaly.entity';

const SCAN_WINDOW_HOURS = 24;   // Users with trades in last 24h are eligible
const BATCH_SIZE = 50;          // Users processed per batch

/**
 * ScanForAnomaliesJob runs on a recurring schedule to check all recently
 * active users for anomalous trading behaviour.
 *
 * Schedule:
 *  - Full scan: every 6 hours (catches prolonged patterns)
 *  - Retrain:   every Sunday at 02:00 UTC
 */
@Injectable()
export class ScanForAnomaliesJob {
  private readonly logger = new Logger(ScanForAnomaliesJob.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(Anomaly)
    private readonly anomalyRepo: Repository<Anomaly>,
    private readonly detectorService: TradingAnomalyDetectorService,
    private readonly fraudAnalyzer: FraudAnalyzerService,
  ) {}

  // ── Cron jobs ──────────────────────────────────────────────────────────────

  /** Full anomaly scan — every 6 hours */
  @Cron('0 */6 * * *')
  async runFullScan(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Anomaly scan already running, skipping');
      return;
    }

    this.isRunning = true;
    const start = Date.now();
    this.logger.log('Starting full anomaly scan…');

    try {
      const userIds = await this.getActiveUserIds();
      this.logger.log(`Scanning ${userIds.length} active users`);

      let totalAnomalies = 0;
      let totalAlerts = 0;

      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const { anomalies, alerts } = await this.processBatch(batch);
        totalAnomalies += anomalies;
        totalAlerts += alerts;
      }

      // Detect coordinated activity across users
      const investigations = await this.fraudAnalyzer.detectCoordinatedActivity(6);

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      this.logger.log(
        `Scan complete: ${userIds.length} users, ` +
          `${totalAnomalies} anomalies, ${totalAlerts} alerts, ` +
          `${investigations.length} investigations — ${elapsed}s`,
      );
    } catch (err) {
      this.logger.error('Anomaly scan failed', (err as Error).stack);
    } finally {
      this.isRunning = false;
    }
  }

  /** Weekly full model retrain — Sunday at 02:00 UTC */
  @Cron('0 2 * * 0')
  async retrainModels(): Promise<void> {
    this.logger.log('Starting weekly anomaly detector retrain…');
    try {
      await this.detectorService.trainModels();
      this.logger.log('Weekly retrain complete');
    } catch (err) {
      this.logger.error('Weekly retrain failed', (err as Error).stack);
    }
  }

  /** Quick scan of high-risk users — every hour */
  @Cron(CronExpression.EVERY_HOUR)
  async runHighRiskScan(): Promise<void> {
    try {
      // Re-scan users with recent open alerts for rapid escalation
      const recentAnomalyUsers = await this.anomalyRepo
        .createQueryBuilder('a')
        .select('DISTINCT a.user_id', 'userId')
        .where('a.detected_at > :cutoff', {
          cutoff: new Date(Date.now() - 3600 * 1000 * 2), // last 2h
        })
        .andWhere('a.fraud_alert_id IS NULL')
        .andWhere('a.is_false_positive = false')
        .getRawMany<{ userId: string }>();

      if (recentAnomalyUsers.length === 0) return;

      this.logger.log(`High-risk re-scan: ${recentAnomalyUsers.length} users`);
      const ids = recentAnomalyUsers.map((r) => r.userId);

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        await this.processBatch(ids.slice(i, i + BATCH_SIZE));
      }
    } catch (err) {
      this.logger.error('High-risk scan failed', (err as Error).stack);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getActiveUserIds(): Promise<string[]> {
    const cutoff = new Date(Date.now() - SCAN_WINDOW_HOURS * 3600 * 1000);
    const rows = await this.tradeRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.user_id', 'userId')
      .where('t.created_at > :cutoff', { cutoff })
      .andWhere('t.status IN (:...statuses)', {
        statuses: [TradeStatus.SETTLED, TradeStatus.COMPLETED, TradeStatus.FAILED],
      })
      .getRawMany<{ userId: string }>();

    return rows.map((r) => r.userId);
  }

  private async processBatch(
    userIds: string[],
  ): Promise<{ anomalies: number; alerts: number }> {
    let anomalies = 0;
    let alerts = 0;

    for (const userId of userIds) {
      try {
        const detected = await this.detectorService.scanUser(userId);
        anomalies += detected.length;

        if (detected.length > 0) {
          const escalated = await this.fraudAnalyzer.escalatePendingAnomalies(userId);
          alerts += escalated.length;
        }
      } catch (err) {
        this.logger.warn(`Scan failed for user ${userId}: ${(err as Error).message}`);
      }
    }

    return { anomalies, alerts };
  }
}
