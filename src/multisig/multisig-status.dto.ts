import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PendingTransactionStatus } from '../entities/pending-transaction.entity';

export class SignerInfoDto {
  @ApiProperty() publicKey: string;
  @ApiProperty() weight: number;
  @ApiProperty() hasSigned: boolean;
}

export class MultisigAccountStatusDto {
  @ApiProperty({ description: 'Stellar account ID' })
  accountId: string;

  @ApiProperty({ description: 'Whether the account has multisig configured' })
  isMultisig: boolean;

  @ApiPropertyOptional({ description: 'Low threshold (e.g. allow trust)' })
  thresholdLow?: number;

  @ApiPropertyOptional({ description: 'Medium threshold (e.g. payments)' })
  thresholdMedium?: number;

  @ApiPropertyOptional({ description: 'High threshold (e.g. account merge)' })
  thresholdHigh?: number;

  @ApiPropertyOptional({ type: [SignerInfoDto] })
  signers?: SignerInfoDto[];

  @ApiProperty({ description: 'Total weight of all signers' })
  totalWeight: number;
}

export class PendingTransactionStatusDto {
  @ApiProperty() id: string;
  @ApiProperty() accountId: string;
  @ApiProperty({ enum: PendingTransactionStatus }) status: PendingTransactionStatus;
  @ApiProperty() requiredThreshold: number;
  @ApiProperty() collectedWeight: number;
  @ApiProperty() remainingWeight: number;
  @ApiProperty({ description: 'Whether enough weight has been collected to submit' })
  isReady: boolean;
  @ApiProperty({ type: [String], description: 'Public keys that have not yet signed' })
  pendingSigners: string[];
  @ApiProperty({ type: [Object] }) signatures: Array<{ publicKey: string; weight: number }>;
  @ApiPropertyOptional() memo?: string;
  @ApiPropertyOptional() expiresAtLedger?: number;
  @ApiPropertyOptional() submittedAt?: Date;
  @ApiPropertyOptional() stellarTxId?: string;
  @ApiPropertyOptional() metadata?: Record<string, unknown>;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class SubmitTransactionResultDto {
  @ApiProperty() success: boolean;
  @ApiPropertyOptional() stellarTxId?: string;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() pendingTransactionId?: string;
}
