export class ExplorerLinkDto {
  transaction?: string;
  account?: string;
  asset?: string;
  network: 'public' | 'testnet';
}

export class ExplorerLinksResponseDto {
  transactionLink?: string;
  accountLink?: string;
  assetLink?: string;
  network: string;
}

export class AssetVerificationDto {
  code: string;
  issuer: string;
  verified: boolean;
  explorerLink: string;
  domain?: string;
}
