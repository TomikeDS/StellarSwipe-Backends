import { ApiProperty } from '@nestjs/swagger';

export class EarningRecordDto {
  @ApiProperty() id: string;
  @ApiProperty() providerId: string;
  @ApiProperty() signalId: string;
  @ApiProperty() tradeId: string;
  @ApiProperty() amount: number;
  @ApiProperty() asset: string;
  @ApiProperty() tradedAmount: number;
  @ApiProperty() copierId: string;
  @ApiProperty() createdAt: Date;
}

export class EarningsSummaryDto {
  @ApiProperty({ description: 'Provider ID' })
  providerId: string;

  @ApiProperty({ description: 'Total lifetime earnings in USD equivalent' })
  totalEarnings: number;

  @ApiProperty({ description: 'Available balance (not yet paid out)' })
  availableBalance: number;

  @ApiProperty({ description: 'Total paid out amount' })
  totalPaidOut: number;

  @ApiProperty({ description: 'Minimum payout threshold', default: 10 })
  minimumPayoutThreshold: number;

  @ApiProperty({
    description: 'Whether provider is eligible for a payout request',
  })
  isEligibleForPayout: boolean;

  @ApiProperty({ description: 'Number of earning transactions' })
  totalTransactions: number;

  @ApiProperty({ type: [EarningRecordDto], description: 'Recent earnings' })
  recentEarnings: EarningRecordDto[];
}

export class PayoutHistoryItemDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: number;
  @ApiProperty() asset: string;
  @ApiProperty() status: string;
  @ApiProperty() destinationAddress: string;
  @ApiProperty({ nullable: true }) stellarTransactionId: string | null;
  @ApiProperty({ nullable: true }) failureReason: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) processedAt: Date | null;
}
