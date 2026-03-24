import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signal } from '../../signals/entities/signal.entity';
import { FeatureEngineeringService } from './feature-engineering.service';
import { SignalPredictorModel } from '../models/signal-predictor.model';
import { ModelTrainingService } from './model-training.service';
import { ForecastResultDto } from '../dto/forecast-result.dto';

@Injectable()
export class SignalForecastingService {
  private readonly logger = new Logger(SignalForecastingService.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @InjectRepository(Signal)
    private signalRepository: Repository<Signal>,
    private featureEngineeringService: FeatureEngineeringService,
    private predictorModel: SignalPredictorModel,
    private trainingService: ModelTrainingService,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getForecast(signalId: string): Promise<ForecastResultDto> {
    const cacheKey = `forecast:${signalId}`;
    const cached = await this.cacheManager.get<ForecastResultDto>(cacheKey);

    if (cached) {
      this.logger.debug(`Forecast cache hit for ${signalId}`);
      return cached;
    }

    const signal = await this.signalRepository.findOne({
      where: { id: signalId },
    });

    if (!signal) {
      throw new Error(`Signal ${signalId} not found`);
    }

    const features = await this.featureEngineeringService.extractFeatures(signal);
    const featureArray = this.featureEngineeringService.prepareFeatureTensor(features);
    
    const prediction = await this.predictorModel.predict(featureArray);
    const samplesCount = await this.trainingService.getSamplesCount();

    const result: ForecastResultDto = {
      signalId,
      successProbability: Math.round(prediction.probability),
      expectedPnL: {
        low: prediction.pnl * 0.5,
        mid: prediction.pnl,
        high: prediction.pnl * 1.5,
      },
      confidence: this.calculateConfidence(features, samplesCount),
      basedOnSamples: samplesCount,
    };

    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  private calculateConfidence(features: any, samples: number): number {
    // Confidence is higher if we have more samples and features are "standard"
    const baseConfidence = Math.min(90, (samples / 100) * 10);
    const featureReliability = features.providerConsistency * 0.5 + features.signalConfidence * 0.5;
    
    return Math.round(baseConfidence + (featureReliability * 20));
  }
}
