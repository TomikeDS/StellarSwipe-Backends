export class ApiKeyUsageDto {
  id!: string;
  name!: string;
  scopes!: string[];
  lastUsed?: Date;
  expiresAt?: Date;
  rateLimit!: number;
  createdAt!: Date;
  requestCount?: number;
  errorCount?: number;
}

export class ApiKeyResponseDto {
  id!: string;
  name!: string;
  key!: string;
  scopes!: string[];
  expiresAt?: Date;
  rateLimit!: number;
  createdAt!: Date;
}
