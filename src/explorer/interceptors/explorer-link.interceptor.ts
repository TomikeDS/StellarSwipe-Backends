import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExplorerService } from '../explorer.service';
import {
  ADD_EXPLORER_LINKS_KEY,
  ExplorerLinkConfig,
} from '../decorators/add-explorer-links.decorator';

@Injectable()
export class ExplorerLinkInterceptor implements NestInterceptor {
  constructor(
    private explorerService: ExplorerService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const config = this.reflector.get<ExplorerLinkConfig>(
      ADD_EXPLORER_LINKS_KEY,
      context.getHandler(),
    );

    if (!config) {
      return next.handle();
    }

    return next.handle().pipe(
      map(data => {
        if (!data) return data;
        return this.addExplorerLinks(data, config);
      }),
    );
  }

  private addExplorerLinks(data: any, config: ExplorerLinkConfig): any {
    if (Array.isArray(data)) {
      return data.map(item => this.addExplorerLinks(item, config));
    }

    if (data && typeof data === 'object') {
      const enhanced = { ...data };

      // Add transaction link
      if (config.txHashField && enhanced[config.txHashField]) {
        enhanced.explorerLink = this.explorerService.generateTransactionLink(
          enhanced[config.txHashField],
        );
      }

      // Add account links
      config.accountFields?.forEach(field => {
        if (enhanced[field]) {
          const linkField = `${field}Link`;
          enhanced[linkField] = this.explorerService.generateAccountLink(
            enhanced[field],
          );
        }
      });

      // Add asset links
      config.assetFields?.forEach(field => {
        if (enhanced[field] && typeof enhanced[field] === 'object') {
          const asset = enhanced[field];
          if (asset.code && asset.issuer) {
            asset.explorerLink = this.explorerService.generateAssetLink(
              asset.code,
              asset.issuer,
            );
          }
        }
      });

      return enhanced;
    }

    return data;
  }
}
