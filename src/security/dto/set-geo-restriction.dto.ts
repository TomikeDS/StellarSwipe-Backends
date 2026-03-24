import {
  IsString,
  IsArray,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── ISO 3166-1 alpha-2 pattern ───────────────────────────────────────────
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export class SetGeoRestrictionDto {
  @ApiPropertyOptional({
    description:
      'ISO 3166-1 alpha-2 codes that are allowed. Empty = all allowed.',
    example: ['US', 'GB', 'DE'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Matches(COUNTRY_CODE_PATTERN, {
    each: true,
    message: 'Each code must be a 2-letter ISO country code',
  })
  allowedCountries?: string[];

  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-2 codes that are always blocked.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Matches(COUNTRY_CODE_PATTERN, {
    each: true,
    message: 'Each code must be a 2-letter ISO country code',
  })
  blockedCountries?: string[];

  @ApiPropertyOptional({
    description: 'Enable or disable geo-restriction enforcement',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Block known VPN/proxy/Tor IPs' })
  @IsOptional()
  @IsBoolean()
  blockVpnProxy?: boolean;
}

export class GeoRestrictionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [String] })
  allowedCountries: string[];

  @ApiProperty({ type: [String] })
  blockedCountries: string[];

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  blockVpnProxy: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Temporary Access Code ────────────────────────────────────────────────

export class CreateTempAccessCodeDto {
  @ApiPropertyOptional({
    description: 'Restrict temp code to these IPs/CIDRs (empty = any IP)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  allowedIps?: string[];

  @ApiPropertyOptional({
    description:
      'Restrict temp code to these country codes (empty = any country)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  allowedCountries?: string[];

  @ApiProperty({
    description: 'Expiry datetime in ISO 8601 format',
    example: '2025-12-31T23:59:00Z',
  })
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional({
    description: 'Max number of times code can be used',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  @ApiPropertyOptional({
    description: 'Human-readable label',
    example: 'Tokyo conference trip',
  })
  @IsOptional()
  @IsString()
  label?: string;
}

export class TempAccessCodeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'The raw access code — shown only once' })
  code: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional()
  label?: string;

  @ApiProperty()
  maxUses: number | null;
}

export class UseTempAccessCodeDto {
  @ApiProperty({ description: 'The raw temporary access code' })
  @IsString()
  code: string;
}

// ─── Access Check Result ──────────────────────────────────────────────────

export class AccessCheckResponseDto {
  @ApiProperty()
  allowed: boolean;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  countryCode?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  isVpnProxy?: boolean;
}
