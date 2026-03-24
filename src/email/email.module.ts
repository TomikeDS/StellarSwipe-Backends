import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EmailService } from './email.service';
import { SendGridProvider } from './providers/sendgrid.provider';
import { SESProvider } from './providers/ses.provider';
import { EmailLog } from './entities/email-log.entity';
import { UnsubscribeList } from './entities/unsubscribe-list.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EmailLog, UnsubscribeList]),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  providers: [EmailService, SendGridProvider, SESProvider],
  exports: [EmailService],
})
export class EmailModule {}
