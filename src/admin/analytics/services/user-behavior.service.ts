import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { Session } from '../../../users/entities/session.entity';
import { Trade, TradeStatus } from '../../../trades/entities/trade.entity';
import { UserEvent, UserEventType } from '../../../analytics/entities/user-event.entity';
import { UserMetricsResponseDto, TradingMetricsResponseDto, FunnelResponseDto } from '../dto/analytics-response.dto';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';

@Injectable()
export class UserBehaviorService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Session)
        private sessionRepository: Repository<Session>,
        @InjectRepository(Trade)
        private tradeRepository: Repository<Trade>,
        @InjectRepository(UserEvent)
        private userEventRepository: Repository<UserEvent>,
    ) { }

    async getUserMetrics(query?: AnalyticsQueryDto): Promise<UserMetricsResponseDto> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const totalUsers = await this.userRepository.count();
        const newUsersToday = await this.userRepository.count({
            where: { createdAt: MoreThanOrEqual(today) },
        });

        const activeUsersToday = await this.sessionRepository
            .createQueryBuilder('session')
            .select('COUNT(DISTINCT session.userId)', 'count')
            .where('session.createdAt >= :today', { today })
            .getRawOne();

        const mauResult = await this.sessionRepository
            .createQueryBuilder('session')
            .select('COUNT(DISTINCT session.userId)', 'count')
            .where('session.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
            .getRawOne();

        const dau = Number(activeUsersToday.count) || 0;
        const mau = Number(mauResult.count) || 0;
        const dauMauRatio = mau > 0 ? parseFloat((dau / mau).toFixed(2)) : 0;

        // Churn rate: Users inactive for 30 days
        const activeUsersSubquery = this.sessionRepository
            .createQueryBuilder('session')
            .select('session.userId')
            .where('session.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
            .getQuery();

        const churnedUsers = await this.userRepository
            .createQueryBuilder('user')
            .where(`user.id NOT IN (${activeUsersSubquery})`)
            .setParameters({ thirtyDaysAgo })
            .getCount();

        const churnRate = totalUsers > 0 ? parseFloat(((churnedUsers / totalUsers) * 100).toFixed(2)) : 0;

        return {
            totalUsers,
            newUsersToday,
            activeUsersToday: dau,
            dau,
            mau,
            dauMauRatio,
            churnRate,
        };
    }

    async getTradingMetrics(query?: AnalyticsQueryDto): Promise<TradingMetricsResponseDto> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalTrades = await this.tradeRepository.count();
        const tradesToday = await this.tradeRepository.count({
            where: { createdAt: MoreThanOrEqual(today) },
        });

        const { sum: totalVolume } = await this.tradeRepository
            .createQueryBuilder('trade')
            .where('trade.status = :status', { status: TradeStatus.SETTLED })
            .select('SUM(trade.amount)', 'sum') // Assuming amount is in common unit (e.g USD) or we calculate overall volume
            .getRawOne();

        const { sum: volumeToday } = await this.tradeRepository
            .createQueryBuilder('trade')
            .where('trade.status = :status AND trade.createdAt >= :today', { status: TradeStatus.SETTLED, today })
            .select('SUM(trade.amount)', 'sum')
            .getRawOne();

        const totalVolumeNum = Number(totalVolume) || 0;
        const volumeTodayNum = Number(volumeToday) || 0;

        const avgTradeSize = totalTrades > 0 ? totalVolumeNum / totalTrades : 0;

        const successfulTrades = await this.tradeRepository.count({
            where: { status: TradeStatus.SETTLED }, // Using SETTLED as success condition
        });

        const successRate = totalTrades > 0 ? parseFloat(((successfulTrades / totalTrades) * 100).toFixed(2)) : 0;

        return {
            totalTrades,
            tradesToday,
            totalVolume: totalVolumeNum,
            volumeToday: volumeTodayNum,
            avgTradeSize: parseFloat(avgTradeSize.toFixed(2)),
            successRate,
        };
    }

    async getFunnelAnalysis(query?: AnalyticsQueryDto): Promise<FunnelResponseDto> {
        // Basic Funnel: Landing -> Wallet Connect -> First Signal View -> First Trade
        // In actual implementation, we'd query User Events with proper session tracking

        // For now we simulate with DB aggregates based on presence
        const landingCount = await this.userEventRepository
            .createQueryBuilder('event')
            .select('COUNT(DISTINCT event.userId)', 'count')
            // Ideally filtering by eventType = LANDING or taking all users as base
            .getRawOne();

        const connectCount = await this.userRepository.count(); // Users who created accounts/connected wallets

        const signalViewCount = await this.userEventRepository
            .createQueryBuilder('event')
            .select('COUNT(DISTINCT event.userId)', 'count')
            .where('event.eventType = :eventType', { eventType: UserEventType.SIGNAL_VIEW })
            .getRawOne();

        const tradeCount = await this.tradeRepository
            .createQueryBuilder('trade')
            .select('COUNT(DISTINCT trade.userId)', 'count')
            .getRawOne();

        // Just an approximation since we don't have landing pages tracked in DB yet
        const usersCreated = connectCount;
        // Assume 2x users landed as created to simulate funnel
        const landing = usersCreated > 0 ? usersCreated * 2 : 10000;
        const connected = usersCreated;
        const viewed = Number(signalViewCount?.count) || 0;
        const traded = Number(tradeCount?.count) || 0;

        return {
            funnels: {
                onboarding: {
                    steps: [
                        { name: 'Landing', users: landing, conversionRate: 100 },
                        { name: 'Wallet Connect', users: connected, conversionRate: landing > 0 ? parseFloat(((connected / landing) * 100).toFixed(2)) : 0 },
                        { name: 'First Signal View', users: viewed, conversionRate: connected > 0 ? parseFloat(((viewed / connected) * 100).toFixed(2)) : 0 },
                        { name: 'First Trade', users: traded, conversionRate: viewed > 0 ? parseFloat(((traded / viewed) * 100).toFixed(2)) : 0 },
                    ],
                    overallConversion: landing > 0 ? parseFloat(((traded / landing) * 100).toFixed(2)) : 0,
                },
            },
        };
    }
}
