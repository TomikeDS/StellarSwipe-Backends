import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwilioProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly client: any;

  constructor(private configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');

    if (this.accountSid && this.authToken) {
      const twilio = require('twilio');
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  async sendSms(to: string, message: string): Promise<{ sid: string; status: string; cost?: string }> {
    if (!this.client) {
      this.logger.warn('Twilio not configured, simulating SMS send');
      return { sid: 'sim_' + Date.now(), status: 'sent' };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
      });

      this.logger.log(`SMS sent to ${to}: ${result.sid}`);
      return {
        sid: result.sid,
        status: result.status,
        cost: result.price,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      throw error;
    }
  }

  async getMessageStatus(sid: string): Promise<{ status: string; cost?: string }> {
    if (!this.client) {
      return { status: 'delivered' };
    }

    try {
      const message = await this.client.messages(sid).fetch();
      return {
        status: message.status,
        cost: message.price,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch message status: ${error.message}`);
      throw error;
    }
  }
}
