import { IsEnum, IsNumber, IsInt, IsArray, IsString, Min } from 'class-validator';
import { PricingTierName } from '../entities/pricing-tier.entity';

export class PricingPlanDto {
  @IsEnum(PricingTierName)
  name!: PricingTierName;

  @IsNumber()
  @Min(0)
  monthlyFlatFee!: number;

  @IsInt()
  @Min(0)
  includedRequests!: number;

  @IsNumber()
  @Min(0)
  overageRate!: number;

  @IsInt()
  @Min(1)
  maxRequestsPerMinute!: number;

  @IsInt()
  @Min(1)
  maxRequestsPerDay!: number;

  @IsArray()
  @IsString({ each: true })
  features!: string[];
}
