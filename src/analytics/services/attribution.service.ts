import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, TradeStatus } from '../../trades/entities/trade.entity';
import { Signal } from '../../signals/entities/signal.entity';
import {
  AttributionResultDto,
  ProviderAttribution,
  AssetAttribution,
  TimeframeAttribution,
  SignalPerformance,
} from '../dto/attribution-result.dto';
import { AttributionTimeframe } from '../dto/attribution-query.dto';

@Injectable()
export class AttributionService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>,
  ) {}

  async calculateAttribution(
    userId: string,
    startDate: Date,
    endDate: Date,
    timeframe: AttributionTimeframe = AttributionTimeframe.DAILY,
  ): Promise<AttributionResultDto> {
    const trades = await this.tradeRepository
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.user', 'user')
      .where('trade.userId = :userId', { userId })
      .andWhere('trade.closedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('trade.status IN (:...statuses)', {
        statuses: [TradeStatus.SETTLED, TradeStatus.COMPLETED],
      })
      .andWhere('trade.profitLoss IS NOT NULL')
      .getMany();

    const signals = await this.signalRepository
      .createQueryBuilder('signal')
      .leftJoinAndSelect('signal.provider', 'provider')
      .where('signal.id IN (:...signalIds)', {
        signalIds: trades.map((t) => t.signalId),
      })
      .getMany();

    const signalMap = new Map(signals.map((s) => [s.id, s]));

    const totalPnL = trades.reduce(
      (sum, t) => sum + parseFloat(t.profitLoss || '0'),
      0,
    );

    const byProvider = this.calculateProviderAttribution(
      trades,
      signalMap,
      totalPnL,
    );
    const byAsset = this.calculateAssetAttribution(trades, totalPnL);
    const byTimeframe = this.calculateTimeframeAttribution(
      trades,
      timeframe,
      startDate,
      endDate,
    );
    const { topSignals, worstSignals } = this.calculateSignalPerformance(
      trades,
      signalMap,
    );

    return {
      byProvider,
      byAsset,
      byTimeframe,
      topSignals,
      worstSignals,
      totalPnL,
      totalTrades: trades.length,
    };
  }

  private calculateProviderAttribution(
    trades: Trade[],
    signalMap: Map<string, Signal>,
    totalPnL: number,
  ): ProviderAttribution[] {
    const providerMap = new Map<
      string,
      { pnl: number; tradeCount: number; name: string }
    >();

    for (const trade of trades) {
      const signal = signalMap.get(trade.signalId);
      if (!signal) continue;

      const providerId = signal.providerId;
      const pnl = parseFloat(trade.profitLoss || '0');
      const existing = providerMap.get(providerId);

      if (existing) {
        existing.pnl += pnl;
        existing.tradeCount += 1;
      } else {
        providerMap.set(providerId, {
          pnl,
          tradeCount: 1,
          name: signal.provider?.username || 'Unknown',
        });
      }
    }

    const result: ProviderAttribution[] = [];
    for (const [providerId, data] of providerMap.entries()) {
      result.push({
        providerId,
        name: data.name,
        pnl: data.pnl,
        percentage: totalPnL !== 0 ? (data.pnl / totalPnL) * 100 : 0,
        tradeCount: data.tradeCount,
      });
    }

    return result.sort((a, b) => b.pnl - a.pnl);
  }

  private calculateAssetAttribution(
    trades: Trade[],
    totalPnL: number,
  ): AssetAttribution[] {
    const assetMap = new Map<string, { pnl: number; tradeCount: number }>();

    for (const trade of trades) {
      const asset = `${trade.baseAsset}/${trade.counterAsset}`;
      const pnl = parseFloat(trade.profitLoss || '0');
      const existing = assetMap.get(asset);

      if (existing) {
        existing.pnl += pnl;
        existing.tradeCount += 1;
      } else {
        assetMap.set(asset, { pnl, tradeCount: 1 });
      }
    }

    const result: AssetAttribution[] = [];
    for (const [asset, data] of assetMap.entries()) {
      result.push({
        asset,
        pnl: data.pnl,
        percentage: totalPnL !== 0 ? (data.pnl / totalPnL) * 100 : 0,
        tradeCount: data.tradeCount,
      });
    }

    return result.sort((a, b) => b.pnl - a.pnl);
  }

  private calculateTimeframeAttribution(
    trades: Trade[],
    timeframe: AttributionTimeframe,
    startDate: Date,
    endDate: Date,
  ): TimeframeAttribution[] {
    const timeMap = new Map<string, number>();

    for (const trade of trades) {
      if (!trade.closedAt) continue;

      const dateKey = this.getDateKey(trade.closedAt, timeframe);
      const pnl = parseFloat(trade.profitLoss || '0');
      timeMap.set(dateKey, (timeMap.get(dateKey) || 0) + pnl);
    }

    const result: TimeframeAttribution[] = [];
    const dates = this.generateDateRange(startDate, endDate, timeframe);

    let cumulative = 0;
    for (const date of dates) {
      const pnl = timeMap.get(date) || 0;
      cumulative += pnl;
      result.push({ date, pnl, cumulative });
    }

    return result;
  }

  private calculateSignalPerformance(
    trades: Trade[],
    signalMap: Map<string, Signal>,
  ): { topSignals: SignalPerformance[]; worstSignals: SignalPerformance[] } {
    const signalPnlMap = new Map<
      string,
      {
        pnl: number;
        tradeCount: number;
        signal: Signal;
      }
    >();

    for (const trade of trades) {
      const signal = signalMap.get(trade.signalId);
      if (!signal) continue;

      const pnl = parseFloat(trade.profitLoss || '0');
      const existing = signalPnlMap.get(trade.signalId);

      if (existing) {
        existing.pnl += pnl;
        existing.tradeCount += 1;
      } else {
        signalPnlMap.set(trade.signalId, { pnl, tradeCount: 1, signal });
      }
    }

    const performances: SignalPerformance[] = [];
    for (const [signalId, data] of signalPnlMap.entries()) {
      performances.push({
        signalId,
        providerId: data.signal.providerId,
        providerName: data.signal.provider?.username || 'Unknown',
        asset: `${data.signal.baseAsset}/${data.signal.counterAsset}`,
        type: data.signal.type,
        pnl: data.pnl,
        tradeCount: data.tradeCount,
        createdAt: data.signal.createdAt,
      });
    }

    performances.sort((a, b) => b.pnl - a.pnl);

    return {
      topSignals: performances.slice(0, 10),
      worstSignals: performances.slice(-10).reverse(),
    };
  }

  private getDateKey(date: Date, timeframe: AttributionTimeframe): string {
    const d = new Date(date);

    switch (timeframe) {
      case AttributionTimeframe.DAILY:
        return d.toISOString().split('T')[0];
      case AttributionTimeframe.WEEKLY:
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toISOString().split('T')[0];
      case AttributionTimeframe.MONTHLY:
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      default:
        return d.toISOString().split('T')[0];
    }
  }

  private generateDateRange(
    startDate: Date,
    endDate: Date,
    timeframe: AttributionTimeframe,
  ): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(this.getDateKey(current, timeframe));

      switch (timeframe) {
        case AttributionTimeframe.DAILY:
          current.setDate(current.getDate() + 1);
          break;
        case AttributionTimeframe.WEEKLY:
          current.setDate(current.getDate() + 7);
          break;
        case AttributionTimeframe.MONTHLY:
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return [...new Set(dates)];
  }
}
