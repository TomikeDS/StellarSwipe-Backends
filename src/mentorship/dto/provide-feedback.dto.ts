import { IsUUID, IsNotEmpty, IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class ProvideFeedbackDto {
  @IsUUID()
  @IsNotEmpty()
  mentorshipId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
