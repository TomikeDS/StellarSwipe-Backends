import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderProfile } from './entities/provider-profile.entity';
import { ProviderFollower } from './entities/provider-follower.entity';
import { CacheModule } from '../cache/cache.module';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderProfile, ProviderFollower]),
    CacheModule,
    VerificationModule,
  ],
  controllers: [ProvidersController],
  providers: [ProvidersService],
})
export class ProvidersModule {}