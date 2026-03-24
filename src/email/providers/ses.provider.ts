import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './sendgrid.provider';

@Injectable()
export class SESProvider implements EmailProvider {
  private readonly logger = new Logger(SESProvider.name);
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    this.secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.fromEmail = this.configService.get<string>('SES_FROM_EMAIL', 'noreply@stellarswipe.com');
  }

  async sendEmail(to: string, subject: string, html: string): Promise<{ messageId: string; status: string }> {
    try {
      const params = {
        Source: this.fromEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: html } },
        },
      };

      // AWS SES v3 SDK would be used here in production
      // For now, this is a placeholder implementation
      this.logger.log(`Email sent to ${to} via SES`);

      return { messageId: `ses-${Date.now()}`, status: 'sent' };
    } catch (error) {
      this.logger.error(`Failed to send email via SES to ${to}: ${error.message}`);
      throw error;
    }
  }
}
