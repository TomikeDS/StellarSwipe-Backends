import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { PriceHistory } from '../../prices/entities/price-history.entity';
import { AssetPair } from '../../assets/entities/asset-pair.entity';
import { StatisticalAnalysisService } from './statistical-analysis.service';
import { CorrelationQueryDto } from '../dto/correlation-query.dto';
import { CorrelationMatrixDto } from '../dto/correlation-matrix.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CorrelationService {
  private readonly logger = new Logger(CorrelationService.name);

  constructor(
    @InjectRepository(PriceHistory)
    private priceHistoryRepository: Repository<PriceHistory>,
    @InjectRepository(AssetPair)
    private assetPairRepository: Repository<AssetPair>,
    private statsService: StatisticalAnalysisService,
  ) {}

  /**
   * Calculates correlations between all tradable asset pairs
   */
  async getCorrelations(query: CorrelationQueryDto): Promise<CorrelationMatrixDto> {
    const { days } = query;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. Get all tradable asset pairs
    const pairs = await this.assetPairRepository.find({
      where: { isTradable: true },
      relations: ['baseAsset', 'counterAsset'],
    });

    const pairIdentifiers = pairs.map(p => p.getPairIdentifier());
    
    // 2. Fetch history and calculate returns for all pairs
    const historyMap: Record<string, number[]> = {};
    for (const pairId of pairIdentifiers) {
        const history = await this.priceHistoryRepository.find({
            where: { assetPair: pairId, timestamp: MoreThanOrEqual(since) },
            order: { timestamp: 'ASC' }
        });
        
        if (history.length > 1) {
            historyMap[pairId] = this.calculateReturns(history);
        }
    }

    // 3. Generate correlation matrix
    const matrix: Record<string, Record<string, number>> = {};
    const validPairs = Object.keys(historyMap);
    
    for (const pairA of validPairs) {
        matrix[pairA] = {};
        for (const pairB of validPairs) {
            if (pairA === pairB) {
                matrix[pairA][pairB] = 1;
            } else {
                const returnsA = historyMap[pairA];
                const returnsB = historyMap[pairB];
                
                // Align lengths by taking the minimum available overlapping period
                const minLen = Math.min(returnsA.length, returnsB.length);
                if (minLen < 2) {
                    matrix[pairA][pairB] = 0;
                    continue;
                }

                const correlation = this.statsService.calculateCorrelation(
                    returnsA.slice(-minLen),
                    returnsB.slice(-minLen)
                );
                matrix[pairA][pairB] = Number(correlation.toFixed(4));
            }
        }
    }

    // 4. Calculate Diversification Score
    const diversificationScore = this.calculateDiversificationScore(matrix);

    // 5. Recommendations
    const recommendations = this.generateRecommendations(matrix);

    return {
        correlationMatrix: matrix,
        diversificationScore,
        recommendations
    };
  }

  /**
   * Calculates daily returns from price history
   */
  private calculateReturns(history: PriceHistory[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
        const prev = Number(history[i-1].price);
        const curr = Number(history[i].price);
        if (prev > 0) {
            returns.push((curr - prev) / prev);
        } else {
            returns.push(0);
        }
    }
    return returns;
  }

  /**
   * Calculates a diversification score (0-100) based on average correlation
   * Higher is more diversified (lower average correlation)
   */
  private calculateDiversificationScore(matrix: Record<string, Record<string, number>>): number {
    const keys = Object.keys(matrix);
    if (keys.length <= 1) return 100;

    let sumCorr = 0;
    let count = 0;

    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            // Pearson correlation is symmetric, so we only need upper triangle
            sumCorr += matrix[keys[i]][keys[j]];
            count++;
        }
    }

    if (count === 0) return 100;

    const avgCorr = sumCorr / count;
    // Map avgCorr [-1, 1] to a 0-100 score
    // If avgCorr is 1 (perfect correlation), score is 0
    // If avgCorr is 0 (no correlation), score is 100 (or close to it)
    // If avgCorr is -1 (perfect inverse), score is 100
    const score = Math.max(0, Math.min(100, (1 - Math.max(0, avgCorr)) * 100));
    return Math.round(score);
  }

  /**
   * Generates diversification recommendations based on the correlation matrix
   */
  private generateRecommendations(matrix: Record<string, Record<string, number>>): string[] {
    const recommendations: string[] = [];
    const keys = Object.keys(matrix);
    
    const highlyCorrelated: string[] = [];
    const uncorrelated: string[] = [];

    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const corr = matrix[keys[i]][keys[j]];
            if (corr > 0.7) {
                highlyCorrelated.push(`${keys[i]} & ${keys[j]}`);
            } else if (Math.abs(corr) < 0.3) {
                uncorrelated.push(`${keys[i]} & ${keys[j]}`);
            }
        }
    }

    if (highlyCorrelated.length > 0) {
        recommendations.push(`High correlation detected between: ${highlyCorrelated.slice(0, 2).join(', ')}. These assets tend to move together, increasing risk.`);
    }
    if (uncorrelated.length > 0) {
        recommendations.push(`Strong diversification potential found with: ${uncorrelated.slice(0, 2).join(', ')}.`);
    }

    if (recommendations.length === 0) {
        recommendations.push('Your current asset mix shows standard diversification levels.');
    } else {
        recommendations.push('Consider adding assets with low or negative correlation to your portfolio to reduce overall variance.');
    }

    return recommendations;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCorrelationUpdate() {
    this.logger.log('Executing daily correlation analysis update...');
    // This could be used to pre-calculate and cache the matrix for all users
    try {
        await this.getCorrelations({ days: 30, baseAsset: 'XLM' });
        this.logger.log('Daily correlation analysis completed successfully.');
    } catch (error: any) {
        this.logger.error('Failed to update daily correlations:', error.stack);
    }
  }
}
