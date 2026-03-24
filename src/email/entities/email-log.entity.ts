import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  to: string;

  @Column()
  subject: string;

  @Column()
  template: string;

  @Column({ nullable: true })
  messageId: string;

  @Column()
  status: string; // sent, failed, bounced, delivered

  @Column({ nullable: true })
  error: string;

  @CreateDateColumn()
  sentAt: Date;
}
