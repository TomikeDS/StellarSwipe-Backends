import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('signals')
export class Signal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  providerId: number;

  @Column()
  signalType: string;

  @Column('decimal', { precision: 5, scale: 2 })
  winRate: number;

  @Column('decimal', { precision: 10, scale: 2 })
  averagePL: number;

  @Column()
  totalSignals: number;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;
}