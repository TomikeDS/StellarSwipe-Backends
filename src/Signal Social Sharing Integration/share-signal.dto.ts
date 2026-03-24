import { IsOptional, IsString } from 'class-validator';

export class ShareSignalDto {
  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  platform?: string; // 'twitter' | 'copy_link'
}

export class ShareSignalResponseDto {
  shareUrl: string;
  twitterIntentUrl: string;
  imageUrl: string;
  referralLink: string;
  shareCount: number;
  shareText: string;
}
