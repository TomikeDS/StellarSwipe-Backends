import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { VersionManagerService } from './version-manager.service';
import { VersionResolverMiddleware } from './middleware/version-resolver.middleware';

@Module({
  providers: [VersionManagerService],
  exports: [VersionManagerService],
})
export class VersioningModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VersionResolverMiddleware)
      .forRoutes('*');
  }
}
