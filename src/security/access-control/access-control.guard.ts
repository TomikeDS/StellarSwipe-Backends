import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  //   UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from './access-control.service';

/** Decorate controller/handler with @SkipAccessControl() to bypass this guard */
export const SKIP_ACCESS_CONTROL_KEY = 'skipAccessControl';
export const SkipAccessControl = () =>
  Reflect.metadata(SKIP_ACCESS_CONTROL_KEY, true);

@Injectable()
export class AccessControlGuard implements CanActivate {
  private readonly logger = new Logger(AccessControlGuard.name);

  constructor(
    private readonly accessControl: AccessControlService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow skipping for public endpoints like /health, /auth/login, etc.
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_ACCESS_CONTROL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id ?? request.user?.userId;

    // If there's no authenticated user yet, let the auth guard handle it
    if (!userId) return true;

    const ipAddress = this.extractIp(request);
    const userAgent = request.headers['user-agent'];
    const requestPath = request.path;

    // checkAccess throws UnauthorizedException if blocked
    await this.accessControl.checkAccess({
      userId,
      ipAddress,
      userAgent,
      requestPath,
    });

    return true;
  }

  private extractIp(request: any): string {
    // Respect common reverse proxy headers
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',').map((ip) => ip.trim());
      // Take the first (client) IP — not the proxy chain
      return ips[0];
    }
    return (
      request.headers['x-real-ip'] ??
      request.ip ??
      request.socket?.remoteAddress ??
      '0.0.0.0'
    );
  }
}
