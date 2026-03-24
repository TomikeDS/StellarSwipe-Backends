# E2E Test Scenarios

## Onboarding Flow
**Journey:** Visit app → Connect wallet → View feed → Execute trade → Check portfolio

**Steps:**
1. Connect wallet (Freighter mock)
2. Register user with wallet address
3. View signal feed
4. View portfolio

**Edge Cases:**
- Invalid wallet address
- Duplicate registration
- Network timeout

## Copy Trading Flow
**Journey:** Login → Browse signals → Swipe right → Trade executes → Receive notification

**Steps:**
1. Connect wallet
2. View signal feed
3. Execute trade on signal
4. Wait for confirmation
5. Check trade status
6. Verify portfolio update

**Edge Cases:**
- Invalid signal ID
- Insufficient balance
- Trade execution failure
- Network failure mid-trade

## Provider Flow
**Journey:** Create signal → Submit → AI validates → Signal appears in feed → Users copy → Track performance

**Steps:**
1. Connect wallet
2. Create signal with valid data
3. Verify signal in feed
4. Check provider stats
5. Update signal status

**Edge Cases:**
- Invalid signal data
- Low confidence score rejection
- Duplicate signal
- AI validation failure

## Payout Flow
**Journey:** Check earnings → Request payout → Payment processes → Balance updates

**Steps:**
1. Connect wallet
2. Check earnings balance
3. Request payout
4. Wait for processing
5. Check payout status
6. Verify balance updated

**Edge Cases:**
- Insufficient balance
- Below minimum payout
- Invalid wallet address
- Network failure during payout
- Concurrent payout requests

## Test Execution

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Flow
```bash
npm test -- test/e2e/onboarding.e2e-spec.ts
npm test -- test/e2e/copy-trading.e2e-spec.ts
npm test -- test/e2e/provider-flow.e2e-spec.ts
npm test -- test/e2e/payout.e2e-spec.ts
```

### Before Deployment
```bash
npm run test:e2e:ci
```

## Validation Checklist

- [ ] All critical flows complete successfully
- [ ] Error scenarios handled gracefully
- [ ] Database end states consistent
- [ ] Wallet interactions mocked correctly
- [ ] Stellar testnet integration works
- [ ] Timeouts handled appropriately
- [ ] Race conditions prevented
- [ ] Network failures recovered
