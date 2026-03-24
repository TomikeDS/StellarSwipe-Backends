import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AnomalyCategory, AnomalySeverity } from '../interfaces/anomaly-config.interface';
import { FraudAlertStatus, FraudAlertAction } from '../entities/fraud-alert.entity';

export class FraudAlertDto {
  @ApiProperty()
  alertId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: AnomalyCategory })
  category!: AnomalyCategory;

  @ApiProperty({ enum: AnomalySeverity })
  severity!: AnomalySeverity;

  @ApiProperty({ enum: FraudAlertStatus })
  status!: FraudAlertStatus;

  @ApiProperty({ enum: FraudAlertAction })
  actionTaken!: FraudAlertAction;

  @ApiProperty({ description: 'Composite risk score 0-100' })
  riskScore!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ description: 'Constituent anomaly IDs' })
  anomalyIds!: string[];

  @ApiPropertyOptional()
  totalValueUsd?: string;

  @ApiPropertyOptional()
  investigationId?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ResolveFraudAlertDto {
  @ApiProperty({ enum: FraudAlertStatus })
  @IsEnum(FraudAlertStatus)
  status!: FraudAlertStatus;

  @ApiPropertyOptional({ enum: FraudAlertAction })
  @IsOptional()
  @IsEnum(FraudAlertAction)
  action?: FraudAlertAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNote?: string;

  @ApiPropertyOptional({ description: 'Analyst UUID resolving the alert' })
  @IsOptional()
  @IsUUID()
  resolvedBy?: string;
}
