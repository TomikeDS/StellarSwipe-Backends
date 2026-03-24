export const userFixture = (overrides = {}) => ({
  username: 'testuser',
  email: 'test@example.com',
  walletAddress: 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD',
  displayName: 'Test User',
  ...overrides,
});

export const usersFixture = () => [
  userFixture({ username: 'user1', email: 'user1@example.com' }),
  userFixture({ username: 'user2', email: 'user2@example.com' }),
  userFixture({ username: 'user3', email: 'user3@example.com' }),
];
