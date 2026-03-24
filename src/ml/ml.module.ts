import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { Signal } from '../signals/entities/signal.entity';
import { ProviderStats } from '../signals/entities/provider-stats.entity';
import { PriceOracleModule } from '../prices/price-oracle.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureEngineeringService } from './forecasting/feature-engineering.service';
import { ModelTrainingService } from './forecasting/model-training.service';
import { SignalForecastingService } from './forecasting/signal-forecasting.service';
import { SignalPredictorModel } from './models/signal-predictor.model';
import { SignalForecastingController } from './forecasting/signal-forecasting.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signal, ProviderStats]),
    CacheModule.register(),
    PriceOracleModule,
    AnalyticsModule,
  ],
  controllers: [SignalForecastingController],
  providers: [
    FeatureEngineeringService,
    ModelTrainingService,
    SignalForecastingService,
    SignalPredictorModel,
  ],
  exports: [SignalForecastingService],
})
export class MlModule {}
