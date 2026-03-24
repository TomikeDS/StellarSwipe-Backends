export class SignalDto {
    readonly id: string;
    readonly providerId: string;
    readonly description: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly performanceMetrics: {
        winRate: number;
        totalSignals: number;
        averagePnL: number;
    };
}