import { IsString, IsNotEmpty, Matches, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PayoutAsset {
  XLM = 'XLM',
  USDC = 'USDC',
}

export class PayoutRequestDto {
  @ApiProperty({
    description: 'Provider Stellar wallet address for payout destination',
    example: 'GABC...XYZ',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'destinationAddress must be a valid Stellar public key',
  })
  destinationAddress: string;

  @ApiProperty({
    description: 'Asset to receive payout in',
    enum: PayoutAsset,
    default: PayoutAsset.USDC,
  })
  @IsEnum(PayoutAsset)
  asset: PayoutAsset;
}
