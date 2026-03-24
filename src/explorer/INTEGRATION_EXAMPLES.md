# Explorer Integration Examples

This document shows how to integrate explorer links into your existing API responses.

## Trade Response Enhancement

### Before
```typescript
{
  id: "123",
  txHash: "abc123def456...",
  fromAccount: "GABC123...",
  toAccount: "GDEF456...",
  amount: "100",
  asset: "USDC"
}
```

### After
```typescript
{
  id: "123",
  txHash: "abc123def456...",
  explorerLink: "https://stellar.expert/explorer/public/tx/abc123def456...",
  fromAccount: "GABC123...",
  fromAccountLink: "https://stellar.expert/explorer/public/account/GABC123...",
  toAccount: "GDEF456...",
  toAccountLink: "https://stellar.expert/explorer/public/account/GDEF456...",
  amount: "100",
  asset: "USDC"
}
```

## Implementation in TradesController

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { ExplorerService } from '../explorer/explorer.service';
import { TradesService } from './trades.service';

@Controller('trades')
export class TradesController {
  constructor(
    private readonly tradesService: TradesService,
    private readonly explorerService: ExplorerService,
  ) {}

  @Get(':id')
  async getTrade(@Param('id') id: string) {
    const trade = await this.tradesService.findOne(id);
    
    return {
      ...trade,
      explorerLink: this.explorerService.generateTransactionLink(trade.txHash),
      fromAccountLink: this.explorerService.generateAccountLink(trade.fromAccount),
      toAccountLink: this.explorerService.generateAccountLink(trade.toAccount),
    };
  }
}
```

## User Profile Enhancement

```typescript
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly explorerService: ExplorerService,
  ) {}

  @Get(':id/profile')
  async getProfile(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    
    return {
      ...user,
      stellarAccount: user.publicKey,
      accountExplorerLink: this.explorerService.generateAccountLink(user.publicKey),
    };
  }
}
```

## Asset Information Enhancement

```typescript
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly explorerService: ExplorerService,
  ) {}

  @Get(':code')
  async getAsset(@Param('code') code: string) {
    const asset = await this.assetsService.findByCode(code);
    
    const verification = await this.explorerService.verifyAssetIssuer(
      asset.code,
      asset.issuer,
    );
    
    return {
      ...asset,
      explorerLink: verification.explorerLink,
      issuerVerified: verification.verified,
      issuerLink: this.explorerService.generateAccountLink(asset.issuer),
    };
  }
}
```

## Transaction History Enhancement

```typescript
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly explorerService: ExplorerService,
  ) {}

  @Get('history')
  async getHistory(@Query('account') account: string) {
    const transactions = await this.transactionsService.findByAccount(account);
    
    return transactions.map(tx => ({
      ...tx,
      explorerLink: this.explorerService.generateTransactionLink(tx.hash),
    }));
  }
}
```

## Module Integration

Add ExplorerModule to your feature modules:

```typescript
import { Module } from '@nestjs/common';
import { ExplorerModule } from '../explorer/explorer.module';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';

@Module({
  imports: [ExplorerModule],
  controllers: [TradesController],
  providers: [TradesService],
})
export class TradesModule {}
```

## Interceptor for Automatic Link Generation

Create an interceptor to automatically add explorer links:

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExplorerService } from '../explorer/explorer.service';

@Injectable()
export class ExplorerLinkInterceptor implements NestInterceptor {
  constructor(private explorerService: ExplorerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        if (data && typeof data === 'object') {
          return this.addExplorerLinks(data);
        }
        return data;
      }),
    );
  }

  private addExplorerLinks(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.addExplorerLinks(item));
    }

    if (data && typeof data === 'object') {
      const enhanced = { ...data };

      // Add transaction link
      if (enhanced.txHash && !enhanced.explorerLink) {
        enhanced.explorerLink = this.explorerService.generateTransactionLink(
          enhanced.txHash,
        );
      }

      // Add account links
      if (enhanced.fromAccount && !enhanced.fromAccountLink) {
        enhanced.fromAccountLink = this.explorerService.generateAccountLink(
          enhanced.fromAccount,
        );
      }

      if (enhanced.toAccount && !enhanced.toAccountLink) {
        enhanced.toAccountLink = this.explorerService.generateAccountLink(
          enhanced.toAccount,
        );
      }

      return enhanced;
    }

    return data;
  }
}
```

Apply the interceptor globally or to specific controllers:

```typescript
// Global
app.useGlobalInterceptors(new ExplorerLinkInterceptor(explorerService));

// Controller-specific
@UseInterceptors(ExplorerLinkInterceptor)
@Controller('trades')
export class TradesController {}
```

## WebSocket Events Enhancement

```typescript
@WebSocketGateway()
export class TradesGateway {
  constructor(private explorerService: ExplorerService) {}

  @SubscribeMessage('trade-executed')
  handleTradeExecuted(client: Socket, payload: any) {
    const enhancedPayload = {
      ...payload,
      explorerLink: this.explorerService.generateTransactionLink(payload.txHash),
    };
    
    this.server.emit('trade-executed', enhancedPayload);
  }
}
```

## Error Handling

Handle cases where explorer links cannot be generated:

```typescript
@Get(':id')
async getTrade(@Param('id') id: string) {
  const trade = await this.tradesService.findOne(id);
  
  let explorerLink = '';
  try {
    explorerLink = this.explorerService.generateTransactionLink(trade.txHash);
  } catch (error) {
    this.logger.warn(`Failed to generate explorer link: ${error.message}`);
  }
  
  return {
    ...trade,
    explorerLink: explorerLink || null,
  };
}
```
