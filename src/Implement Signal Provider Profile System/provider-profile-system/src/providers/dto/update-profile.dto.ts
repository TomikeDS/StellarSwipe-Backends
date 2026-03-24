import { IsString, IsOptional, IsUrl, MaxLength, IsBoolean } from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    displayName?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string;

    @IsOptional()
    @IsUrl()
    avatarUrl?: string;

    @IsOptional()
    @IsString()
    twitterHandle?: string;

    @IsOptional()
    @IsBoolean()
    verified?: boolean;
}