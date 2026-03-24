# Signal Versioning & Updates

Complete implementation of signal versioning that tracks all changes to signals while maintaining original version for accountability.

## Features

- ✅ Signal version tracking with immutable history
- ✅ Update restrictions (max 5 updates, 1-hour cooldown)
- ✅ Copier approval workflow for updates
- ✅ Auto-apply for copiers with auto-adjust enabled
- ✅ Version history queries
- ✅ Track which version users copied
- ✅ Prevent retroactive changes

## API Endpoints

### Update Signal (Provider)

```http
PATCH /api/v1/signals/:signalId/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetPrice": "150.50",
  "stopLossPrice": "85.00",
  "entryPrice": "100.00",
  "rationale": "Updated analysis based on market conditions",
  "requiresApproval": false
}
```

**Response:**
```json
{
  "signalId": "uuid",
  "newVersion": 2,
  "requiresApproval": false,
  "changeSummary": "Target: 120 → 150.50; Stop Loss: 90 → 85",
  "copiersNotified": 15
}
```

### Get Version History

```http
GET /api/v1/signals/:signalId/versions
```

**Response:**
```json
{
  "signalId": "uuid",
  "totalVersions": 3,
  "versions": [
    {
      "versionNumber": 3,
      "entryPrice": "100.00",
      "targetPrice": "150.50",
      "stopLossPrice": "85.00",
      "rationale": "Updated analysis",
      "changeSummary": "Target: 140 → 150.50",
      "requiresApproval": false,
      "approvedCount": 0,
      "rejectedCount": 0,
      "autoAppliedCount": 12,
      "createdAt": "2024-01-20T10:30:00Z"
    }
  ]
}
```

### Respond to Update (Copier)

```http
POST /api/v1/signals/versions/:versionId/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "approved": true,
  "autoAdjust": true
}
```

**Response:**
```json
{
  "versionId": "uuid",
  "copierId": "uuid",
  "status": "approved",
  "autoAdjust": true
}
```

### Get Pending Approvals

```http
GET /api/v1/signals/pending-approvals
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "versionId": "uuid",
    "signalId": "uuid",
    "changeSummary": "Target: 120 → 150",
    "targetPrice": "150.00",
    "stopLossPrice": "90.00",
    "createdAt": "2024-01-20T10:00:00Z"
  }
]
```

### Get Copied Version

```http
GET /api/v1/signals/:signalId/copied-version
Authorization: Bearer <token>
```

**Response:**
```json
{
  "signalId": "uuid",
  "copiedVersion": 1
}
```

## Update Restrictions

### Maximum Updates
- **Limit:** 5 updates per signal
- **Reason:** Prevents excessive changes that could indicate unreliable signals
- **Error:** "Maximum 5 updates per signal reached"

### Cooldown Period
- **Duration:** 1 hour between updates
- **Reason:** Prevents spam and rapid changes
- **Error:** "Must wait X minutes before next update"

### Status Restrictions
- Cannot update inactive signals (CLOSED, EXPIRED, CANCELLED)
- Cannot update expired signals
- Only signal provider can update

### Immutable Fields
- Asset pair (baseAsset/counterAsset)
- Signal type (BUY/SELL)
- Provider ID

## Version Tracking

### Version Snapshots
Each version stores:
- Version number (incremental)
- Entry price
- Target price
- Stop loss price
- Rationale
- Change summary
- Timestamp
- Approval counts

### Change Summary
Automatically generated summary of changes:
```
Target: 120 → 150.50; Stop Loss: 90 → 85; Rationale updated
```

## Copier Workflow

### Auto-Apply (Default)
When `requiresApproval: false`:
1. Provider updates signal
2. All copiers automatically receive update
3. Recorded as `AUTO_APPLIED` status
4. No action required from copiers

### Approval Required
When `requiresApproval: true`:
1. Provider updates signal
2. Copiers receive notification
3. Copiers must approve/reject
4. Can enable auto-adjust for future updates

### Auto-Adjust Setting
- Copiers can enable auto-adjust per signal
- Future updates automatically applied
- Can be toggled when responding to updates

## Database Schema

### signal_versions
```sql
CREATE TABLE signal_versions (
  id UUID PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,
  version_number INT NOT NULL,
  entry_price DECIMAL(18,8),
  target_price DECIMAL(18,8),
  stop_loss_price DECIMAL(18,8),
  rationale TEXT,
  change_summary TEXT,
  requires_approval BOOLEAN DEFAULT false,
  approved_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  auto_applied_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signal_versions_signal_id ON signal_versions(signal_id);
CREATE INDEX idx_signal_versions_signal_id_version ON signal_versions(signal_id, version_number);
```

### signal_version_approvals
```sql
CREATE TABLE signal_version_approvals (
  id UUID PRIMARY KEY,
  signal_version_id UUID NOT NULL REFERENCES signal_versions(id) ON DELETE CASCADE,
  copier_id UUID NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'auto_applied') DEFAULT 'pending',
  auto_adjust BOOLEAN DEFAULT false,
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(signal_version_id, copier_id)
);

CREATE INDEX idx_signal_version_approvals_version_id ON signal_version_approvals(signal_version_id);
CREATE INDEX idx_signal_version_approvals_copier_id ON signal_version_approvals(copier_id);
```

## Testing

Run tests:
```bash
npm test src/signals/versions/signal-version.service.spec.ts
```

### Test Coverage
- ✅ Create new version
- ✅ Enforce maximum updates
- ✅ Enforce cooldown period
- ✅ Provider authorization
- ✅ Signal status validation
- ✅ Version history retrieval
- ✅ Copier approval/rejection
- ✅ Pending approvals query
- ✅ Duplicate response prevention
- ✅ Auto-apply workflow

## Edge Cases Handled

1. **Rapid Updates:** Cooldown enforced
2. **Retroactive Changes:** All versions immutable
3. **Multiple Versions:** Full history maintained
4. **Expired Signals:** Update rejected
5. **Duplicate Responses:** Prevented by unique constraint
6. **Non-copiers:** Authorization check
7. **Notification Failures:** Logged but don't break update

## Integration Example

```typescript
import { SignalVersionService } from './versions/signal-version.service';

// Provider updates signal
const result = await versionService.updateSignal(
  'signal-123',
  'provider-456',
  {
    targetPrice: '150.00',
    requiresApproval: false,
  }
);

// Copier views history
const history = await versionService.getVersionHistory('signal-123');

// Copier responds to update
await versionService.respondToUpdate(
  'version-789',
  'copier-012',
  { approved: true, autoAdjust: true }
);
```

## Validation Checklist

- [x] Signals can be updated with version tracking
- [x] All versions stored immutably
- [x] Version history queryable
- [x] User copy-version tracked
- [x] Update restrictions enforced
- [x] Unit tests cover versioning scenarios
- [x] Maximum 5 updates enforced
- [x] 1-hour cooldown enforced
- [x] Cannot change asset pair
- [x] Cannot change signal type
- [x] Copier notifications sent
- [x] Auto-apply workflow implemented
- [x] Approval workflow implemented

## Migration

Run migration:
```bash
npm run typeorm migration:run
```

Revert migration:
```bash
npm run typeorm migration:revert
```
