import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnomalyCategory, AnomalySeverity, DetectorType } from '../interfaces/anomaly-config.interface';

export class AnomalyReportDto {
  @ApiProperty()
  anomalyId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: DetectorType })
  detectorType!: DetectorType;

  @ApiProperty({ enum: AnomalyCategory })
  category!: AnomalyCategory;

  @ApiProperty({ enum: AnomalySeverity })
  severity!: AnomalySeverity;

  @ApiProperty({ description: 'Raw detector score 0-1' })
  anomalyScore!: number;

  @ApiProperty({ description: 'Ensemble score 0-1' })
  ensembleScore!: number;

  @ApiProperty()
  description!: string;

  @ApiProperty({ description: 'Related trade IDs' })
  relatedTradeIds!: string[];

  @ApiPropertyOptional({ description: 'Related signal IDs (manipulation only)' })
  relatedSignalIds?: string[];

  @ApiPropertyOptional({ type: Object, description: 'Structured evidence' })
  evidence?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, description: 'Feature → contribution mapping' })
  featureContributions?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Linked fraud alert ID' })
  fraudAlertId?: string;

  @ApiProperty()
  detectedAt!: Date;
}
