import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForecastRequestDto {
  @ApiProperty({ description: 'The signal ID to forecast for' })
  @IsUUID()
  signalId!: string;

  @ApiProperty({ description: 'Provider ID', required: false })
  @IsUUID()
  @IsOptional()
  providerId?: string;

  @ApiProperty({ description: 'Asset pair', example: 'XLM/USDC', required: false })
  @IsString()
  @IsOptional()
  assetPair?: string;

  @ApiProperty({ description: 'Current market trend (bull/bear)', example: 'bull', required: false })
  @IsString()
  @IsOptional()
  marketTrend?: string;

  @ApiProperty({ description: 'Signal confidence score (0-100)', required: false })
  @IsNumber()
  @IsOptional()
  confidenceScore?: number;
}
