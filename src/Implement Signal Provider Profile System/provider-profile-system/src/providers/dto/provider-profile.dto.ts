import { IsString, IsOptional, IsUrl, IsBoolean, MaxLength } from 'class-validator';

export class ProviderProfileDto {
    @IsString()
    @MaxLength(50)
    displayName: string;

    @IsString()
    @MaxLength(500)
    bio: string;

    @IsUrl()
    avatarUrl: string;

    @IsString()
    @IsOptional()
    twitterHandle?: string;

    @IsBoolean()
    verified: boolean;
}