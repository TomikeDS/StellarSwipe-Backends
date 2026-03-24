import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { I18nAppService } from '../i18n/i18n.service';
import { signalFactory, createSignalDtoFactory } from '../../test/utils/mock-factories';

describe('SignalsController', () => {
  let controller: SignalsController;
  let service: SignalsService;
  let i18nService: I18nAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SignalsController],
      providers: [
        {
          provide: SignalsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            updateSignalStatus: jest.fn(),
          },
        },
        {
          provide: I18nAppService,
          useValue: {
            translate: jest.fn((key: string) => Promise.resolve(key)),
          },
        },
      ],
    }).compile();

    controller = module.get<SignalsController>(SignalsController);
    service = module.get<SignalsService>(SignalsService);
    i18nService = module.get<I18nAppService>(I18nAppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSignal', () => {
    it('should create a signal successfully', async () => {
      const dto = createSignalDtoFactory({ providerId: 'user-123' });
      const signal = signalFactory();
      const req = { language: 'en' };

      jest.spyOn(service, 'create').mockResolvedValue(signal);

      const result = await controller.createSignal(dto, req);

      expect(result).toEqual(signal);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException on invalid price error', async () => {
      const dto = createSignalDtoFactory();
      const req = { language: 'en' };

      jest.spyOn(service, 'create').mockRejectedValue(new Error('Invalid price'));
      jest.spyOn(i18nService, 'translate').mockResolvedValue('Invalid price');

      await expect(controller.createSignal(dto, req)).rejects.toThrow(
        BadRequestException,
      );
      expect(i18nService.translate).toHaveBeenCalledWith('errors.INVALID_PRICE', 'en');
    });

    it('should throw BadRequestException on insufficient balance error', async () => {
      const dto = createSignalDtoFactory();
      const req = { language: 'en' };

      jest.spyOn(service, 'create').mockRejectedValue(new Error('Insufficient balance'));
      jest.spyOn(i18nService, 'translate').mockResolvedValue('Insufficient balance');

      await expect(controller.createSignal(dto, req)).rejects.toThrow(
        BadRequestException,
      );
      expect(i18nService.translate).toHaveBeenCalledWith(
        'errors.INSUFFICIENT_BALANCE',
        'en',
      );
    });

    it('should handle generic errors', async () => {
      const dto = createSignalDtoFactory();
      const req = { language: 'en' };

      jest.spyOn(service, 'create').mockRejectedValue(new Error('Generic error'));
      jest.spyOn(i18nService, 'translate').mockResolvedValue('Trade failed');

      await expect(controller.createSignal(dto, req)).rejects.toThrow(
        BadRequestException,
      );
      expect(i18nService.translate).toHaveBeenCalledWith('errors.TRADE_FAILED', 'en');
    });

    it('should use default language when not provided', async () => {
      const dto = createSignalDtoFactory();
      const req = {};

      jest.spyOn(service, 'create').mockRejectedValue(new Error('Error'));

      await expect(controller.createSignal(dto, req)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return all signals', async () => {
      const signals = [signalFactory(), signalFactory({ id: 'signal-456' })];

      jest.spyOn(service, 'findAll').mockResolvedValue(signals);

      const result = await controller.findAll();

      expect(result).toEqual(signals);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no signals exist', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('getSignal', () => {
    it('should return a signal by id', async () => {
      const signal = signalFactory();

      jest.spyOn(service, 'findOne').mockResolvedValue(signal);

      const result = await controller.getSignal('signal-123');

      expect(result).toEqual(signal);
      expect(service.findOne).toHaveBeenCalledWith('signal-123');
    });

    it('should throw NotFoundException when signal not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(controller.getSignal('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include signal id in error message', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(controller.getSignal('signal-123')).rejects.toThrow(
        'Signal with ID signal-123 not found',
      );
    });
  });
});
