import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_usage')
@Index(['apiKeyId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class ApiUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'api_key_id' })
  @Index()
  apiKeyId!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ length: 255 })
  endpoint!: string;

  @Column({ length: 10 })
  method!: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode!: number;

  @Column({ name: 'response_time_ms', type: 'int' })
  responseTimeMs!: number;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
