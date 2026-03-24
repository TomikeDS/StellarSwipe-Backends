export class UserMetricsResponseDto {
    totalUsers!: number;
    newUsersToday!: number;
    activeUsersToday!: number;
    dau!: number;
    mau!: number;
    dauMauRatio!: number;
    churnRate!: number;
}

export class TradingMetricsResponseDto {
    totalTrades!: number;
    tradesToday!: number;
    totalVolume!: number;
    volumeToday!: number;
    avgTradeSize!: number;
    successRate!: number;
}

export class RevenueMetricsResponseDto {
    totalRevenue!: number;
    revenueToday!: number;
    revenueBySource!: {
        tradingFees: number;
        subscriptions: number;
        premiumSignals: number;
    };
    mrr!: number;
    arr!: number;
}

export class CohortResponseDto {
    cohorts!: Array<{
        cohortWeek: string;
        usersAcquired: number;
        retention: Record<string, number>;
    }>;
}

export class FunnelResponseDto {
    funnels!: {
        onboarding: {
            steps: Array<{
                name: string;
                users: number;
                conversionRate: number;
            }>;
            overallConversion: number;
        };
    };
}
