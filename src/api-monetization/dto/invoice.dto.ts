import { IsString, IsOptional } from 'class-validator';

export class InvoiceDto {
  @IsString()
  userId!: string;

  @IsString()
  billingCycleId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
