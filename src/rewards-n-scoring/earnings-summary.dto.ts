import { ApiProperty } from '@nestjs/swagger';

export class EarningRecordDto {
  @ApiProperty() id: string;
  @ApiProperty() providerId: string;
  @ApiProperty() signalId: string;
  @ApiProperty() tradeId: string;
  @ApiProperty() amount: number;
  @ApiProperty() tradedAmount: number;
  @ApiProperty() asset: string;
  @ApiProperty() isPaidOut: boolean;
  @ApiProperty() createdAt: Date;
}

export class EarningsSummaryDto {
  @ApiProperty() providerId: string;
  @ApiProperty() totalEarned: number;
  @ApiProperty() availableBalance: number;
  @ApiProperty() paidOut: number;
  @ApiProperty() pendingPayouts: number;
  @ApiProperty() earningsCount: number;
  @ApiProperty({ type: [EarningRecordDto] }) recentEarnings: EarningRecordDto[];
  @ApiProperty() canRequestPayout: boolean;
  @ApiProperty() minimumPayoutThreshold: number;
}

export class CreateEarningDto {
  providerId: string;
  signalId: string;
  tradeId: string;
  tradedAmount: number;
  asset: string;
}
