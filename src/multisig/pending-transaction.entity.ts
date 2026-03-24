import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PendingTransactionStatus {
  PENDING = 'pending',
  READY = 'ready',
  SUBMITTED = 'submitted',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

@Entity('stellar_pending_transactions')
export class PendingTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id' })
  accountId: string;

  /** Base64-encoded XDR of the transaction envelope */
  @Column({ name: 'transaction_xdr', type: 'text' })
  transactionXdr: string;

  /** SHA-256 hash of the transaction */
  @Column({ name: 'transaction_hash', nullable: true })
  transactionHash: string | null;

  @Column({
    type: 'enum',
    enum: PendingTransactionStatus,
    default: PendingTransactionStatus.PENDING,
  })
  status: PendingTransactionStatus;

  /** Minimum threshold required to submit */
  @Column({ name: 'required_threshold', type: 'int' })
  requiredThreshold: number;

  /** Accumulated weight from collected signatures */
  @Column({ name: 'collected_weight', type: 'int', default: 0 })
  collectedWeight: number;

  /** JSON array of { publicKey, signature (base64), weight } */
  @Column({ name: 'signatures', type: 'jsonb', default: '[]' })
  signatures: Array<{ publicKey: string; signature: string; weight: number }>;

  /** Public keys that still need to sign */
  @Column({ name: 'pending_signers', type: 'jsonb', default: '[]' })
  pendingSigners: string[];

  /** Human-readable memo */
  @Column({ nullable: true })
  memo: string | null;

  /** Ledger sequence number at which this tx expires */
  @Column({ name: 'expires_at_ledger', type: 'bigint', nullable: true })
  expiresAtLedger: number | null;

  @Column({ name: 'submitted_at', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'stellar_tx_id', nullable: true })
  stellarTxId: string | null;

  /** Arbitrary metadata (operation descriptions, requester info, etc.) */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
