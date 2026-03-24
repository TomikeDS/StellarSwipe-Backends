import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FeeTransaction, FeeStatus } from '../../../fee_management/entities/fee-transaction.entity';
import { UserSubscription, SubscriptionStatus, PaymentStatus } from '../../../subscriptions/entities/user-subscription.entity';
import { RevenueMetricsResponseDto } from '../dto/analytics-response.dto';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';

@Injectable()
export class RevenueAnalyticsService {
    constructor(
        @InjectRepository(FeeTransaction)
        private feeTxRepository: Repository<FeeTransaction>,
        @InjectRepository(UserSubscription)
        private subscriptionRepository: Repository<UserSubscription>,
    ) { }

    async getRevenueMetrics(query?: AnalyticsQueryDto): Promise<RevenueMetricsResponseDto> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { sum: totalTradingFees } = await this.feeTxRepository
            .createQueryBuilder('fee')
            .where('fee.status = :status', { status: FeeStatus.COLLECTED })
            .select('SUM(fee.feeAmount)', 'sum')
            .getRawOne();

        const { sum: todayTradingFees } = await this.feeTxRepository
            .createQueryBuilder('fee')
            .where('fee.status = :status AND fee.collectedAt >= :today', { status: FeeStatus.COLLECTED, today })
            .select('SUM(fee.feeAmount)', 'sum')
            .getRawOne();

        const { sum: totalSubs } = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .where('sub.paymentStatus = :status', { status: PaymentStatus.COMPLETED })
            .select('SUM(sub.platformCommission)', 'sum')
            .getRawOne();

        const { sum: todaySubs } = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .where('sub.paymentStatus = :status AND sub.updatedAt >= :today', { status: PaymentStatus.COMPLETED, today })
            .select('SUM(sub.platformCommission)', 'sum')
            .getRawOne();

        // Default premium signals to 0 until properly modelled
        const premiumSignalsEarnings = 0;

        // MRR configuration: active subs Monthly sum
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { sum: monthlySubs } = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .where('sub.paymentStatus = :status AND sub.updatedAt >= :thirtyDaysAgo', { status: PaymentStatus.COMPLETED, thirtyDaysAgo })
            .select('SUM(sub.platformCommission)', 'sum')
            .getRawOne();

        const mrr = Number(monthlySubs) || 0;
        const arr = mrr * 12;

        const tradingFeesSum = Number(totalTradingFees) || 0;
        const subscriptionsSum = Number(totalSubs) || 0;
        const todayTrading = Number(todayTradingFees) || 0;
        const todaySubsNum = Number(todaySubs) || 0;

        return {
            totalRevenue: tradingFeesSum + subscriptionsSum + premiumSignalsEarnings,
            revenueToday: todayTrading + todaySubsNum,
            revenueBySource: {
                tradingFees: tradingFeesSum,
                subscriptions: subscriptionsSum,
                premiumSignals: premiumSignalsEarnings,
            },
            mrr: mrr,
            arr: arr,
        };
    }
}
