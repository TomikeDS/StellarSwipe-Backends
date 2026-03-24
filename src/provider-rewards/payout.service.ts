import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payout, PayoutStatus } from '../entities/payout.entity';
import { PayoutRequestDto } from '../dto/payout-request.dto';
import { ProviderRewardsService, MINIMUM_PAYOUT_THRESHOLD } from './provider-rewards.service';
import { PayoutHistoryItemDto } from '../dto/earnings-summary.dto';

/**
 * Minimal interface for a Stellar payment gateway.
 * Inject your real StellarService / HorizonService here.
 */
export interface StellarGateway {
  submitPayment(params: {
    destinationAddress: string;
    amount: number;
    asset: string;
    memo?: string;
  }): Promise<{ transactionId: string }>;
}

export const STELLAR_GATEWAY = 'STELLAR_GATEWAY';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    private readonly rewardsService: ProviderRewardsService,
    private readonly dataSource: DataSource,
    // Inject your concrete Stellar implementation via the token
    // @Inject(STELLAR_GATEWAY) private readonly stellarGateway: StellarGateway,
  ) {}

  /**
   * Initiates a payout request for a provider.
   *
   * Flow:
   *  1. Check available balance >= MINIMUM_PAYOUT_THRESHOLD
   *  2. Guard against simultaneous pending/processing requests
   *  3. Persist payout record as PENDING
   *  4. Submit Stellar transaction
   *  5. Mark COMPLETED and deduct from balance (via payout row)
   *  6. On failure, mark FAILED and record reason
   */
  async requestPayout(
    providerId: string,
    dto: PayoutRequestDto,
  ): Promise<PayoutHistoryItemDto> {
    // --- 1. Balance check ---
    const availableBalance = await this.rewardsService.getAvailableBalance(providerId);

    if (availableBalance < MINIMUM_PAYOUT_THRESHOLD) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${availableBalance.toFixed(2)}, minimum required: ${MINIMUM_PAYOUT_THRESHOLD}`,
      );
    }

    // --- 2. Guard: no concurrent pending/processing payout ---
    const existingActive = await this.payoutRepository.findOne({
      where: [
        { providerId, status: PayoutStatus.PENDING },
        { providerId, status: PayoutStatus.PROCESSING },
      ],
    });

    if (existingActive) {
      throw new ConflictException(
        `A payout is already ${existingActive.status} for this provider. Please wait until it completes.`,
      );
    }

    // --- 3. Create PENDING payout record ---
    let payout = this.payoutRepository.create({
      providerId,
      amount: availableBalance,
      asset: dto.asset,
      status: PayoutStatus.PENDING,
      destinationAddress: dto.destinationAddress,
    });
    payout = await this.payoutRepository.save(payout);
    this.logger.log(
      `Payout ${payout.id} created as PENDING for provider=${providerId} amount=${availableBalance} ${dto.asset}`,
    );

    // --- 4. Mark as PROCESSING and submit to Stellar ---
    await this.payoutRepository.update(payout.id, {
      status: PayoutStatus.PROCESSING,
    });

    try {
      // Replace with real stellar gateway call:
      // const { transactionId } = await this.stellarGateway.submitPayment({
      //   destinationAddress: dto.destinationAddress,
      //   amount: availableBalance,
      //   asset: dto.asset,
      //   memo: payout.id,
      // });
      const transactionId = await this.submitStellarPayment({
        destinationAddress: dto.destinationAddress,
        amount: availableBalance,
        asset: dto.asset,
        payoutId: payout.id,
      });

      // --- 5. Mark COMPLETED ---
      await this.payoutRepository.update(payout.id, {
        status: PayoutStatus.COMPLETED,
        stellarTransactionId: transactionId,
        processedAt: new Date(),
      });

      this.logger.log(
        `Payout ${payout.id} COMPLETED with stellarTx=${transactionId}`,
      );
    } catch (error: any) {
      // --- 6. Mark FAILED ---
      const reason: string = error?.message ?? 'Unknown error';
      await this.payoutRepository.update(payout.id, {
        status: PayoutStatus.FAILED,
        failureReason: reason,
        processedAt: new Date(),
      });

      this.logger.error(
        `Payout ${payout.id} FAILED: ${reason}`,
        error?.stack,
      );

      throw new InternalServerErrorException(
        `Payout transaction failed: ${reason}`,
      );
    }

    const updated = await this.payoutRepository.findOneOrFail({
      where: { id: payout.id },
    });
    return this.mapToDto(updated);
  }

  /**
   * Retries a previously FAILED payout.
   */
  async retryPayout(
    payoutId: string,
    providerId: string,
  ): Promise<PayoutHistoryItemDto> {
    const payout = await this.payoutRepository.findOne({
      where: { id: payoutId, providerId },
    });

    if (!payout) {
      throw new BadRequestException('Payout not found for this provider.');
    }

    if (payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException(
        `Only FAILED payouts can be retried. Current status: ${payout.status}`,
      );
    }

    // Reset to PENDING and re-run
    await this.payoutRepository.update(payout.id, {
      status: PayoutStatus.PENDING,
      failureReason: null,
      stellarTransactionId: null,
      processedAt: null,
    });

    return this.requestPayout(providerId, {
      destinationAddress: payout.destinationAddress,
      asset: payout.asset as any,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Placeholder for the real Stellar payment submission.
   * Replace this entire method with your StellarGateway call.
   */
  private async submitStellarPayment(params: {
    destinationAddress: string;
    amount: number;
    asset: string;
    payoutId: string;
  }): Promise<string> {
    // TODO: inject StellarGateway and call it here
    throw new Error('StellarGateway not configured. Inject STELLAR_GATEWAY token.');
  }

  private mapToDto(p: Payout): PayoutHistoryItemDto {
    return {
      id: p.id,
      amount: Number(p.amount),
      asset: p.asset,
      status: p.status,
      destinationAddress: p.destinationAddress,
      stellarTransactionId: p.stellarTransactionId,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
      processedAt: p.processedAt,
    };
  }
}
