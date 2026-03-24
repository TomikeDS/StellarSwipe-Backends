export interface BillingRule {
  tierId: string;
  tierName: string;
  monthlyFlatFee: number;
  includedRequests: number;
  overageRatePerRequest: number;
  features: string[];
  maxRequestsPerMinute: number;
  maxRequestsPerDay: number;
}

export interface PriceCalculationResult {
  flatFee: number;
  includedRequests: number;
  usedRequests: number;
  overageRequests: number;
  overageCost: number;
  totalCost: number;
  currency: string;
}
