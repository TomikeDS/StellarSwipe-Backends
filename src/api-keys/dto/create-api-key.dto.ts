import {
  IsString,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';

const VALID_SCOPES = [
  'read:signals',
  'read:portfolio',
  'write:trades',
  'write:signals',
];

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(VALID_SCOPES, { each: true })
  scopes!: string[];

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  rateLimit?: number;

  @IsOptional()
  expiresAt?: Date;
}
