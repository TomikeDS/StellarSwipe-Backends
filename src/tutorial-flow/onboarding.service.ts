import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OnboardingProgress,
  TutorialStep,
  OnboardingStatus,
} from './entities/onboarding-progress.entity';
import {
  CompleteStepDto,
  OnboardingProgressResponseDto,
  TutorialStepResponseDto,
  DemoSignalDto,
  UpdateOnboardingDto,
} from './dto/tutorial-step.dto';

const TUTORIAL_STEPS_CONFIG = [
  {
    step: TutorialStep.WELCOME,
    title: 'Welcome to the Platform',
    description: 'Get introduced to the trading signal platform and its core features.',
    order: 1,
  },
  {
    step: TutorialStep.BROWSE_SIGNALS,
    title: 'Browse Trading Signals',
    description: 'Learn how to navigate and filter trading signals from expert analysts.',
    order: 2,
  },
  {
    step: TutorialStep.UNDERSTAND_METRICS,
    title: 'Understand Key Metrics',
    description: 'Master confidence scores, risk/reward ratios, win rates, and other critical metrics.',
    order: 3,
  },
  {
    step: TutorialStep.DEMO_TRADE,
    title: 'Execute a Demo Trade',
    description: 'Practice with fake signals and virtual funds to build your confidence.',
    order: 4,
  },
  {
    step: TutorialStep.FIRST_REAL_TRADE,
    title: 'Your First Real Trade',
    description: 'Execute your first real trade guided step-by-step.',
    order: 5,
  },
  {
    step: TutorialStep.COMPLETED,
    title: 'Onboarding Complete!',
    description: 'You have mastered the basics and earned your first achievement.',
    order: 6,
  },
];

const STEP_ORDER: TutorialStep[] = [
  TutorialStep.WELCOME,
  TutorialStep.BROWSE_SIGNALS,
  TutorialStep.UNDERSTAND_METRICS,
  TutorialStep.DEMO_TRADE,
  TutorialStep.FIRST_REAL_TRADE,
  TutorialStep.COMPLETED,
];

const DEMO_SIGNALS: DemoSignalDto[] = [
  {
    id: 'demo-signal-1',
    symbol: 'BTC/USDT',
    action: 'BUY',
    confidence: 87,
    entryPrice: 43250.0,
    targetPrice: 46500.0,
    stopLoss: 41800.0,
    riskReward: 2.24,
    isDemo: true,
  },
  {
    id: 'demo-signal-2',
    symbol: 'ETH/USDT',
    action: 'BUY',
    confidence: 79,
    entryPrice: 2280.0,
    targetPrice: 2550.0,
    stopLoss: 2180.0,
    riskReward: 2.7,
    isDemo: true,
  },
  {
    id: 'demo-signal-3',
    symbol: 'SOL/USDT',
    action: 'SELL',
    confidence: 72,
    entryPrice: 98.5,
    targetPrice: 88.0,
    stopLoss: 103.0,
    riskReward: 2.33,
    isDemo: true,
  },
];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(OnboardingProgress)
    private readonly onboardingRepository: Repository<OnboardingProgress>,
  ) {}

  async startOnboarding(userId: string): Promise<OnboardingProgressResponseDto> {
    const existing = await this.onboardingRepository.findOne({ where: { userId } });

    if (existing) {
      throw new ConflictException(`Onboarding already exists for user ${userId}`);
    }

    const progress = this.onboardingRepository.create({
      userId,
      status: OnboardingStatus.IN_PROGRESS,
      currentStep: TutorialStep.WELCOME,
      completedSteps: [],
      progressPercentage: 0,
    });

    const saved = await this.onboardingRepository.save(progress);
    this.logger.log(`Onboarding started for user ${userId}`);
    return this.formatResponse(saved);
  }

  async getProgress(userId: string): Promise<OnboardingProgressResponseDto> {
    const progress = await this.findByUserId(userId);
    return this.formatResponse(progress);
  }

  async completeStep(
    userId: string,
    dto: CompleteStepDto,
  ): Promise<OnboardingProgressResponseDto> {
    const progress = await this.findByUserId(userId);

    if (progress.status === OnboardingStatus.COMPLETED) {
      throw new BadRequestException('Onboarding is already completed');
    }

    const currentIndex = STEP_ORDER.indexOf(progress.currentStep);
    const incomingIndex = STEP_ORDER.indexOf(dto.step);

    if (incomingIndex !== currentIndex) {
      throw new BadRequestException(
        `Cannot complete step ${dto.step}. Current step is ${progress.currentStep}`,
      );
    }

    if (!progress.completedSteps.includes(dto.step)) {
      progress.completedSteps = [...progress.completedSteps, dto.step];
    }

    if (dto.step === TutorialStep.DEMO_TRADE) {
      progress.demoModeCompleted = true;
    }

    if (dto.step === TutorialStep.FIRST_REAL_TRADE) {
      progress.firstRealTradeCompleted = true;
    }

    if (dto.metadata) {
      progress.metadata = { ...(progress.metadata ?? {}), [dto.step]: dto.metadata };
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      progress.currentStep = STEP_ORDER[nextIndex];
    }

    const completable = STEP_ORDER.filter((s) => s !== TutorialStep.COMPLETED).length;
    const done = progress.completedSteps.filter((s) => s !== TutorialStep.COMPLETED).length;
    progress.progressPercentage = Math.round((done / completable) * 100);

    if (progress.currentStep === TutorialStep.COMPLETED) {
      progress.status = OnboardingStatus.COMPLETED;
      progress.achievementEarned = true;
      progress.completedAt = new Date();
      progress.progressPercentage = 100;
      this.logger.log(`Onboarding completed for user ${userId}. Achievement unlocked!`);
    }

    const saved = await this.onboardingRepository.save(progress);
    return this.formatResponse(saved);
  }

  async updateProgress(
    userId: string,
    dto: UpdateOnboardingDto,
  ): Promise<OnboardingProgressResponseDto> {
    const progress = await this.findByUserId(userId);
    Object.assign(progress, dto);
    const saved = await this.onboardingRepository.save(progress);
    return this.formatResponse(saved);
  }

  async resetOnboarding(userId: string): Promise<OnboardingProgressResponseDto> {
    const progress = await this.findByUserId(userId);

    progress.status = OnboardingStatus.IN_PROGRESS;
    progress.currentStep = TutorialStep.WELCOME;
    progress.completedSteps = [];
    progress.achievementEarned = false;
    progress.demoModeCompleted = false;
    progress.firstRealTradeCompleted = false;
    progress.progressPercentage = 0;
    progress.completedAt = null;
    progress.metadata = null;

    const saved = await this.onboardingRepository.save(progress);
    this.logger.log(`Onboarding reset for user ${userId}`);
    return this.formatResponse(saved);
  }

  getDemoSignals(): DemoSignalDto[] {
    return DEMO_SIGNALS;
  }

  getTutorialSteps(): Array<Omit<TutorialStepResponseDto, 'isCompleted' | 'isCurrent'>> {
    return TUTORIAL_STEPS_CONFIG.map((cfg) => ({
      step: cfg.step,
      title: cfg.title,
      description: cfg.description,
      order: cfg.order,
    }));
  }

  private async findByUserId(userId: string): Promise<OnboardingProgress> {
    const progress = await this.onboardingRepository.findOne({ where: { userId } });
    if (!progress) {
      throw new NotFoundException(`Onboarding progress not found for user ${userId}`);
    }
    return progress;
  }

  private formatResponse(progress: OnboardingProgress): OnboardingProgressResponseDto {
    const steps: TutorialStepResponseDto[] = TUTORIAL_STEPS_CONFIG.map((cfg) => ({
      step: cfg.step,
      title: cfg.title,
      description: cfg.description,
      order: cfg.order,
      isCompleted: progress.completedSteps.includes(cfg.step),
      isCurrent: progress.currentStep === cfg.step,
      ...(cfg.step === TutorialStep.DEMO_TRADE ? { demoData: { signals: DEMO_SIGNALS } } : {}),
    }));

    return {
      id: progress.id,
      userId: progress.userId,
      status: progress.status,
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      progressPercentage: progress.progressPercentage,
      achievementEarned: progress.achievementEarned,
      demoModeCompleted: progress.demoModeCompleted,
      firstRealTradeCompleted: progress.firstRealTradeCompleted,
      steps,
      completedAt: progress.completedAt,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    };
  }
}
