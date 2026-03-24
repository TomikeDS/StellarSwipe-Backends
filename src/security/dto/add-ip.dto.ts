import {
  IsString,
  IsArray,
  IsBoolean,
  IsOptional,
  Matches,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const IP_OR_CIDR_PATTERN =
  /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^([0-9a-fA-F:]+)(\/\d{1,3})?$/;

export class AddIpDto {
  @ApiProperty({
    description: 'IPv4/IPv6 address or CIDR range to add',
    example: '192.168.1.100',
  })
  @IsString()
  @Matches(IP_OR_CIDR_PATTERN, {
    message:
      'Must be a valid IPv4/IPv6 address or CIDR range (e.g. 10.0.0.0/8)',
  })
  ip: string;

  @ApiPropertyOptional({
    description: 'Human-readable label for this IP entry',
  })
  @IsOptional()
  @IsString()
  label?: string;
}

export class RemoveIpDto {
  @ApiProperty({ description: 'IP address or CIDR to remove' })
  @IsString()
  ip: string;
}

export class UpdateWhitelistSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable or disable IP whitelist enforcement',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Replace the entire IP list (array of IPs/CIDRs)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  ipAddresses?: string[];

  @ApiPropertyOptional({ description: 'Labels map: { "192.168.1.1": "Home" }' })
  @IsOptional()
  @IsObject()
  labels?: Record<string, string>;
}

export class IpWhitelistResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [String] })
  ipAddresses: string[];

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  labels: Record<string, string>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
