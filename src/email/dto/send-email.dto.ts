import { IsEmail, IsString, IsOptional, IsObject } from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  template: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;
}
