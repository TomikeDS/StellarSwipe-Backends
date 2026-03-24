import { PriceCalculationResult } from '../interfaces/billing-rule.interface';
import Big from 'big.js';

export function calculatePrice(
  totalRequests: number,
  includedRequests: number,
  flatFee: string,
  overageRate: string,
): PriceCalculationResult {
  const overageRequests = Math.max(0, totalRequests - includedRequests);
  const overageCost = new Big(overageRequests).times(new Big(overageRate));
  const totalCost = new Big(flatFee).plus(overageCost);

  return {
    flatFee: parseFloat(flatFee),
    includedRequests,
    usedRequests: totalRequests,
    overageRequests,
    overageCost: parseFloat(overageCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    currency: 'USD',
  };
}
