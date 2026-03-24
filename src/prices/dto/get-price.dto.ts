import { IsNotEmpty, IsString } from 'class-validator';
import { IsAssetPair } from '../../common/decorators/validation.decorator';

export class GetPriceDto {
  @IsAssetPair()
  @IsNotEmpty()
  assetPair: string;
}
