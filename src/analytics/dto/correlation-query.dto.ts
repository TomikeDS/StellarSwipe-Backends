import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum CorrelationPeriod {
  DAYS_7 = 7,
  DAYS_30 = 30,
  DAYS_90 = 90,
  DAYS_180 = 180,
  DAYS_365 = 365,
}

export class CorrelationQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(7)
  @Max(365)
  days: number = 30;

  @IsOptional()
  @IsEnum(['XLM', 'USDC'])
  baseAsset: string = 'XLM';
}
