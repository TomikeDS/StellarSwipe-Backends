export class StellarMock {
  async submitTransaction(xdr: string): Promise<{ hash: string; success: boolean }> {
    return {
      hash: `mock_tx_${Date.now()}`,
      success: true,
    };
  }

  async getAccount(address: string): Promise<{ balances: any[] }> {
    return {
      balances: [
        { asset_type: 'native', balance: '1000.0000000' },
        { asset_code: 'USDC', balance: '5000.0000000' },
      ],
    };
  }

  async getTransaction(hash: string): Promise<{ status: string }> {
    return { status: 'SUCCESS' };
  }
}

export function createStellarMock(): StellarMock {
  return new StellarMock();
}
