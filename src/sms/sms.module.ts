import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { TwilioProvider } from './providers/twilio.provider';

@Module({
  imports: [ConfigModule],
  providers: [SmsService, TwilioProvider],
  exports: [SmsService],
})
export class SmsModule {}
