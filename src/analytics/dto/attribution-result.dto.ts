export class ProviderAttribution {
  providerId!: string;
  name!: string;
  pnl!: number;
  percentage!: number;
  tradeCount!: number;
}

export class AssetAttribution {
  asset!: string;
  pnl!: number;
  percentage!: number;
  tradeCount!: number;
}

export class TimeframeAttribution {
  date!: string;
  pnl!: number;
  cumulative!: number;
}

export class SignalPerformance {
  signalId!: string;
  providerId!: string;
  providerName!: string;
  asset!: string;
  type!: string;
  pnl!: number;
  tradeCount!: number;
  createdAt!: Date;
}

export class AttributionResultDto {
  byProvider!: ProviderAttribution[];
  byAsset!: AssetAttribution[];
  byTimeframe!: TimeframeAttribution[];
  topSignals!: SignalPerformance[];
  worstSignals!: SignalPerformance[];
  totalPnL!: number;
  totalTrades!: number;
}
