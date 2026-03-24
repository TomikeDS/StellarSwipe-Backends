import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnomalySeverity, DetectorType } from '../interfaces/anomaly-config.interface';

export class DetectorScoreDto {
  @ApiProperty({ enum: DetectorType })
  detector!: DetectorType;

  @ApiProperty({ description: 'Raw score 0-1 from this detector' })
  score!: number;

  @ApiProperty({ description: 'Weight applied in ensemble' })
  weight!: number;
}

export class FeatureContributionDto {
  @ApiProperty()
  feature!: string;

  @ApiProperty({ description: 'Contribution to anomaly score 0-1' })
  contribution!: number;

  @ApiProperty({ description: 'Actual feature value' })
  value!: number;
}

export class RiskScoreDto {
  @ApiProperty({ description: 'User UUID' })
  userId!: string;

  @ApiProperty({ description: 'Composite risk score 0-100' })
  score!: number;

  @ApiProperty({ enum: AnomalySeverity, nullable: true })
  severity!: AnomalySeverity | null;

  @ApiProperty({ type: [DetectorScoreDto] })
  detectorScores!: DetectorScoreDto[];

  @ApiPropertyOptional({ type: [FeatureContributionDto] })
  topFeatures?: FeatureContributionDto[];

  @ApiProperty({ description: 'Open fraud alerts count' })
  openAlerts!: number;

  @ApiProperty({ description: 'Recent anomaly count (last 7 days)' })
  recentAnomalies!: number;

  @ApiProperty()
  computedAt!: Date;
}
