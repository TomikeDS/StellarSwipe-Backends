# API Keys Module

Developer API key management system for third-party integrations with StellarSwipe.

## Features

- **Secure Key Generation**: 32-byte random keys with `sk_live_` prefix
- **Hashed Storage**: Keys hashed with bcrypt before storage
- **Permission Scopes**: Granular access control
- **Rate Limiting**: Per-key hourly limits
- **Usage Tracking**: Request and error metrics
- **Key Rotation**: Seamless key updates
- **Expiration Support**: Optional key expiry

## Permission Scopes

- `read:signals` - View trading signals
- `read:portfolio` - View portfolio data
- `write:trades` - Execute trades
- `write:signals` - Create trading signals

## API Endpoints

### Create API Key

```http
POST /api/v1/api-keys
Authorization: Bearer <user-jwt-token>
Content-Type: application/json

{
  "name": "Production API",
  "scopes": ["read:signals", "write:trades"],
  "rateLimit": 5000,
  "expiresAt": "2027-12-31T23:59:59Z"
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "Production API",
  "key": "sk_live_abc123...",
  "scopes": ["read:signals", "write:trades"],
  "rateLimit": 5000,
  "expiresAt": "2027-12-31T23:59:59.000Z",
  "createdAt": "2026-02-23T20:49:17.000Z"
}
```

### List API Keys

```http
GET /api/v1/api-keys
Authorization: Bearer <user-jwt-token>
```

### Get Usage Statistics

```http
GET /api/v1/api-keys/usage
Authorization: Bearer <user-jwt-token>
```

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Production API",
    "scopes": ["read:signals", "write:trades"],
    "lastUsed": "2026-02-23T20:45:00.000Z",
    "expiresAt": null,
    "rateLimit": 5000,
    "createdAt": "2026-02-23T10:00:00.000Z",
    "requestCount": 1234,
    "errorCount": 5
  }
]
```

### Rotate API Key

```http
POST /api/v1/api-keys/:id/rotate
Authorization: Bearer <user-jwt-token>
```

Returns new key with same configuration.

### Revoke API Key

```http
DELETE /api/v1/api-keys/:id
Authorization: Bearer <user-jwt-token>
```

## Using API Keys

### Authentication

Include API key in Authorization header:

```http
GET /api/v1/signals
Authorization: Bearer sk_live_abc123...
```

### Protecting Endpoints

Use the `ApiKeyAuthGuard` and `RequireScopes` decorator:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyAuthGuard } from '../api-keys/guards/api-key-auth.guard';
import { RequireScopes } from '../api-keys/decorators/require-scopes.decorator';

@Controller('signals')
@UseGuards(ApiKeyAuthGuard)
export class SignalsController {
  @Get()
  @RequireScopes('read:signals')
  async getSignals() {
    // Only accessible with read:signals scope
  }

  @Post()
  @RequireScopes('write:signals')
  async createSignal() {
    // Only accessible with write:signals scope
  }
}
```

### Accessing API Key in Request

```typescript
@Get()
async getSignals(@Request() req: any) {
  const apiKey = req.apiKey; // ApiKey entity
  const userId = req.userId; // User ID from API key
}
```

## Rate Limiting

- Default: 1000 requests/hour
- Configurable per key (100-10000)
- Tracked per hour window
- Returns 403 when exceeded

## Usage Tracking

Automatically tracks:

- Total requests per hour
- Error count per hour
- Endpoints accessed
- Last used timestamp

Data retained for 7 days.

## Security

### Key Storage

- Raw keys never stored
- Bcrypt hashing (10 rounds)
- Unique index on hash

### Key Format

```
sk_live_<64-character-hex>
```

### Validation

- Keys verified on each request
- Expiration checked
- Scopes enforced
- Rate limits applied

## Edge Cases Handled

### Compromised Keys

- Immediate revocation via DELETE endpoint
- Key rotation without downtime
- Usage tracking for audit

### Scope Creep

- Validation on creation
- Only predefined scopes allowed
- Scope changes require new key

### Active Usage Rotation

- Old key works until rotation complete
- New key returned immediately
- No service interruption

## Database Schema

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  keyHash VARCHAR(60) NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL,
  lastUsed TIMESTAMP,
  expiresAt TIMESTAMP,
  rateLimit INTEGER DEFAULT 1000,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_keys_userId_createdAt ON api_keys(userId, createdAt);
CREATE UNIQUE INDEX idx_api_key_hash ON api_keys(keyHash);
```

## Redis Keys

- `ratelimit:apikey:{keyId}:{hour}` - Rate limit counter
- `usage:{keyId}:{hour}` - Usage statistics hash
- `usage:{keyId}:endpoints` - Accessed endpoints set

## Testing

```bash
# Create test key
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Key",
    "scopes": ["read:signals"],
    "rateLimit": 100
  }'

# Use API key
curl http://localhost:3000/api/v1/signals \
  -H "Authorization: Bearer sk_live_..."

# Check usage
curl http://localhost:3000/api/v1/api-keys/usage \
  -H "Authorization: Bearer <user-token>"
```

## Environment Variables

No additional environment variables required. Uses existing Redis and PostgreSQL configuration.

## Migration

Run TypeORM migration to create `api_keys` table:

```bash
npm run typeorm migration:generate src/migrations/CreateApiKeysTable
npm run typeorm migration:run
```
