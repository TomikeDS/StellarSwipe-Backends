import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UsageTrackerService } from '../usage-tracker.service';

@Injectable()
export class UsageTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UsageTrackingMiddleware.name);

  constructor(private readonly usageTracker: UsageTrackerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const apiKeyId = req.headers['x-api-key'] as string;
    if (!apiKeyId) {
      next();
      return;
    }

    const start = Date.now();
    const user = (req as any).user;

    res.on('finish', () => {
      const responseTimeMs = Date.now() - start;
      this.usageTracker
        .track({
          apiKeyId,
          userId: user?.id ?? 'anonymous',
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTimeMs,
          ipAddress: this.getIP(req),
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
        })
        .catch((err) => this.logger.error(`Usage tracking failed: ${err.message}`));
    });

    next();
  }

  private getIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return (forwarded as string).split(',')[0].trim();
    return (req.headers['x-real-ip'] as string) || req.socket.remoteAddress || '127.0.0.1';
  }
}
