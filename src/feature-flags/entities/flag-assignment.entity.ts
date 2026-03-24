import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('flag_assignments')
export class FlagAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  flagName!: string;

  @Column({ default: false })
  enabled!: boolean;

  @Column({ nullable: true })
  variant?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
