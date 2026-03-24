import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { TutorialStep, OnboardingStatus } from './entities/onboarding-progress.entity';
import {
  StartOnboardingDto,
  CompleteStepDto,
  UpdateOnboardingDto,
  OnboardingProgressResponseDto,
  DemoSignalDto,
} from './dto/tutorial-step.dto';

const mockUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const baseResponse = (): OnboardingProgressResponseDto => ({
  id: 'prog-uuid',
  userId: mockUserId,
  status: OnboardingStatus.IN_PROGRESS,
  currentStep: TutorialStep.WELCOME,
  completedSteps: [],
  progressPercentage: 0,
  achievementEarned: false,
  demoModeCompleted: false,
  firstRealTradeCompleted: false,
  steps: [],
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let service: jest.Mocked<OnboardingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        {
          provide: OnboardingService,
          useValue: {
            startOnboarding: jest.fn(),
            getProgress: jest.fn(),
            completeStep: jest.fn(),
            updateProgress: jest.fn(),
            resetOnboarding: jest.fn(),
            getDemoSignals: jest.fn(),
            getTutorialSteps: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OnboardingController>(OnboardingController);
    service = module.get(OnboardingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('startOnboarding', () => {
    it('delegates to service and returns response', async () => {
      const dto: StartOnboardingDto = { userId: mockUserId };
      service.startOnboarding.mockResolvedValue(baseResponse());

      const result = await controller.startOnboarding(dto);

      expect(service.startOnboarding).toHaveBeenCalledWith(mockUserId);
      expect(result.userId).toBe(mockUserId);
    });
  });

  describe('getProgress', () => {
    it('delegates to service with userId param', async () => {
      service.getProgress.mockResolvedValue(baseResponse());

      const result = await controller.getProgress(mockUserId);

      expect(service.getProgress).toHaveBeenCalledWith(mockUserId);
      expect(result.userId).toBe(mockUserId);
    });
  });

  describe('completeStep', () => {
    it('passes userId and dto to service', async () => {
      const dto: CompleteStepDto = { step: TutorialStep.WELCOME };
      const response = { ...baseResponse(), completedSteps: [TutorialStep.WELCOME] };
      service.completeStep.mockResolvedValue(response);

      const result = await controller.completeStep(mockUserId, dto);

      expect(service.completeStep).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.completedSteps).toContain(TutorialStep.WELCOME);
    });
  });

  describe('updateProgress', () => {
    it('passes userId and dto to service', async () => {
      const dto: UpdateOnboardingDto = { demoModeCompleted: true };
      const response = { ...baseResponse(), demoModeCompleted: true };
      service.updateProgress.mockResolvedValue(response);

      const result = await controller.updateProgress(mockUserId, dto);

      expect(service.updateProgress).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.demoModeCompleted).toBe(true);
    });
  });

  describe('resetOnboarding', () => {
    it('delegates reset to service', async () => {
      service.resetOnboarding.mockResolvedValue(baseResponse());

      const result = await controller.resetOnboarding(mockUserId);

      expect(service.resetOnboarding).toHaveBeenCalledWith(mockUserId);
      expect(result.progressPercentage).toBe(0);
    });
  });

  describe('getDemoSignals', () => {
    it('returns demo signals from service', () => {
      const signals: DemoSignalDto[] = [
        {
          id: 'demo-1',
          symbol: 'BTC/USDT',
          action: 'BUY',
          confidence: 85,
          entryPrice: 43000,
          targetPrice: 46000,
          stopLoss: 41000,
          riskReward: 2.2,
          isDemo: true,
        },
      ];
      service.getDemoSignals.mockReturnValue(signals);

      const result = controller.getDemoSignals();

      expect(service.getDemoSignals).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].isDemo).toBe(true);
    });
  });

  describe('getTutorialSteps', () => {
    it('returns step definitions from service', () => {
      const steps = [
        { step: TutorialStep.WELCOME, title: 'Welcome', description: 'Intro', order: 1 },
      ];
      service.getTutorialSteps.mockReturnValue(steps);

      const result = controller.getTutorialSteps();

      expect(service.getTutorialSteps).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
