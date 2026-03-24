# Blockchain Explorer Integration

This module provides integration with Stellar Expert blockchain explorer for transaction, account, and asset verification.

## Features

- Generate explorer URLs for transactions, accounts, and assets
- Automatic network detection (mainnet/testnet)
- Asset issuer verification
- Explorer availability checking

## Usage

### Import the Module

```typescript
import { ExplorerModule } from './explorer/explorer.module';

@Module({
  imports: [ExplorerModule],
})
export class AppModule {}
```

### Inject the Service

```typescript
import { ExplorerService } from './explorer/explorer.service';

@Injectable()
export class TradesService {
  constructor(private explorerService: ExplorerService) {}

  async getTrade(id: string) {
    const trade = await this.findTrade(id);
    
    return {
      ...trade,
      explorerLink: this.explorerService.generateTransactionLink(trade.txHash),
    };
  }
}
```

## API Examples

### Generate Transaction Link

```typescript
const link = explorerService.generateTransactionLink(
  'abc123def456...',
  'public'
);
// Returns: https://stellar.expert/explorer/public/tx/abc123def456...
```

### Generate Account Link

```typescript
const link = explorerService.generateAccountLink(
  'GABC123...',
  'testnet'
);
// Returns: https://stellar.expert/explorer/testnet/account/GABC123...
```

### Generate Asset Link

```typescript
const link = explorerService.generateAssetLink(
  'USDC',
  'GISSUER123...',
  'public'
);
// Returns: https://stellar.expert/explorer/public/asset/USDC-GISSUER123...
```

### Generate Multiple Links

```typescript
const links = explorerService.generateLinks({
  transaction: 'txhash123',
  account: 'GABC123',
  asset: 'USDC-GISSUER123',
  network: 'public',
});
```

### Verify Asset Issuer

```typescript
const verification = await explorerService.verifyAssetIssuer(
  'USDC',
  'GISSUER123...'
);
// Returns: { code, issuer, verified, explorerLink, domain? }
```

## Configuration

Set the Stellar network in your environment variables:

```env
STELLAR_NETWORK=testnet  # or 'public' for mainnet
```

## Network Detection

The service automatically detects the network from configuration. You can override it per request:

```typescript
// Use configured network
const link = explorerService.generateTransactionLink(txHash);

// Override network
const link = explorerService.generateTransactionLink(txHash, 'public');
```

## Error Handling

The service handles common edge cases:

- Invalid transaction hashes → returns empty string
- Invalid public keys → returns empty string
- Missing asset information → returns empty string
- Network mismatches → logs warning and uses configured network

## Integration with Trade Responses

Enhance your API responses with explorer links:

```typescript
{
  trade: {
    id: "123",
    txHash: "abc123...",
    explorerLink: "https://stellar.expert/explorer/public/tx/abc123...",
    fromAccount: "GABC...",
    fromAccountLink: "https://stellar.expert/explorer/public/account/GABC...",
    asset: {
      code: "USDC",
      issuer: "GISSUER...",
      explorerLink: "https://stellar.expert/explorer/public/asset/USDC-GISSUER..."
    }
  }
}
```

## Testing

Run the test suite:

```bash
npm test -- explorer.service.spec.ts
```

## Explorer Alternatives

While this module uses Stellar Expert by default, you can extend it to support other explorers:

- StellarChain: https://stellarchain.io
- Stellar.org Dashboard: https://dashboard.stellar.org

Simply modify the `baseUrls` in `explorer.service.ts`.
