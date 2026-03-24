import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class TaxReportQueryDto {
  @IsInt()
  taxYear: number;

  @IsEnum(['FIFO', 'LIFO'])
  method: 'FIFO' | 'LIFO';

  @IsString()
  @IsOptional()
  format?: 'CSV' | 'PDF';

  @IsString()
  @IsOptional()
  jurisdiction?: 'US' | 'EU' | 'NG';
}
