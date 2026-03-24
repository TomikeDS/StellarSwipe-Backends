import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { ProviderProfile } from './provider-profile.entity';

@Entity()
export class ProviderFollower {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => ProviderProfile, provider => provider.followers)
    provider: ProviderProfile;

    @ManyToOne(() => ProviderProfile, follower => follower.following)
    follower: ProviderProfile;
}