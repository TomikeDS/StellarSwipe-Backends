import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Payout, PayoutStatus } from '../entities/payout.entity';
import { ProviderRewardsService, MINIMUM_PAYOUT_THRESHOLD } from './provider-rewards.service';
import { PayoutRequestDto } from '../dto/payout-request.dto';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly server: StellarSdk.Horizon.Server;
  private readonly sourceKeypair: StellarSdk.Keypair;
  private readonly networkPassphrase: string;
  private readonly usdcAsset: StellarSdk.Asset;

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    private readonly rewardsService: ProviderRewardsService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.server = new StellarSdk.Horizon.Server(horizonUrl);

    const secretKey = this.configService.getOrThrow<string>('STELLAR_SECRET_KEY');
    this.sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);

    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK') === 'mainnet'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    const usdcIssuer = this.configService.get<string>(
      'STELLAR_USDC_ISSUER',
      'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // testnet
    );
    this.usdcAsset = new StellarSdk.Asset('USDC', usdcIssuer);
  }

  /**
   * Request a payout. Validates balance, creates payout record, then processes async.
   */
  async requestPayout(providerId: string, dto: PayoutRequestDto): Promise<Payout> {
    // Prevent concurrent payout requests
    await this.ensureNoPendingPayout(providerId);

    const availableBalance = await this.rewardsService.getAvailableBalance(providerId);
    const requestedAmount = dto.amount ?? availableBalance;

    if (availableBalance < MINIMUM_PAYOUT_THRESHOLD) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${availableBalance}. Minimum: ${MINIMUM_PAYOUT_THRESHOLD}`,
      );
    }

    if (requestedAmount > availableBalance) {
      throw new BadRequestException(
        `Requested amount ${requestedAmount} exceeds available balance ${availableBalance}`,
      );
    }

    if (requestedAmount < MINIMUM_PAYOUT_THRESHOLD) {
      throw new BadRequestException(
        `Requested amount ${requestedAmount} is below minimum threshold ${MINIMUM_PAYOUT_THRESHOLD}`,
      );
    }

    const payout = await this.payoutRepository.save(
      this.payoutRepository.create({
        providerId,
        amount: requestedAmount,
        asset: dto.asset,
        destinationAddress: dto.destinationAddress,
        status: PayoutStatus.PENDING,
      }),
    );

    this.logger.log(`Payout created: id=${payout.id} provider=${providerId} amount=${requestedAmount}`);

    // Process asynchronously - don't block the response
    this.processPayout(payout).catch((err) => {
      this.logger.error(`Async payout processing failed: ${err.message}`, err.stack);
    });

    return payout;
  }

  /**
   * Core payout processing: builds and submits Stellar transaction.
   */
  async processPayout(payout: Payout): Promise<void> {
    // Mark as PROCESSING
    await this.payoutRepository.update(payout.id, {
      status: PayoutStatus.PROCESSING,
      processedAt: new Date(),
    });

    try {
      const txHash = await this.submitStellarPayment(payout);

      await this.dataSource.transaction(async (manager) => {
        await manager.update(Payout, payout.id, {
          status: PayoutStatus.COMPLETED,
          stellarTxHash: txHash,
          completedAt: new Date(),
        });
      });

      await this.rewardsService.markEarningsAsPaidOut(
        payout.providerId,
        payout.id,
        payout.amount,
      );

      this.logger.log(`Payout completed: id=${payout.id} txHash=${txHash}`);
    } catch (error) {
      this.logger.error(`Payout failed: id=${payout.id} error=${error.message}`);
      await this.payoutRepository.update(payout.id, {
        status: PayoutStatus.FAILED,
        failureReason: error.message,
      });
      throw error;
    }
  }

  /**
   * Submit Stellar payment transaction and return tx hash.
   */
  private async submitStellarPayment(payout: Payout): Promise<string> {
    const sourceAccount = await this.server.loadAccount(this.sourceKeypair.publicKey());

    const asset = payout.asset === 'XLM'
      ? StellarSdk.Asset.native()
      : this.usdcAsset;

    const fee = await this.server.fetchBaseFee();

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: String(fee),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: payout.destinationAddress,
          asset,
          amount: String(payout.amount),
        }),
      )
      .addMemo(StellarSdk.Memo.text(`payout:${payout.id.slice(0, 20)}`))
      .setTimeout(30)
      .build();

    transaction.sign(this.sourceKeypair);

    const result = await this.server.submitTransaction(transaction);
    return result.hash;
  }

  /**
   * Ensure no PENDING or PROCESSING payout exists for provider.
   */
  private async ensureNoPendingPayout(providerId: string): Promise<void> {
    const existing = await this.payoutRepository.findOne({
      where: [
        { providerId, status: PayoutStatus.PENDING },
        { providerId, status: PayoutStatus.PROCESSING },
      ],
    });

    if (existing) {
      throw new ConflictException(
        `A payout is already in progress (id=${existing.id}, status=${existing.status})`,
      );
    }
  }

  /**
   * Get paginated payout history for a provider.
   */
  async getPayoutHistory(
    providerId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Payout[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.payoutRepository.findAndCount({
      where: { providerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  /**
   * Get a specific payout by ID (provider-scoped).
   */
  async getPayoutById(providerId: string, payoutId: string): Promise<Payout> {
    const payout = await this.payoutRepository.findOne({
      where: { id: payoutId, providerId },
    });
    if (!payout) {
      throw new BadRequestException(`Payout ${payoutId} not found`);
    }
    return payout;
  }

  /**
   * Retry a failed payout.
   */
  async retryPayout(providerId: string, payoutId: string): Promise<Payout> {
    const payout = await this.getPayoutById(providerId, payoutId);
    if (payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException(`Only FAILED payouts can be retried`);
    }

    await this.ensureNoPendingPayout(providerId);

    await this.payoutRepository.update(payoutId, {
      status: PayoutStatus.PENDING,
      failureReason: null,
      stellarTxHash: null,
    });

    const refreshed = await this.getPayoutById(providerId, payoutId);
    this.processPayout(refreshed).catch((err) => {
      this.logger.error(`Retry payout failed: ${err.message}`);
    });

    return refreshed;
  }
}
