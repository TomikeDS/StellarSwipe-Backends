# Unit Testing Guide

## Overview

Comprehensive unit testing setup with >80% code coverage target using Jest and NestJS testing utilities.

## Test Structure

```
test/
├── utils/
│   ├── test-helpers.ts      # Mock factories and utilities
│   └── mock-factories.ts    # Data factories
└── setup.ts                 # Global test setup

src/
└── [module]/
    ├── [module].service.spec.ts
    └── [module].controller.spec.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# Debug mode
npm run test:debug
```

## Coverage Targets

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## Test Helpers

### Mock Repository

```typescript
import { createMockRepository } from '../../test/utils/test-helpers';

const mockRepo = createMockRepository<Entity>();
mockRepo.find.mockResolvedValue([]);
```

### Mock Cache

```typescript
import { createMockCache } from '../../test/utils/test-helpers';

const mockCache = createMockCache();
mockCache.get.mockResolvedValue('value');
```

### Mock Config Service

```typescript
import { createMockConfigService } from '../../test/utils/test-helpers';

const mockConfig = createMockConfigService({
  'app.port': 3000,
  'database.host': 'localhost',
});
```

## Data Factories

### User Factory

```typescript
import { userFactory } from '../../test/utils/mock-factories';

const user = userFactory({ username: 'custom' });
```

### Signal Factory

```typescript
import { signalFactory } from '../../test/utils/mock-factories';

const signal = signalFactory({ entryPrice: '0.095' });
```

### Trade Factory

```typescript
import { tradeFactory } from '../../test/utils/mock-factories';

const trade = tradeFactory({ amount: '100' });
```

## Test Structure Pattern

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockRepository: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    mockRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: getRepositoryToken(Entity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle happy path', async () => {
      // Arrange
      const input = {};
      mockRepository.save.mockResolvedValue({});

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle edge case', async () => {
      // Test edge case
    });

    it('should handle errors', async () => {
      mockRepository.save.mockRejectedValue(new Error('DB error'));

      await expect(service.methodName({})).rejects.toThrow('DB error');
    });
  });
});
```

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('should create user', async () => {
  // Arrange
  const dto = { username: 'test' };
  mockRepo.save.mockResolvedValue(userFactory());

  // Act
  const result = await service.create(dto);

  // Assert
  expect(result).toBeDefined();
});
```

### 2. Test Isolation

```typescript
afterEach(() => {
  jest.clearAllMocks(); // Clear all mocks after each test
});
```

### 3. Mock External Dependencies

```typescript
// Mock database
const mockRepo = createMockRepository();

// Mock cache
const mockCache = createMockCache();

// Mock external services
const mockStellarService = {
  submitTransaction: jest.fn(),
};
```

### 4. Test Edge Cases

```typescript
describe('edge cases', () => {
  it('should handle null input', async () => {
    await expect(service.method(null)).rejects.toThrow();
  });

  it('should handle undefined input', async () => {
    await expect(service.method(undefined)).rejects.toThrow();
  });

  it('should handle empty string', async () => {
    await expect(service.method('')).rejects.toThrow();
  });

  it('should handle negative numbers', async () => {
    await expect(service.method(-1)).rejects.toThrow();
  });

  it('should handle boundary values', async () => {
    const result = await service.method(Number.MAX_SAFE_INTEGER);
    expect(result).toBeDefined();
  });
});
```

### 5. Test Error Handling

```typescript
it('should handle database errors', async () => {
  mockRepo.save.mockRejectedValue(new Error('Connection failed'));

  await expect(service.create({})).rejects.toThrow('Connection failed');
});

it('should handle validation errors', async () => {
  await expect(service.create({ invalid: 'data' })).rejects.toThrow(
    BadRequestException,
  );
});
```

## Common Test Scenarios

### Testing Services

```typescript
describe('SignalsService', () => {
  it('should create signal', async () => {
    const dto = createSignalDtoFactory();
    mockRepo.save.mockResolvedValue(signalFactory());

    const result = await service.create(dto);

    expect(result).toBeDefined();
  });

  it('should find signal by id', async () => {
    mockRepo.findOneBy.mockResolvedValue(signalFactory());

    const result = await service.findOne('id');

    expect(result).toBeDefined();
  });

  it('should return null when not found', async () => {
    mockRepo.findOneBy.mockResolvedValue(null);

    const result = await service.findOne('id');

    expect(result).toBeNull();
  });
});
```

### Testing Controllers

```typescript
describe('SignalsController', () => {
  it('should create signal', async () => {
    const dto = createSignalDtoFactory();
    jest.spyOn(service, 'create').mockResolvedValue(signalFactory());

    const result = await controller.create(dto);

    expect(result).toBeDefined();
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should throw NotFoundException', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(null);

    await expect(controller.findOne('id')).rejects.toThrow(NotFoundException);
  });
});
```

### Testing Guards

```typescript
describe('ApiKeyAuthGuard', () => {
  it('should allow valid API key', async () => {
    const context = createMockExecutionContext();
    jest.spyOn(service, 'verify').mockResolvedValue(apiKeyFactory());

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should reject invalid API key', async () => {
    const context = createMockExecutionContext();
    jest.spyOn(service, 'verify').mockRejectedValue(new UnauthorizedException());

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
```

## Coverage Exclusions

The following are excluded from coverage:

- `*.spec.ts` - Test files
- `*.interface.ts` - Type definitions
- `*.dto.ts` - Data transfer objects
- `*.entity.ts` - Database entities
- `*.module.ts` - Module definitions
- `main.ts` - Application bootstrap
- `*.config.ts` - Configuration files
- `migrations/**` - Database migrations

## CI Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Troubleshooting

### Tests Timing Out

```typescript
jest.setTimeout(10000); // Increase timeout
```

### Flaky Tests

```typescript
// Use fake timers
jest.useFakeTimers();
jest.setSystemTime(new Date('2024-01-01'));

// Cleanup
jest.useRealTimers();
```

### Mock Not Working

```typescript
// Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Reset mocks completely
afterEach(() => {
  jest.resetAllMocks();
});
```

## Examples

See test files:
- `src/signals/signals.service.spec.ts`
- `src/signals/signals.controller.spec.ts`
- `src/users/users.service.spec.ts`
- `src/api-keys/api-keys.service.spec.ts`
