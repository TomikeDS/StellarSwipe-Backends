# Quick Start Guide

Get explorer links in your API responses in 3 easy steps.

## Step 1: Import ExplorerModule

Add to your feature module:

```typescript
import { Module } from '@nestjs/common';
import { ExplorerModule } from '../explorer/explorer.module';

@Module({
  imports: [ExplorerModule],
  // ... rest of your module
})
export class TradesModule {}
```

## Step 2: Use the Decorator

Add `@AddExplorerLinks()` to your controller methods:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { AddExplorerLinks } from '../explorer/decorators/add-explorer-links.decorator';

@Controller('trades')
export class TradesController {
  @Get(':id')
  @AddExplorerLinks({
    txHashField: 'txHash',
    accountFields: ['fromAccount', 'toAccount'],
  })
  async getTrade(@Param('id') id: string) {
    // Your existing code - no changes needed!
    return this.tradesService.findOne(id);
  }
}
```

## Step 3: Apply the Interceptor

Add to your module providers:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ExplorerModule } from '../explorer/explorer.module';
import { ExplorerLinkInterceptor } from '../explorer/interceptors/explorer-link.interceptor';

@Module({
  imports: [ExplorerModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ExplorerLinkInterceptor,
    },
  ],
})
export class TradesModule {}
```

## That's It!

Your API response will now automatically include explorer links:

### Before
```json
{
  "id": "123",
  "txHash": "abc123...",
  "fromAccount": "GABC...",
  "toAccount": "GDEF..."
}
```

### After
```json
{
  "id": "123",
  "txHash": "abc123...",
  "explorerLink": "https://stellar.expert/explorer/public/tx/abc123...",
  "fromAccount": "GABC...",
  "fromAccountLink": "https://stellar.expert/explorer/public/account/GABC...",
  "toAccount": "GDEF...",
  "toAccountLink": "https://stellar.expert/explorer/public/account/GDEF..."
}
```

## Manual Usage

If you prefer manual control:

```typescript
import { ExplorerService } from '../explorer/explorer.service';

@Injectable()
export class TradesService {
  constructor(private explorerService: ExplorerService) {}

  async getTrade(id: string) {
    const trade = await this.findOne(id);
    
    return {
      ...trade,
      explorerLink: this.explorerService.generateTransactionLink(trade.txHash),
    };
  }
}
```

## Configuration

Set your network in `.env`:

```env
STELLAR_NETWORK=testnet  # or 'public' for mainnet
```

## API Endpoints

The module also provides direct API endpoints:

- `GET /explorer/transaction/:hash` - Get transaction link
- `GET /explorer/account/:publicKey` - Get account link
- `GET /explorer/asset/:code/:issuer` - Get asset link
- `GET /explorer/verify-asset/:code/:issuer` - Verify asset issuer
- `GET /explorer/health` - Check explorer availability

## Advanced Configuration

Customize which fields get enhanced:

```typescript
@AddExplorerLinks({
  txHashField: 'transactionHash',  // Custom field name
  accountFields: ['sender', 'receiver', 'trader'],  // Multiple accounts
  assetFields: ['baseAsset', 'quoteAsset'],  // Asset objects
})
```

## Network Override

Override network per request:

```typescript
const link = this.explorerService.generateTransactionLink(
  txHash,
  'public'  // Force mainnet
);
```
