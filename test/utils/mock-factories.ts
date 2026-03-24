export const userFactory = (overrides: Partial<any> = {}) => ({
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  walletAddress: 'GABC123...',
  displayName: 'Test User',
  isActive: true,
  reputationScore: 100,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const signalFactory = (overrides: Partial<any> = {}) => ({
  id: 'signal-123',
  providerId: 'user-123',
  baseAsset: 'USDC',
  counterAsset: 'XLM',
  type: 'BUY',
  status: 'ACTIVE',
  entryPrice: '0.095',
  targetPrice: '0.105',
  stopLossPrice: '0.090',
  confidenceScore: 85,
  rationale: 'Test signal',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const tradeFactory = (overrides: Partial<any> = {}) => ({
  id: 'trade-123',
  userId: 'user-123',
  signalId: 'signal-123',
  status: 'PENDING',
  side: 'BUY',
  baseAsset: 'USDC',
  counterAsset: 'XLM',
  entryPrice: '0.095',
  amount: '100',
  totalValue: '9.5',
  feeAmount: '0.01',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const apiKeyFactory = (overrides: Partial<any> = {}) => ({
  id: 'key-123',
  userId: 'user-123',
  name: 'Test API Key',
  keyHash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
  scopes: ['read:signals', 'write:trades'],
  rateLimit: 1000,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

export const createSignalDtoFactory = (overrides: Partial<any> = {}) => ({
  baseAsset: 'USDC',
  counterAsset: 'XLM',
  type: 'BUY',
  entryPrice: '0.095',
  targetPrice: '0.105',
  stopLossPrice: '0.090',
  confidenceScore: 85,
  rationale: 'Test signal',
  ...overrides,
});

export const createTradeDtoFactory = (overrides: Partial<any> = {}) => ({
  signalId: 'signal-123',
  amount: '100',
  ...overrides,
});

export const createApiKeyDtoFactory = (overrides: Partial<any> = {}) => ({
  name: 'Test API Key',
  scopes: ['read:signals'],
  rateLimit: 1000,
  ...overrides,
});

export const providerFactory = (overrides: Partial<any> = {}) => ({
  id: 'provider-123',
  userId: 'user-123',
  displayName: 'Test Provider',
  bio: 'Test bio',
  totalSignals: 10,
  successRate: 75.5,
  followersCount: 100,
  isVerified: true,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

export const sessionFactory = (overrides: Partial<any> = {}) => ({
  id: 'session-123',
  userId: 'user-123',
  token: 'token-abc123',
  deviceInfo: 'Chrome/Linux',
  ipAddress: '127.0.0.1',
  isActive: true,
  expiresAt: new Date('2024-12-31'),
  createdAt: new Date('2024-01-01'),
  ...overrides,
});
