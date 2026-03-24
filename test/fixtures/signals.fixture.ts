export const signalFixture = (overrides = {}) => ({
  baseAsset: 'USDC',
  counterAsset: 'XLM',
  type: 'BUY',
  entryPrice: '0.095',
  targetPrice: '0.105',
  stopLossPrice: '0.090',
  confidenceScore: 85,
  rationale: 'Test signal rationale',
  ...overrides,
});

export const signalsFixture = () => [
  signalFixture({ baseAsset: 'USDC', counterAsset: 'XLM' }),
  signalFixture({ baseAsset: 'BTC', counterAsset: 'USDC', type: 'SELL' }),
  signalFixture({ baseAsset: 'ETH', counterAsset: 'USDC' }),
];
