import { Injectable } from '@nestjs/common';
import { CohortAnalysisService } from './services/cohort-analysis.service';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';
import { UserBehaviorService } from './services/user-behavior.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Parser } from 'json2csv';

@Injectable()
export class AdminAnalyticsService {
    constructor(
        private readonly cohortAnalysisService: CohortAnalysisService,
        private readonly revenueAnalyticsService: RevenueAnalyticsService,
        private readonly userBehaviorService: UserBehaviorService,
    ) { }

    async getOverview(query: AnalyticsQueryDto) {
        const [userMetrics, tradingMetrics, revenueMetrics] = await Promise.all([
            this.userBehaviorService.getUserMetrics(query),
            this.userBehaviorService.getTradingMetrics(query),
            this.revenueAnalyticsService.getRevenueMetrics(query),
        ]);

        return {
            userMetrics,
            tradingMetrics,
            revenueMetrics,
        };
    }

    async getUserMetrics(query: AnalyticsQueryDto) {
        return this.userBehaviorService.getUserMetrics(query);
    }

    async getTradingMetrics(query: AnalyticsQueryDto) {
        return this.userBehaviorService.getTradingMetrics(query);
    }

    async getRevenueMetrics(query: AnalyticsQueryDto) {
        return this.revenueAnalyticsService.getRevenueMetrics(query);
    }

    async getCohorts(query: AnalyticsQueryDto) {
        return this.cohortAnalysisService.calculateCohortRetention(query);
    }

    async getFunnels(query: AnalyticsQueryDto) {
        return this.userBehaviorService.getFunnelAnalysis(query);
    }

    async exportData(query: AnalyticsQueryDto) {
        const overview = await this.getOverview(query);

        // Flatten data for CSV
        const data = [
            { MetricType: 'User', MetricName: 'Total Users', Value: overview.userMetrics.totalUsers },
            { MetricType: 'User', MetricName: 'New Users Today', Value: overview.userMetrics.newUsersToday },
            { MetricType: 'User', MetricName: 'DAU', Value: overview.userMetrics.dau },
            { MetricType: 'User', MetricName: 'MAU', Value: overview.userMetrics.mau },
            { MetricType: 'Trading', MetricName: 'Total Trades', Value: overview.tradingMetrics.totalTrades },
            { MetricType: 'Trading', MetricName: 'Total Volume', Value: overview.tradingMetrics.totalVolume },
            { MetricType: 'Revenue', MetricName: 'Total Revenue', Value: overview.revenueMetrics.totalRevenue },
            { MetricType: 'Revenue', MetricName: 'MRR', Value: overview.revenueMetrics.mrr },
        ];

        const parser = new Parser();
        const csv = parser.parse(data);
        return csv;
    }
}
