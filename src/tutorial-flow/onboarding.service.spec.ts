import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingProgress, TutorialStep, OnboardingStatus } from './entities/onboarding-progress.entity';
import { CompleteStepDto, UpdateOnboardingDto } from './dto/tutorial-step.dto';

const mockUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const mockProgress = (): OnboardingProgress => ({
  id: 'prog-uuid-1234',
  userId: mockUserId,
  status: OnboardingStatus.IN_PROGRESS,
  currentStep: TutorialStep.WELCOME,
  completedSteps: [],
  achievementEarned: false,
  demoModeCompleted: false,
  firstRealTradeCompleted: false,
  progressPercentage: 0,
  metadata: null,
  completedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

describe('OnboardingService', () => {
  let service: OnboardingService;
  let repo: jest.Mocked<Repository<OnboardingProgress>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: getRepositoryToken(OnboardingProgress),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    repo = module.get(getRepositoryToken(OnboardingProgress));
  });

  afterEach(() => jest.clearAllMocks());

  // ────────────────────────────────────────────────
  // startOnboarding
  // ────────────────────────────────────────────────
  describe('startOnboarding', () => {
    it('creates and returns progress when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const created = mockProgress();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.startOnboarding(mockUserId);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          status: OnboardingStatus.IN_PROGRESS,
          currentStep: TutorialStep.WELCOME,
          completedSteps: [],
          progressPercentage: 0,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result.userId).toBe(mockUserId);
      expect(result.status).toBe(OnboardingStatus.IN_PROGRESS);
    });

    it('throws ConflictException when onboarding already exists', async () => {
      repo.findOne.mockResolvedValue(mockProgress());

      await expect(service.startOnboarding(mockUserId)).rejects.toThrow(ConflictException);
    });
  });

  // ────────────────────────────────────────────────
  // getProgress
  // ────────────────────────────────────────────────
  describe('getProgress', () => {
    it('returns formatted progress for existing user', async () => {
      repo.findOne.mockResolvedValue(mockProgress());

      const result = await service.getProgress(mockUserId);

      expect(result.userId).toBe(mockUserId);
      expect(result.steps).toHaveLength(6);
      expect(result.steps[0].isCurrent).toBe(true);
    });

    it('throws NotFoundException when progress does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getProgress(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────
  // completeStep
  // ────────────────────────────────────────────────
  describe('completeStep', () => {
    it('advances to the next step correctly', async () => {
      const progress = mockProgress();
      repo.findOne.mockResolvedValue(progress);
      repo.save.mockImplementation(async (p) => p as OnboardingProgress);

      const dto: CompleteStepDto = { step: TutorialStep.WELCOME };
      const result = await service.completeStep(mockUserId, dto);

      expect(result.completedSteps).toContain(TutorialStep.WELCOME);
      expect(result.currentStep).toBe(TutorialStep.BROWSE_SIGNALS);
      expect(result.progressPercentage).toBeGreaterThan(0);
    });

    it('sets demoModeCompleted when DEMO_TRADE step is completed', async () => {
      const progress = mockProgress();
      progress.currentStep = TutorialStep.DEMO_TRADE;
      progress.completedSteps = [
        TutorialStep.WELCOME,
        TutorialStep.BROWSE_SIGNALS,
        TutorialStep.UNDERSTAND_METRICS,
      ];
      repo.findOne.mockResolvedValue(progress);
      repo.save.mockImplementation(async (p) => p as OnboardingProgress);

      const dto: CompleteStepDto = { step: TutorialStep.DEMO_TRADE };
      const result = await service.completeStep(mockUserId, dto);

      expect(result.demoModeCompleted).toBe(true);
    });

    it('sets firstRealTradeCompleted when FIRST_REAL_TRADE step is completed', async () => {
      const progress = mockProgress();
      progress.currentStep = TutorialStep.FIRST_REAL_TRADE;
      progress.completedSteps = [
        TutorialStep.WELCOME,
        TutorialStep.BROWSE_SIGNALS,
        TutorialStep.UNDERSTAND_METRICS,
        TutorialStep.DEMO_TRADE,
      ];
      progress.demoModeCompleted = true;
      repo.findOne.mockResolvedValue(progress);
      repo.save.mockImplementation(async (p) => p as OnboardingProgress);

      const dto: CompleteStepDto = { step: TutorialStep.FIRST_REAL_TRADE };
      const result = await service.completeStep(mockUserId, dto);

      expect(result.firstRealTradeCompleted).toBe(true);
      expect(result.achievementEarned).toBe(true);
      expect(result.status).toBe(OnboardingStatus.COMPLETED);
      expect(result.progressPercentage).toBe(100);
      expect(result.completedAt).not.toBeNull();
    });

    it('saves optional metadata on the step', async () => {
      const progress = mockProgress();
      repo.findOne.mockResolvedValue(progress);
      repo.save.mockImplementation(async (p) => p as OnboardingProgress);

      const dto: CompleteStepDto = {
        step: TutorialStep.WELCOME,
        metadata: { timeSpentMs: 4200 },
      };
      await service.completeStep(mockUserId, dto);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            [TutorialStep.WELCOME]: { timeSpentMs: 4200 },
          }),
        }),
      );
    });

    it('throws BadRequestException when step is out of order', async () => {
      const progress = mockProgress(); // currentStep = WELCOME
      repo.findOne.mockResolvedValue(progress);

      const dto: CompleteStepDto = { step: TutorialStep.DEMO_TRADE };
      await expect(service.completeStep(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when onboarding is already completed', async () => {
      const progress = mockProgress();
      progress.status = OnboardingStatus.COMPLETED;
      repo.findOne.mockResolvedValue(progress);

      const dto: CompleteStepDto = { step: TutorialStep.WELCOME };
      await expect(service.completeStep(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('does not duplicate a step in completedSteps on re-save', async () => {
      const progress = mockProgress();
      progress.completedSteps = [TutorialStep.WELCOME];
      progress.currentStep = TutorialStep.BROWSE_SIGNALS;
      repo.findOne.mockResolvedValue(progress);
      repo.save.mockImplementation(async (p) => p as OnboardingProgress);

      const dto: CompleteStepDto = { step: TutorialStep.BROWSE_SIGNALS };
      const result = await service.completeStep(mockUserId, dto);

      const browseCount = result.completedSteps.filter(
        (s) => s === TutorialStep.BROWSE_SIGNALS,
      ).length;
      expect(browseCount).toBe(1);
    });
  });

  // ────────────────────────────────────────────────
  // updateProgress
  // ────────────────────────────────────────────────
  describe('updateProgress', () => {
    it('merges provided fields and saves', async () => {
      const progress = mockProgress();
      repo.findOne.mockResolvedValue(progress);
      repo.save.mockImplementation(async (p) => p as OnboardingProgress);

      const dto: UpdateOnboardingDto = { metadata: { source: 'mobile' } };
      const result = await service.updateProgress(mockUserId, dto);

      expect(result.metadata).toEqual({ source: 'mobile' });
    });

    it('throws NotFoundException for unknown user', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProgress('non-existent-uuid', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────
  // resetOnboarding
  // ────────────────────────────────────────────────
  describe('resetOnboarding', () => {
    it('resets all fields to initial state', async () => {
      const progress = mockProgress();
      progress.status = OnboardingStatus.COMPLETED;
      progress.completedSteps = Object.values(TutorialStep);
      progress.achievementEarned = true;
      progress.demoModeCompleted = true;
      progress.firstRealTradeCompleted = true;
      progress.progressPercentage = 100;
      repo.findOne.mockResolvedValue(progress);
      repo.save.mockImplementation(async (p) => p as OnboardingProgress);

      const result = await service.resetOnboarding(mockUserId);

      expect(result.status).toBe(OnboardingStatus.IN_PROGRESS);
      expect(result.currentStep).toBe(TutorialStep.WELCOME);
      expect(result.completedSteps).toHaveLength(0);
      expect(result.progressPercentage).toBe(0);
      expect(result.achievementEarned).toBe(false);
      expect(result.demoModeCompleted).toBe(false);
      expect(result.firstRealTradeCompleted).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it('throws NotFoundException for unknown user', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.resetOnboarding('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────
  // getDemoSignals
  // ────────────────────────────────────────────────
  describe('getDemoSignals', () => {
    it('returns demo signals with isDemo flag', () => {
      const signals = service.getDemoSignals();

      expect(signals.length).toBeGreaterThan(0);
      signals.forEach((s) => {
        expect(s.isDemo).toBe(true);
        expect(s.symbol).toBeTruthy();
        expect(s.confidence).toBeGreaterThan(0);
        expect(s.riskReward).toBeGreaterThan(0);
      });
    });
  });

  // ────────────────────────────────────────────────
  // getTutorialSteps
  // ────────────────────────────────────────────────
  describe('getTutorialSteps', () => {
    it('returns all tutorial step definitions in order', () => {
      const steps = service.getTutorialSteps();

      expect(steps).toHaveLength(6);
      expect(steps[0].step).toBe(TutorialStep.WELCOME);
      expect(steps[steps.length - 1].step).toBe(TutorialStep.COMPLETED);
      steps.forEach((s, i) => expect(s.order).toBe(i + 1));
    });
  });

  // ────────────────────────────────────────────────
  // formatResponse – steps array
  // ────────────────────────────────────────────────
  describe('formatResponse (via getProgress)', () => {
    it('marks correct step as isCurrent', async () => {
      const progress = mockProgress();
      progress.currentStep = TutorialStep.UNDERSTAND_METRICS;
      progress.completedSteps = [TutorialStep.WELCOME, TutorialStep.BROWSE_SIGNALS];
      repo.findOne.mockResolvedValue(progress);

      const result = await service.getProgress(mockUserId);

      const current = result.steps.find((s) => s.isCurrent);
      expect(current?.step).toBe(TutorialStep.UNDERSTAND_METRICS);
    });

    it('marks completed steps correctly', async () => {
      const progress = mockProgress();
      progress.completedSteps = [TutorialStep.WELCOME];
      progress.currentStep = TutorialStep.BROWSE_SIGNALS;
      repo.findOne.mockResolvedValue(progress);

      const result = await service.getProgress(mockUserId);

      const welcome = result.steps.find((s) => s.step === TutorialStep.WELCOME)!;
      const browse = result.steps.find((s) => s.step === TutorialStep.BROWSE_SIGNALS)!;
      expect(welcome.isCompleted).toBe(true);
      expect(browse.isCompleted).toBe(false);
    });

    it('attaches demoData only to DEMO_TRADE step', async () => {
      repo.findOne.mockResolvedValue(mockProgress());

      const result = await service.getProgress(mockUserId);

      const demoStep = result.steps.find((s) => s.step === TutorialStep.DEMO_TRADE)!;
      const otherStep = result.steps.find((s) => s.step === TutorialStep.WELCOME)!;
      expect(demoStep.demoData).toBeDefined();
      expect(otherStep.demoData).toBeUndefined();
    });
  });
});
