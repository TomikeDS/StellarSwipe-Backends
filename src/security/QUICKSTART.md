# CSP Quick Start Guide

## Installation

No additional dependencies required - uses built-in Node.js crypto module.

## Setup

### 1. Environment Variables

Add to `.env`:

```bash
# CSP Configuration
CSP_ENABLED=true
CSP_REPORT_ONLY=true  # Start in report-only mode for testing

# Stellar endpoints (automatically whitelisted)
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

### 2. Verify Module Import

The SecurityModule is already imported in `app.module.ts`. Verify:

```typescript
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    // ... other modules
    SecurityModule,
  ],
})
export class AppModule {}
```

### 3. Start Application

```bash
npm run start:dev
```

## Testing

### Test CSP Headers

```bash
curl -I http://localhost:3000/api/v1/health
```

Expected output:
```
HTTP/1.1 200 OK
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'nonce-abc123...'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Test Violation Reporting

1. Open browser console on your app
2. Try to execute unsafe code:
   ```javascript
   eval('console.log("test")');
   ```
3. Check server logs for violation report

### View Violations

```bash
# In development, violations are logged
# Check your console output for:
# [Nest] WARN [CspReporterController] CSP Violation Detected
```

## Using Nonces in Templates

If serving HTML with inline scripts:

```typescript
@Get('page')
renderPage(@Req() req: Request) {
  const nonce = (req as any).cspNonce;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <script nonce="${nonce}">
          console.log('This script is allowed');
        </script>
      </head>
      <body>
        <h1>Hello World</h1>
      </body>
    </html>
  `;
}
```

## Switching to Enforcement Mode

After testing in report-only mode for 24-48 hours:

1. Update `.env`:
   ```bash
   CSP_REPORT_ONLY=false
   ```

2. Restart application:
   ```bash
   npm run start:dev
   ```

3. Verify enforcement:
   ```bash
   curl -I http://localhost:3000/api/v1/health | grep Content-Security-Policy
   ```

   Should show `Content-Security-Policy:` (not `Content-Security-Policy-Report-Only:`)

## Adding External Resources

### CDN Scripts

Edit `src/security/config/csp.config.ts`:

```typescript
'script-src': [
  "'self'",
  "'nonce-{random}'",
  'https://cdn.jsdelivr.net',  // Add your CDN
],
```

### External APIs

```typescript
'connect-src': [
  "'self'",
  process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  'https://api.example.com',  // Add your API
],
```

### External Images

```typescript
'img-src': [
  "'self'",
  'data:',
  'https:',  // Already allows all HTTPS images
  // Or be specific:
  // 'https://images.example.com',
],
```

## Common Issues

### Issue: Scripts Not Loading

**Symptom**: Console shows CSP violation for scripts

**Solution**: 
1. Add nonce to inline scripts
2. Whitelist external script domains
3. Check browser console for specific blocked URI

### Issue: API Calls Blocked

**Symptom**: Network requests fail with CSP error

**Solution**: Add API domain to `connect-src` directive

### Issue: Styles Not Applied

**Symptom**: Inline styles blocked

**Solution**: Already allowed with `'unsafe-inline'` in default config

### Issue: Too Many Violations

**Symptom**: Logs flooded with violations

**Solution**:
1. Stay in report-only mode
2. Review violations
3. Adjust directives
4. Test thoroughly

## Production Deployment

### Pre-Deployment Checklist

- [ ] Tested in report-only mode for 24-48 hours
- [ ] Reviewed all violation reports
- [ ] Whitelisted all necessary external resources
- [ ] Tested all critical user flows
- [ ] Verified nonces work correctly

### Deployment Steps

1. Set `CSP_REPORT_ONLY=false`
2. Deploy to staging
3. Run smoke tests
4. Monitor for violations
5. Deploy to production
6. Monitor closely for first 24 hours

### Monitoring

Set up alerts for:
- High volume of violations (>100/hour)
- New violation types
- Violations from production URLs

## Testing Checklist

- [ ] CSP headers present in responses
- [ ] Nonce generated per request
- [ ] Nonce changes between requests
- [ ] X-Frame-Options header set
- [ ] X-Content-Type-Options header set
- [ ] Violation reporting works
- [ ] External resources load correctly
- [ ] Inline scripts work with nonce
- [ ] API calls succeed

## Performance

- **Overhead**: ~1ms per request
- **Memory**: Minimal (nonce generation)
- **CPU**: Negligible
- **Network**: No additional requests

## Security Benefits

✅ Prevents XSS attacks  
✅ Blocks clickjacking  
✅ Controls resource loading  
✅ Prevents MIME sniffing  
✅ Limits information leakage  

## Next Steps

1. Monitor violations in report-only mode
2. Adjust directives as needed
3. Switch to enforcement mode
4. Set up production monitoring
5. Regular security audits

## Support

For issues or questions:
1. Check `src/security/README.md` for detailed documentation
2. Review violation logs
3. Test with browser developer tools
4. Verify configuration in `src/security/config/csp.config.ts`
