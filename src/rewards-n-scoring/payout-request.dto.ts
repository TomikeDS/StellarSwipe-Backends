import { IsString, IsNotEmpty, IsEnum, Matches, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PayoutAsset {
  XLM = 'XLM',
  USDC = 'USDC',
}

export class PayoutRequestDto {
  @ApiProperty({ description: 'Stellar destination address (public key)', example: 'GABC...' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'Invalid Stellar public key' })
  destinationAddress: string;

  @ApiProperty({ enum: PayoutAsset, description: 'Asset to receive payout in' })
  @IsEnum(PayoutAsset)
  asset: PayoutAsset;

  @ApiPropertyOptional({ description: 'Specific amount to withdraw (defaults to full balance)' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  amount?: number;
}
