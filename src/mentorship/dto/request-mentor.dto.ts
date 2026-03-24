import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class RequestMentorDto {
  @IsUUID()
  @IsNotEmpty()
  mentorId!: string;

  @IsString()
  @IsOptional()
  message?: string;
  
  @IsString()
  @IsOptional()
  assetSpecialization?: string;
}
