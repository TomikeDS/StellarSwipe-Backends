import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ReputationScore } from './entities/reputation-score.entity';
import { ReputationScoringService } from './services/reputation-scoring.service';
import { UpdateReputationScoresJob } from './jobs/update-reputation-scores.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReputationScore]),
    ScheduleModule.forRoot(),
  ],
  providers: [ReputationScoringService, UpdateReputationScoresJob],
  exports: [ReputationScoringService],
})
export class ProvidersModule {}
