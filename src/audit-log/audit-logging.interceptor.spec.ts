import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditLoggingInterceptor, AUDIT_ACTION_KEY, AuditOptions, Audit } from './interceptors/audit-logging.interceptor';
import { AuditService } from './audit.service';
import { AuditAction, AuditStatus } from './entities/audit-log.entity';

const mockAuditService = () => ({
  log: jest.fn().mockResolvedValue({ id: 'log-uuid' }),
});

const mockReflector = () => ({
  get: jest.fn(),
});

const makeContext = (
  overrides: Partial<{
    user: any;
    params: any;
    headers: any;
    ip: string;
    path: string;
    method: string;
  }> = {},
): ExecutionContext => {
  const req = {
    user: overrides.user ?? { id: 'user-uuid' },
    params: overrides.params ?? { id: 'resource-123' },
    headers: {
      'user-agent': 'jest-test',
      'x-forwarded-for': overrides.ip ?? '10.0.0.1',
      ...(overrides.headers ?? {}),
    },
    ip: overrides.ip ?? '10.0.0.1',
    path: overrides.path ?? '/test',
    method: overrides.method ?? 'POST',
    socket: { remoteAddress: overrides.ip ?? '10.0.0.1' },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
};

const makeHandler = (result: any = { success: true }): CallHandler => ({
  handle: () => of(result),
});

const makeErrorHandler = (error = new Error('handler failed')): CallHandler => ({
  handle: () => throwError(() => error),
});

describe('AuditLoggingInterceptor', () => {
  let interceptor: AuditLoggingInterceptor;
  let auditService: ReturnType<typeof mockAuditService>;
  let reflector: ReturnType<typeof mockReflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggingInterceptor,
        { provide: AuditService, useFactory: mockAuditService },
        { provide: Reflector, useFactory: mockReflector },
      ],
    }).compile();

    interceptor = module.get(AuditLoggingInterceptor);
    auditService = module.get(AuditService);
    reflector = module.get(Reflector);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Passthrough when no @Audit() decorator ───────────────────────────

  it('should pass through without logging when handler has no @Audit() metadata', (done) => {
    reflector.get.mockReturnValue(undefined);
    const ctx = makeContext();
    const handler = makeHandler();

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual({ success: true });
      expect(auditService.log).not.toHaveBeenCalled();
      done();
    });
  });

  // ─── Successful request logging ───────────────────────────────────────

  it('should log a SUCCESS audit entry on successful handler', (done) => {
    const options: AuditOptions = { action: AuditAction.TRADE_EXECUTED, resource: 'trade' };
    reflector.get.mockReturnValue(options);
    const ctx = makeContext();

    interceptor.intercept(ctx, makeHandler()).subscribe(() => {
      // Allow microtask queue to flush (fire-and-forget)
      setImmediate(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.TRADE_EXECUTED,
            resource: 'trade',
            userId: 'user-uuid',
            status: AuditStatus.SUCCESS,
          }),
        );
        done();
      });
    });
  });

  // ─── Error request logging ────────────────────────────────────────────

  it('should log a FAILURE audit entry when handler throws', (done) => {
    const options: AuditOptions = { action: AuditAction.TRADE_EXECUTED };
    reflector.get.mockReturnValue(options);
    const ctx = makeContext();
    const error = new Error('Trade failed');

    interceptor.intercept(ctx, makeErrorHandler(error)).subscribe({
      error: () => {
        setImmediate(() => {
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              status: AuditStatus.FAILURE,
              errorMessage: 'Trade failed',
            }),
          );
          done();
        });
      },
    });
  });

  it('should re-throw the original error', (done) => {
    reflector.get.mockReturnValue({ action: AuditAction.LOGIN });
    const error = new Error('auth failed');

    interceptor.intercept(makeContext(), makeErrorHandler(error)).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        done();
      },
    });
  });

  // ─── IP extraction ────────────────────────────────────────────────────

  it('should extract IP from x-forwarded-for header', (done) => {
    reflector.get.mockReturnValue({ action: AuditAction.LOGIN });
    const ctx = makeContext({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } });

    interceptor.intercept(ctx, makeHandler()).subscribe(() => {
      setImmediate(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({ ipAddress: '203.0.113.5' }),
        );
        done();
      });
    });
  });

  // ─── userId extraction ────────────────────────────────────────────────

  it('should extract userId from user.sub when user.id is absent', (done) => {
    reflector.get.mockReturnValue({ action: AuditAction.LOGIN });
    const ctx = makeContext({ user: { sub: 'jwt-sub-uuid' } });

    interceptor.intercept(ctx, makeHandler()).subscribe(() => {
      setImmediate(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'jwt-sub-uuid' }),
        );
        done();
      });
    });
  });

  it('should handle unauthenticated requests (no user)', (done) => {
    reflector.get.mockReturnValue({ action: AuditAction.LOGIN_FAILED });
    const ctx = makeContext({ user: null });

    interceptor.intercept(ctx, makeHandler()).subscribe(() => {
      setImmediate(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({ userId: undefined }),
        );
        done();
      });
    });
  });

  // ─── Custom resourceId & metadata ────────────────────────────────────

  it('should use getResourceId callback when provided', (done) => {
    const options: AuditOptions = {
      action: AuditAction.PAYOUT_REQUESTED,
      getResourceId: (req) => req.params?.payoutId,
    };
    reflector.get.mockReturnValue(options);
    const ctx = makeContext({ params: { payoutId: 'payout-999' } });

    interceptor.intercept(ctx, makeHandler()).subscribe(() => {
      setImmediate(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({ resourceId: 'payout-999' }),
        );
        done();
      });
    });
  });

  it('should call getMetadata callback when provided', (done) => {
    const getMetadata = jest.fn().mockReturnValue({ amount: 100 });
    const options: AuditOptions = { action: AuditAction.TRADE_EXECUTED, getMetadata };
    reflector.get.mockReturnValue(options);

    interceptor.intercept(makeContext(), makeHandler()).subscribe(() => {
      setImmediate(() => {
        expect(getMetadata).toHaveBeenCalled();
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({ metadata: { amount: 100 } }),
        );
        done();
      });
    });
  });

  // ─── @Audit() decorator ───────────────────────────────────────────────

  describe('@Audit() decorator', () => {
    it('should define metadata on the method descriptor', () => {
      const options: AuditOptions = { action: AuditAction.LOGIN };
      const descriptor = { value: jest.fn() };

      Audit(options)(null, 'methodName', descriptor);

      expect(Reflect.getMetadata(AUDIT_ACTION_KEY, descriptor.value)).toEqual(options);
    });
  });
});
