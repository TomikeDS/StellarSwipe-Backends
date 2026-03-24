import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, IsObject } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { 
  SanitizeString, 
  SanitizeNumber, 
  SanitizeBoolean, 
  SanitizeArray 
} from '../sanitizers/input.sanitizer';

export class BaseValidationDto {
  @IsOptional()
  @IsString()
  @SanitizeString()
  id?: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  createdAt?: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  updatedAt?: string;
}

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  @SanitizeNumber()
  @Transform(({ value }) => parseInt(value) || 1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @SanitizeNumber()
  @Transform(({ value }) => Math.min(parseInt(value) || 10, 100))
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @SanitizeString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class SearchDto {
  @IsOptional()
  @IsString()
  @SanitizeString()
  query?: string;

  @IsOptional()
  @IsArray()
  @SanitizeArray()
  filters?: string[];

  @IsOptional()
  @IsString()
  @SanitizeString()
  category?: string;
}

export class DateRangeDto {
  @IsOptional()
  @IsString()
  @SanitizeString()
  startDate?: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  endDate?: string;
}

export class BulkOperationDto {
  @IsArray()
  @SanitizeArray()
  ids: string[];

  @IsOptional()
  @IsString()
  @SanitizeString()
  action?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}