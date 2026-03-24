import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('ip_whitelists')
@Index(['userId'])
export class IpWhitelist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  /**
   * Individual IPv4/IPv6 addresses or CIDR ranges.
   * e.g. ["192.168.1.1", "10.0.0.0/8", "2001:db8::/32"]
   */
  @Column({ type: 'text', array: true, default: '{}' })
  ipAddresses: string[];

  /** When false, the whitelist is stored but not enforced */
  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /** Human-readable label per entry stored as parallel array */
  @Column({ type: 'jsonb', default: '{}' })
  labels: Record<string, string>; // ip -> label map

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
