# API Keys Quick Start Guide

## Setup

### 1. Install Dependencies

```bash
npm install bcrypt @types/bcrypt
```

### 2. Run Migration

```bash
npm run typeorm migration:run
```

Or manually create the table:

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  "keyHash" VARCHAR(60) NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  "lastUsed" TIMESTAMP,
  "expiresAt" TIMESTAMP,
  "rateLimit" INTEGER DEFAULT 1000,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_keys_userId_createdAt ON api_keys("userId", "createdAt");
CREATE UNIQUE INDEX idx_api_key_hash ON api_keys("keyHash");
```

### 3. Verify Module Import

Check that `ApiKeysModule` is imported in `app.module.ts`:

```typescript
import { ApiKeysModule } from './api-keys/api-keys.module';

@Module({
  imports: [
    // ... other modules
    ApiKeysModule,
  ],
})
export class AppModule {}
```

## Usage

### Creating an API Key

```bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer <user-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Production API",
    "scopes": ["read:signals", "write:trades"],
    "rateLimit": 5000
  }'
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Production API",
  "key": "sk_live_a1b2c3d4e5f6...",
  "scopes": ["read:signals", "write:trades"],
  "rateLimit": 5000,
  "createdAt": "2026-02-23T20:49:17.000Z"
}
```

⚠️ **Important**: Save the `key` value immediately. It cannot be retrieved later.

### Using the API Key

```bash
curl http://localhost:3000/api/v1/signals \
  -H "Authorization: Bearer sk_live_a1b2c3d4e5f6..."
```

### Protecting Your Endpoints

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-keys/guards/api-key-auth.guard';
import { RequireScopes } from './api-keys/decorators/require-scopes.decorator';

@Controller('signals')
@UseGuards(ApiKeyAuthGuard)
export class SignalsController {
  @Get()
  @RequireScopes('read:signals')
  async getSignals() {
    return { signals: [] };
  }
}
```

### Checking Usage

```bash
curl http://localhost:3000/api/v1/api-keys/usage \
  -H "Authorization: Bearer <user-jwt-token>"
```

### Rotating a Key

```bash
curl -X POST http://localhost:3000/api/v1/api-keys/{keyId}/rotate \
  -H "Authorization: Bearer <user-jwt-token>"
```

### Revoking a Key

```bash
curl -X DELETE http://localhost:3000/api/v1/api-keys/{keyId} \
  -H "Authorization: Bearer <user-jwt-token>"
```

## Available Scopes

- `read:signals` - View trading signals
- `read:portfolio` - View portfolio data
- `write:trades` - Execute trades
- `write:signals` - Create trading signals

## Rate Limits

- Default: 1000 requests/hour
- Range: 100-10000 requests/hour
- Tracked per hour window
- Returns 403 when exceeded

## Testing

Run the test suite:

```bash
npm test -- api-keys.service.spec.ts
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Rotate keys regularly** (every 90 days recommended)
3. **Use minimal scopes** - only grant necessary permissions
4. **Monitor usage** - check for unusual patterns
5. **Revoke immediately** if compromised
6. **Set expiration dates** for temporary access

## Troubleshooting

### "Invalid API key format"

Ensure the key starts with `sk_live_` and is passed in the Authorization header:

```
Authorization: Bearer sk_live_...
```

### "Rate limit exceeded"

Wait for the next hour window or increase the rate limit for the key.

### "Insufficient permissions"

The API key doesn't have the required scope. Create a new key with the necessary scopes.

### "API key expired"

The key has passed its expiration date. Rotate or create a new key.

## Integration Examples

### Node.js

```javascript
const axios = require('axios');

const apiKey = 'sk_live_...';
const baseURL = 'http://localhost:3000/api/v1';

const client = axios.create({
  baseURL,
  headers: {
    'Authorization': `Bearer ${apiKey}`,
  },
});

// Get signals
const signals = await client.get('/signals');
console.log(signals.data);
```

### Python

```python
import requests

api_key = 'sk_live_...'
base_url = 'http://localhost:3000/api/v1'

headers = {
    'Authorization': f'Bearer {api_key}'
}

# Get signals
response = requests.get(f'{base_url}/signals', headers=headers)
print(response.json())
```

### cURL

```bash
#!/bin/bash
API_KEY="sk_live_..."
BASE_URL="http://localhost:3000/api/v1"

curl -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/signals"
```

## Production Checklist

- [ ] Database migration applied
- [ ] Redis/Cache configured
- [ ] Module imported in app.module.ts
- [ ] Endpoints protected with guards
- [ ] Rate limits configured appropriately
- [ ] Monitoring set up for usage tracking
- [ ] Documentation provided to API consumers
- [ ] Key rotation policy established
- [ ] Security audit completed
