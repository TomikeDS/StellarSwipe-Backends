import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { CohortAnalysisService } from './services/cohort-analysis.service';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';
import { UserBehaviorService } from './services/user-behavior.service';
import { User } from '../../users/entities/user.entity';
import { Session } from '../../users/entities/session.entity';
import { Trade } from '../../trades/entities/trade.entity';
import { FeeTransaction } from '../../fee_management/entities/fee-transaction.entity';
import { UserSubscription } from '../../subscriptions/entities/user-subscription.entity';
import { UserEvent } from '../../analytics/entities/user-event.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            Session,
            Trade,
            FeeTransaction,
            UserSubscription,
            UserEvent,
        ]),
    ],
    controllers: [AdminAnalyticsController],
    providers: [
        AdminAnalyticsService,
        CohortAnalysisService,
        RevenueAnalyticsService,
        UserBehaviorService,
    ],
    exports: [AdminAnalyticsService],
})
export class AdminAnalyticsModule { }
