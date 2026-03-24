import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';

export enum SmsTemplate {
  LARGE_LOSS = 'LARGE_LOSS',
  SECURITY = 'SECURITY',
  PAYOUT_FAILED = 'PAYOUT_FAILED',
}

export class SendSmsDto {
  @IsString()
  phoneNumber: string;

  @IsEnum(SmsTemplate)
  template: SmsTemplate;

  @IsObject()
  variables: Record<string, string>;
}

export class VerifyPhoneDto {
  @IsString()
  phoneNumber: string;
}

export class ConfirmOtpDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  code: string;
}
