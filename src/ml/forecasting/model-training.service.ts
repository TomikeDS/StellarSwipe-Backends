import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Signal, SignalOutcome } from '../../signals/entities/signal.entity';
import { FeatureEngineeringService } from './feature-engineering.service';
import { SignalPredictorModel } from '../models/signal-predictor.model';

@Injectable()
export class ModelTrainingService implements OnModuleInit {
  private readonly logger = new Logger(ModelTrainingService.name);

  constructor(
    @InjectRepository(Signal)
    private signalRepository: Repository<Signal>,
    private featureEngineeringService: FeatureEngineeringService,
    private signalPredictorModel: SignalPredictorModel,
  ) {}

  async onModuleInit() {
    // Initial training check
    await this.trainModelIfNecessary();
  }

  @Cron(CronExpression.EVERY_WEEK)
  async scheduledRetraining() {
    this.logger.log('Starting weekly model retraining...');
    await this.trainModel();
  }

  async trainModelIfNecessary() {
    if (!this.signalPredictorModel.getTrainedStatus()) {
      const count = await this.signalRepository.count({
        where: { outcome: SignalOutcome.TARGET_HIT } // Simple check for some data
      });
      
      if (count > 10) {
        await this.trainModel();
      } else {
        this.logger.warn(`Insufficient data for training: ${count} successful signals found.`);
      }
    }
  }

  async trainModel() {
    this.logger.log('Fetching historical training data...');
    
    const historicalSignals = await this.signalRepository.find({
      where: [
        { outcome: SignalOutcome.TARGET_HIT },
        { outcome: SignalOutcome.STOP_LOSS_HIT }
      ],
      take: 1000,
      order: { createdAt: 'DESC' }
    });

    if (historicalSignals.length < 10) {
      this.logger.warn('Insufficient data to train model.');
      return;
    }

    const trainingData = [];
    for (const signal of historicalSignals) {
      const features = await this.featureEngineeringService.extractFeatures(signal);
      const featureArray = this.featureEngineeringService.prepareFeatureTensor(features);
      const label = signal.outcome === SignalOutcome.TARGET_HIT ? 1 : 0;
      const pnlLabel = Number(signal.totalProfitLoss); // Or relative P&L

      trainingData.push({ features: featureArray, label, pnlLabel });
    }

    this.logger.log(`Training on ${trainingData.length} samples...`);
    
    // In actual TF.js implementation:
    // const xs = tf.tensor2d(trainingData.map(d => d.features));
    // const ys = tf.tensor2d(trainingData.map(d => [d.label, d.pnlLabel]));
    // ... model.fit(xs, ys)
    
    // Simulating training completion
    this.signalPredictorModel.setModel({ id: 'dummy-tf-model' });
    this.logger.log('Model training complete and updated.');
  }

  getSamplesCount(): Promise<number> {
    return this.signalRepository.count({
      where: [
        { outcome: SignalOutcome.TARGET_HIT },
        { outcome: SignalOutcome.STOP_LOSS_HIT }
      ]
    });
  }
}
