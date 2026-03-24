import { Module } from '@nestjs/common';
import { ProvidersModule } from './providers/providers.module';
import { SignalsModule } from './signals/signals.module';
import { CacheModule } from './cache/cache.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ProvidersModule,
    SignalsModule,
    CacheModule,
    VerificationModule,
  ],
})
export class AppModule {}