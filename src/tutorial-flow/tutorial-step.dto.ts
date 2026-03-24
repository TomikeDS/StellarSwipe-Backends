import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TutorialStep, OnboardingStatus } from '../entities/onboarding-progress.entity';

export class StartOnboardingDto {
  @ApiProperty({ description: 'User ID to start onboarding for' })
  @IsUUID()
  userId: string;
}

export class CompleteStepDto {
  @ApiProperty({ enum: TutorialStep, description: 'The tutorial step being completed' })
  @IsEnum(TutorialStep)
  step: TutorialStep;

  @ApiPropertyOptional({ description: 'Optional metadata about the step completion' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateOnboardingDto {
  @ApiPropertyOptional({ enum: TutorialStep })
  @IsOptional()
  @IsEnum(TutorialStep)
  currentStep?: TutorialStep;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  demoModeCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  firstRealTradeCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class TutorialStepResponseDto {
  @ApiProperty()
  step: TutorialStep;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  isCompleted: boolean;

  @ApiProperty()
  isCurrent: boolean;

  @ApiPropertyOptional()
  demoData?: Record<string, unknown>;
}

export class OnboardingProgressResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: OnboardingStatus })
  status: OnboardingStatus;

  @ApiProperty({ enum: TutorialStep })
  currentStep: TutorialStep;

  @ApiProperty({ type: [String], enum: TutorialStep })
  completedSteps: TutorialStep[];

  @ApiProperty()
  progressPercentage: number;

  @ApiProperty()
  achievementEarned: boolean;

  @ApiProperty()
  demoModeCompleted: boolean;

  @ApiProperty()
  firstRealTradeCompleted: boolean;

  @ApiProperty({ type: [TutorialStepResponseDto] })
  steps: TutorialStepResponseDto[];

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class DemoSignalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  symbol: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  entryPrice: number;

  @ApiProperty()
  targetPrice: number;

  @ApiProperty()
  stopLoss: number;

  @ApiProperty()
  riskReward: number;

  @ApiProperty()
  isDemo: boolean;
}
