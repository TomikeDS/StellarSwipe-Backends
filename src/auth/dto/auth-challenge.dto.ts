
import { IsOptional, IsString } from 'class-validator';
import { IsStellarPublicKey } from '../../common/decorators/validation.decorator';

export class AuthChallengeDto {
  @IsOptional()
  @IsStellarPublicKey()
  publicKey?: string;
}
