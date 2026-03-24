export class BillingSummaryDto {
  userId!: string;
  apiKeyId!: string;
  currentTier!: string;
  billingCycleId!: string;
  periodStart!: Date;
  periodEnd!: Date;
  totalRequests!: number;
  includedRequests!: number;
  overageRequests!: number;
  flatFee!: string;
  overageCost!: string;
  totalCost!: string;
  pendingInvoices!: number;
}
