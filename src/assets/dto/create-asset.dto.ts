import { IsString, IsOptional, IsBoolean, IsUrl, MaxLength, Matches } from 'class-validator';
import { IsStellarPublicKey } from '../../common/decorators/validation.decorator';
import { SanitizeString } from '../../common/sanitizers/input.sanitizer';

export class CreateAssetDto {
  @SanitizeString()
  @IsString()
  @Matches(/^[A-Z0-9]{1,12}$/)
  @MaxLength(12)
  code!: string;

  @IsOptional()
  @IsStellarPublicKey()
  issuer?: string;

  @SanitizeString()
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @SanitizeString()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
