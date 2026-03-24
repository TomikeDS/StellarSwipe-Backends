import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

export const createMockRepository = <T = any>(): jest.Mocked<Partial<Repository<T>>> => ({
  find: jest.fn() as any,
  findOne: jest.fn() as any,
  findOneBy: jest.fn() as any,
  save: jest.fn() as any,
  create: jest.fn() as any,
  update: jest.fn() as any,
  delete: jest.fn() as any,
  count: jest.fn() as any,
  restore: jest.fn() as any,
  softDelete: jest.fn() as any,
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
  })) as any,
});

export const createMockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
});

export const createMockConfigService = (config: Record<string, any> = {}) => ({
  get: jest.fn((key: string, defaultValue?: any) => {
    return config[key] ?? defaultValue;
  }),
  getOrThrow: jest.fn((key: string) => {
    if (!(key in config)) throw new Error(`Config key ${key} not found`);
    return config[key];
  }),
});

export const createMockLogger = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
});

export const createMockExecutionContext = () => ({
  switchToHttp: jest.fn().mockReturnValue({
    getRequest: jest.fn().mockReturnValue({
      headers: { 'x-api-key': 'test-key' },
      user: { id: 'user-123' },
    }),
    getResponse: jest.fn().mockReturnValue({
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }),
  }),
  getHandler: jest.fn(),
  getClass: jest.fn(),
});

export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const mockDate = (date: Date) => {
  jest.useFakeTimers();
  jest.setSystemTime(date);
};

export const restoreDate = () => {
  jest.useRealTimers();
};
