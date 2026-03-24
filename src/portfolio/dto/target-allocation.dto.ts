import {
  IsArray,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AllocationItemDto {
  /**
   * Asset code, e.g. 'USDC', 'XLM', 'AQUA'
   */
  @IsString()
  assetCode!: string;

  /**
   * Optional issuer address (null/undefined means native XLM)
   */
  @IsOptional()
  @IsString()
  assetIssuer?: string;

  /**
   * Target percentage of the total portfolio (0–100).
   * All items must sum to 100.
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  targetPercentage!: number;
}

export class SetTargetAllocationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  allocations!: AllocationItemDto[];

  /**
   * Drift threshold (%) above which rebalancing is triggered.
   * Defaults to 5 if not provided.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  driftThresholdPercent?: number;

  /**
   * When true, rebalancing trades are executed automatically
   * once drift is detected. Defaults to false (manual approval).
   */
  @IsOptional()
  @IsBoolean()
  autoRebalance?: boolean;
}

export class TargetAllocationResponseDto {
  userId!: string;
  allocations!: AllocationItemDto[];
  driftThresholdPercent!: number;
  autoRebalance!: boolean;
  updatedAt!: Date;
}
