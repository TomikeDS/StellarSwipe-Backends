import { IsOptional, IsISO8601, IsEnum } from 'class-validator';

export enum AttributionTimeframe {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class AttributionQueryDto {
  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsEnum(AttributionTimeframe)
  timeframe?: AttributionTimeframe;
}
