import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import {
  StartOnboardingDto,
  CompleteStepDto,
  UpdateOnboardingDto,
  OnboardingProgressResponseDto,
  DemoSignalDto,
  TutorialStepResponseDto,
} from './dto/tutorial-step.dto';

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start onboarding for a user' })
  @ApiResponse({ status: 201, type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 409, description: 'Onboarding already exists for this user' })
  startOnboarding(
    @Body() dto: StartOnboardingDto,
  ): Promise<OnboardingProgressResponseDto> {
    return this.onboardingService.startOnboarding(dto.userId);
  }

  @Get('progress/:userId')
  @ApiOperation({ summary: 'Get onboarding progress for a user' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  getProgress(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<OnboardingProgressResponseDto> {
    return this.onboardingService.getProgress(userId);
  }

  @Post('progress/:userId/complete-step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a tutorial step as completed' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid step or step out of order' })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  completeStep(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CompleteStepDto,
  ): Promise<OnboardingProgressResponseDto> {
    return this.onboardingService.completeStep(userId, dto);
  }

  @Patch('progress/:userId')
  @ApiOperation({ summary: 'Update onboarding progress metadata' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  updateProgress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateOnboardingDto,
  ): Promise<OnboardingProgressResponseDto> {
    return this.onboardingService.updateProgress(userId, dto);
  }

  @Delete('progress/:userId/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset onboarding progress to the beginning' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: OnboardingProgressResponseDto })
  @ApiResponse({ status: 404, description: 'Onboarding progress not found' })
  resetOnboarding(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<OnboardingProgressResponseDto> {
    return this.onboardingService.resetOnboarding(userId);
  }

  @Get('demo-signals')
  @ApiOperation({ summary: 'Get demo signals for the tutorial demo trade step' })
  @ApiResponse({ status: 200, type: [DemoSignalDto] })
  getDemoSignals(): DemoSignalDto[] {
    return this.onboardingService.getDemoSignals();
  }

  @Get('steps')
  @ApiOperation({ summary: 'Get all tutorial step definitions' })
  @ApiResponse({ status: 200, description: 'List of all tutorial steps' })
  getTutorialSteps(): Array<Omit<TutorialStepResponseDto, 'isCompleted' | 'isCurrent'>> {
    return this.onboardingService.getTutorialSteps();
  }
}
