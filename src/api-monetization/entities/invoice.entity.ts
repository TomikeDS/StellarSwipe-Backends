import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  OVERDUE = 'overdue',
  VOID = 'void',
}

@Entity('invoices')
@Index(['userId', 'createdAt'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'billing_cycle_id' })
  billingCycleId!: string;

  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber!: string;

  @Column({ name: 'amount_due', type: 'decimal', precision: 10, scale: 2 })
  amountDue!: string;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 10, scale: 2, default: '0' })
  amountPaid!: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  @Index()
  status!: InvoiceStatus;

  @Column({ name: 'due_date', type: 'timestamp' })
  dueDate!: Date;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  lineItems?: Array<{ description: string; quantity: number; unitPrice: string; total: string }>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
