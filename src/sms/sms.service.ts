import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TwilioProvider } from './providers/twilio.provider';
import { SMS_TEMPLATES, renderTemplate } from './templates/sms.templates';
import { SmsTemplate } from './dto/send-sms.dto';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly redis: Redis;
  private readonly dailyLimit = 5;
  private readonly monthlyBudget: number;
  private readonly budgetAlertThreshold = 0.8;

  constructor(
    private twilioProvider: TwilioProvider,
    private configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
    });
    this.monthlyBudget = this.configService.get<number>('SMS_MONTHLY_BUDGET', 100);
  }

  async sendSms(userId: string, phoneNumber: string, template: SmsTemplate, variables: Record<string, string>): Promise<void> {
    await this.checkVerified(phoneNumber);
    await this.checkRateLimit(userId);
    await this.checkBudget();

    const message = renderTemplate(SMS_TEMPLATES[template], variables);
    const result = await this.twilioProvider.sendSms(phoneNumber, message);

    await this.incrementRateLimit(userId);
    await this.trackDelivery(userId, phoneNumber, result.sid, result.status);
    
    if (result.cost) {
      await this.trackCost(parseFloat(result.cost));
    }

    this.logger.log(`SMS sent to user ${userId}: ${result.sid}`);
  }

  async verifyPhone(userId: string, phoneNumber: string): Promise<void> {
    const otp = this.generateOtp();
    await this.redis.setex(`otp:${phoneNumber}`, 600, otp);

    const message = `Your StellarSwipe verification code is: ${otp}. Valid for 10 minutes.`;
    await this.twilioProvider.sendSms(phoneNumber, message);

    this.logger.log(`OTP sent to ${phoneNumber} for user ${userId}`);
  }

  async confirmOtp(phoneNumber: string, code: string): Promise<boolean> {
    const storedOtp = await this.redis.get(`otp:${phoneNumber}`);
    
    if (!storedOtp || storedOtp !== code) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.redis.del(`otp:${phoneNumber}`);
    await this.redis.set(`verified:${phoneNumber}`, '1');
    
    this.logger.log(`Phone verified: ${phoneNumber}`);
    return true;
  }

  async getDeliveryStatus(sid: string): Promise<{ status: string; cost?: string }> {
    return this.twilioProvider.getMessageStatus(sid);
  }

  async getMonthlyStats(): Promise<{ sent: number; cost: number; budget: number; remaining: number }> {
    const month = new Date().toISOString().slice(0, 7);
    const sent = parseInt(await this.redis.get(`sms:count:${month}`) || '0');
    const cost = parseFloat(await this.redis.get(`sms:cost:${month}`) || '0');
    
    return {
      sent,
      cost,
      budget: this.monthlyBudget,
      remaining: this.monthlyBudget - cost,
    };
  }

  private async checkVerified(phoneNumber: string): Promise<void> {
    const verified = await this.redis.get(`verified:${phoneNumber}`);
    if (!verified) {
      throw new ForbiddenException('Phone number not verified');
    }
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `sms:limit:${userId}:${today}`;
    const count = parseInt(await this.redis.get(key) || '0');

    if (count >= this.dailyLimit) {
      throw new ForbiddenException('Daily SMS limit exceeded');
    }
  }

  private async incrementRateLimit(userId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `sms:limit:${userId}:${today}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 86400);
  }

  private async checkBudget(): Promise<void> {
    const stats = await this.getMonthlyStats();
    
    if (stats.cost >= this.monthlyBudget) {
      this.logger.error('Monthly SMS budget exceeded');
      throw new ForbiddenException('SMS service temporarily unavailable');
    }

    if (stats.cost >= this.monthlyBudget * this.budgetAlertThreshold) {
      this.logger.warn(`SMS budget at ${Math.round((stats.cost / this.monthlyBudget) * 100)}%`);
    }
  }

  private async trackCost(cost: number): Promise<void> {
    const month = new Date().toISOString().slice(0, 7);
    const key = `sms:cost:${month}`;
    await this.redis.incrbyfloat(key, cost);
    await this.redis.expire(key, 2678400); // 31 days
  }

  private async trackDelivery(userId: string, phoneNumber: string, sid: string, status: string): Promise<void> {
    const month = new Date().toISOString().slice(0, 7);
    await this.redis.incr(`sms:count:${month}`);
    
    const delivery = {
      userId,
      phoneNumber,
      sid,
      status,
      timestamp: new Date().toISOString(),
    };
    
    await this.redis.lpush(`sms:deliveries:${userId}`, JSON.stringify(delivery));
    await this.redis.ltrim(`sms:deliveries:${userId}`, 0, 99);
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
