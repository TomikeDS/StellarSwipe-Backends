export interface UsageMetric {
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UsageAggregate {
  apiKeyId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTimeMs: number;
  endpointBreakdown: Record<string, number>;
}
