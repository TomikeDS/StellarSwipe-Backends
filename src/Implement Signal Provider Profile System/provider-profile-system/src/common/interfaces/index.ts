export interface User {
  id: string;
  walletAddress: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  twitterHandle?: string;
  verified: boolean;
  memberSince: Date;
}

export interface ProviderStats {
  totalSignals: number;
  winRate: number; // percentage
  averagePnL: number; // average profit and loss per signal
  totalCopiers: number;
  followerCount: number;
}