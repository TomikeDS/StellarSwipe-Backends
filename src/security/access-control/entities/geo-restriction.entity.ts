import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('geo_restrictions')
@Index(['userId'])
export class GeoRestriction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  /**
   * ISO 3166-1 alpha-2 country codes that are ALLOWED.
   * If non-empty and enabled, only these countries may access.
   * e.g. ["US", "GB", "DE"]
   */
  @Column({ type: 'text', array: true, default: '{}' })
  allowedCountries: string[];

  /**
   * Country codes that are always BLOCKED regardless of allowedCountries.
   */
  @Column({ type: 'text', array: true, default: '{}' })
  blockedCountries: string[];

  /** When false, restrictions are stored but not enforced */
  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /** Block known VPN/proxy/Tor exit nodes */
  @Column({ type: 'boolean', default: false })
  blockVpnProxy: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
