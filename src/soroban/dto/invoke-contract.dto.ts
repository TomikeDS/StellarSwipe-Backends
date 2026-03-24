import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IsStellarPublicKey, IsStellarSecretKey } from '../../common/decorators/validation.decorator';

export class InvokeContractDto {
  @IsString()
  contractId!: string;

  @IsString()
  method!: string;

  @IsArray()
  @IsOptional()
  params?: unknown[];

  @IsString()
  @IsOptional()
  @IsStellarSecretKey()
  sourceSecret?: string;

  @IsString()
  @IsOptional()
  @IsStellarPublicKey()
  sourceAccount?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  timeoutMs?: number;
}
