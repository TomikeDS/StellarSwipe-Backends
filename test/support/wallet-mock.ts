export class WalletMock {
  private walletAddress: string;

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress;
  }

  async connect(): Promise<{ address: string }> {
    return { address: this.walletAddress };
  }

  async signTransaction(xdr: string): Promise<string> {
    return `signed_${xdr}`;
  }

  async signAuthEntry(entry: string): Promise<string> {
    return `signed_auth_${entry}`;
  }

  getAddress(): string {
    return this.walletAddress;
  }
}

export function createMockWallet(address: string): WalletMock {
  return new WalletMock(address);
}
