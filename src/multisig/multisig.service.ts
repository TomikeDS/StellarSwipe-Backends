import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  PendingTransaction,
  PendingTransactionStatus,
} from './entities/pending-transaction.entity';
import {
  CreatePendingTransactionDto,
  SubmitSignatureDto,
} from './dto/submit-signature.dto';
import {
  MultisigAccountStatusDto,
  PendingTransactionStatusDto,
  SignerInfoDto,
  SubmitTransactionResultDto,
} from './dto/multisig-status.dto';

@Injectable()
export class MultisigService {
  private readonly logger = new Logger(MultisigService.name);
  private readonly server: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;

  constructor(
    @InjectRepository(PendingTransaction)
    private readonly pendingTxRepo: Repository<PendingTransaction>,
    private readonly horizonUrl: string = 'https://horizon.stellar.org',
    networkPassphrase: string = StellarSdk.Networks.PUBLIC,
  ) {
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.networkPassphrase = networkPassphrase;
  }

  // ─── Account Inspection ──────────────────────────────────────────────────────

  async getAccountMultisigStatus(accountId: string): Promise<MultisigAccountStatusDto> {
    this.validatePublicKey(accountId);

    let account: StellarSdk.Horizon.AccountResponse;
    try {
      account = await this.server.loadAccount(accountId);
    } catch {
      throw new NotFoundException(`Stellar account ${accountId} not found`);
    }

    const thresholds = account.thresholds;
    const rawSigners = account.signers as Array<{
      key: string;
      weight: number;
      type: string;
    }>;

    const isMultisig =
      rawSigners.length > 1 ||
      thresholds.med_threshold > 1 ||
      thresholds.high_threshold > 1;

    const signerDtos: SignerInfoDto[] = rawSigners.map((s) => ({
      publicKey: s.key,
      weight: s.weight,
      hasSigned: false, // populated when checking a specific pending tx
    }));

    const totalWeight = rawSigners.reduce((sum, s) => sum + s.weight, 0);

    return {
      accountId,
      isMultisig,
      thresholdLow: thresholds.low_threshold,
      thresholdMedium: thresholds.med_threshold,
      thresholdHigh: thresholds.high_threshold,
      signers: signerDtos,
      totalWeight,
    };
  }

  // ─── Create Pending Transaction ───────────────────────────────────────────────

  async createPendingTransaction(
    dto: CreatePendingTransactionDto,
  ): Promise<PendingTransactionStatusDto> {
    this.validatePublicKey(dto.accountId);

    // Decode and validate XDR
    let txEnvelope: StellarSdk.Transaction;
    try {
      txEnvelope = new StellarSdk.Transaction(
        dto.transactionXdr,
        this.networkPassphrase,
      );
    } catch {
      throw new BadRequestException('Invalid transaction XDR');
    }

    const txHash = txEnvelope.hash().toString('hex');

    // Check for duplicate
    const existing = await this.pendingTxRepo.findOne({
      where: { transactionHash: txHash },
    });
    if (existing) {
      throw new ConflictException(
        `A pending transaction with this hash already exists: ${existing.id}`,
      );
    }

    // Load account to determine threshold & signers
    const accountStatus = await this.getAccountMultisigStatus(dto.accountId);
    const requiredThreshold = accountStatus.thresholdMedium ?? 1;
    const pendingSigners = (accountStatus.signers ?? []).map((s) => s.publicKey);

    // Collect any signatures already embedded in the envelope
    const preloadedSignatures = this.extractSignaturesFromEnvelope(
      txEnvelope,
      accountStatus.signers ?? [],
    );
    const collectedWeight = preloadedSignatures.reduce((s, sig) => s + sig.weight, 0);
    const remainingPendingSigners = pendingSigners.filter(
      (pk) => !preloadedSignatures.find((s) => s.publicKey === pk),
    );

    const entity = this.pendingTxRepo.create({
      accountId: dto.accountId,
      transactionXdr: dto.transactionXdr,
      transactionHash: txHash,
      status:
        collectedWeight >= requiredThreshold
          ? PendingTransactionStatus.READY
          : PendingTransactionStatus.PENDING,
      requiredThreshold,
      collectedWeight,
      signatures: preloadedSignatures,
      pendingSigners: remainingPendingSigners,
      memo: dto.memo ?? null,
      metadata: dto.metadata ?? null,
      expiresAtLedger: (txEnvelope as any).timeBounds?.maxTime
        ? null
        : null, // ledger-based expiry not directly in timebounds; extend as needed
    });

    const saved = await this.pendingTxRepo.save(entity);
    return this.toStatusDto(saved);
  }

  // ─── Submit a Signature ───────────────────────────────────────────────────────

  async submitSignature(dto: SubmitSignatureDto): Promise<PendingTransactionStatusDto> {
    this.validatePublicKey(dto.signerPublicKey);

    const pending = await this.pendingTxRepo.findOne({
      where: { id: dto.pendingTransactionId },
    });

    if (!pending) {
      throw new NotFoundException(
        `Pending transaction ${dto.pendingTransactionId} not found`,
      );
    }

    if (
      pending.status === PendingTransactionStatus.SUBMITTED ||
      pending.status === PendingTransactionStatus.EXPIRED ||
      pending.status === PendingTransactionStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot add signature to a transaction with status '${pending.status}'`,
      );
    }

    // Prevent duplicate signatures from same key
    const alreadySigned = pending.signatures.find(
      (s) => s.publicKey === dto.signerPublicKey,
    );
    if (alreadySigned) {
      throw new ConflictException(
        `Signer ${dto.signerPublicKey} has already submitted a signature`,
      );
    }

    // Verify signature cryptographically
    const txHash = Buffer.from(pending.transactionHash!, 'hex');
    const sigBytes = Buffer.from(dto.signature, 'base64');
    const keypair = StellarSdk.Keypair.fromPublicKey(dto.signerPublicKey);

    if (!keypair.verify(txHash, sigBytes)) {
      throw new BadRequestException('Signature verification failed');
    }

    // Determine signer weight from on-chain account
    const accountStatus = await this.getAccountMultisigStatus(pending.accountId);
    const signerInfo = accountStatus.signers?.find(
      (s) => s.publicKey === dto.signerPublicKey,
    );

    if (!signerInfo) {
      throw new BadRequestException(
        `${dto.signerPublicKey} is not an authorized signer for account ${pending.accountId}`,
      );
    }

    // Append signature to the XDR envelope
    const updatedXdr = this.appendSignatureToXdr(
      pending.transactionXdr,
      dto.signerPublicKey,
      dto.signature,
    );

    const newWeight = pending.collectedWeight + signerInfo.weight;
    const newSignatures = [
      ...pending.signatures,
      { publicKey: dto.signerPublicKey, signature: dto.signature, weight: signerInfo.weight },
    ];
    const newPendingSigners = pending.pendingSigners.filter(
      (pk) => pk !== dto.signerPublicKey,
    );
    const isReady = newWeight >= pending.requiredThreshold;

    pending.transactionXdr = updatedXdr;
    pending.collectedWeight = newWeight;
    pending.signatures = newSignatures;
    pending.pendingSigners = newPendingSigners;
    pending.status = isReady
      ? PendingTransactionStatus.READY
      : PendingTransactionStatus.PENDING;

    const updated = await this.pendingTxRepo.save(pending);
    return this.toStatusDto(updated);
  }

  // ─── Submit to Stellar Network ────────────────────────────────────────────────

  async submitToNetwork(pendingTransactionId: string): Promise<SubmitTransactionResultDto> {
    const pending = await this.pendingTxRepo.findOne({
      where: { id: pendingTransactionId },
    });

    if (!pending) {
      throw new NotFoundException(`Pending transaction ${pendingTransactionId} not found`);
    }

    if (pending.status !== PendingTransactionStatus.READY) {
      throw new BadRequestException(
        `Transaction is not ready for submission. Current status: ${pending.status}. ` +
          `Collected weight: ${pending.collectedWeight}/${pending.requiredThreshold}`,
      );
    }

    try {
      const tx = new StellarSdk.Transaction(
        pending.transactionXdr,
        this.networkPassphrase,
      );
      const result = await this.server.submitTransaction(tx);

      pending.status = PendingTransactionStatus.SUBMITTED;
      pending.submittedAt = new Date();
      pending.stellarTxId = (result as any).id ?? (result as any).hash ?? null;
      await this.pendingTxRepo.save(pending);

      return {
        success: true,
        stellarTxId: pending.stellarTxId ?? undefined,
        pendingTransactionId,
      };
    } catch (err: any) {
      const message: string =
        err?.response?.data?.extras?.result_codes?.transaction ??
        err?.message ??
        'Unknown error';

      this.logger.error(
        `Failed to submit transaction ${pendingTransactionId}: ${message}`,
        err,
      );

      pending.status = PendingTransactionStatus.FAILED;
      await this.pendingTxRepo.save(pending);

      return {
        success: false,
        message,
        pendingTransactionId,
      };
    }
  }

  // ─── Query Pending Transactions ───────────────────────────────────────────────

  async getPendingTransactions(
    accountId: string,
    statuses: PendingTransactionStatus[] = [
      PendingTransactionStatus.PENDING,
      PendingTransactionStatus.READY,
    ],
  ): Promise<PendingTransactionStatusDto[]> {
    this.validatePublicKey(accountId);

    const records = await this.pendingTxRepo.find({
      where: { accountId, status: In(statuses) },
      order: { createdAt: 'DESC' },
    });

    return records.map((r) => this.toStatusDto(r));
  }

  async getPendingTransactionById(id: string): Promise<PendingTransactionStatusDto> {
    const record = await this.pendingTxRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Pending transaction ${id} not found`);
    return this.toStatusDto(record);
  }

  async expireStaleTransactions(currentLedger: number): Promise<number> {
    const result = await this.pendingTxRepo
      .createQueryBuilder()
      .update(PendingTransaction)
      .set({ status: PendingTransactionStatus.EXPIRED })
      .where('status IN (:...statuses)', {
        statuses: [PendingTransactionStatus.PENDING, PendingTransactionStatus.READY],
      })
      .andWhere('expires_at_ledger IS NOT NULL')
      .andWhere('expires_at_ledger < :currentLedger', { currentLedger })
      .execute();

    return result.affected ?? 0;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private validatePublicKey(key: string): void {
    try {
      StellarSdk.Keypair.fromPublicKey(key);
    } catch {
      throw new BadRequestException(`Invalid Stellar public key: ${key}`);
    }
  }

  private extractSignaturesFromEnvelope(
    tx: StellarSdk.Transaction,
    knownSigners: SignerInfoDto[],
  ): Array<{ publicKey: string; signature: string; weight: number }> {
    const txHash = tx.hash();
    const result: Array<{ publicKey: string; signature: string; weight: number }> = [];

    for (const decoratedSig of tx.signatures) {
      for (const signer of knownSigners) {
        try {
          const kp = StellarSdk.Keypair.fromPublicKey(signer.publicKey);
          // hint check (last 4 bytes of public key)
          const hint = kp.signatureHint();
          if (decoratedSig.hint().equals(hint) && kp.verify(txHash, decoratedSig.signature())) {
            result.push({
              publicKey: signer.publicKey,
              signature: decoratedSig.signature().toString('base64'),
              weight: signer.weight,
            });
          }
        } catch {
          // not this signer
        }
      }
    }

    return result;
  }

  private appendSignatureToXdr(
    xdr: string,
    signerPublicKey: string,
    signatureBase64: string,
  ): string {
    const tx = new StellarSdk.Transaction(xdr, this.networkPassphrase);
    const keypair = StellarSdk.Keypair.fromPublicKey(signerPublicKey);
    const sigBytes = Buffer.from(signatureBase64, 'base64');

    tx.signatures.push(
      new StellarSdk.xdr.DecoratedSignature({
        hint: keypair.signatureHint(),
        signature: sigBytes,
      }),
    );

    return tx.toEnvelope().toXDR('base64');
  }

  private toStatusDto(entity: PendingTransaction): PendingTransactionStatusDto {
    const remainingWeight = Math.max(
      0,
      entity.requiredThreshold - entity.collectedWeight,
    );
    return {
      id: entity.id,
      accountId: entity.accountId,
      status: entity.status,
      requiredThreshold: entity.requiredThreshold,
      collectedWeight: entity.collectedWeight,
      remainingWeight,
      isReady: entity.collectedWeight >= entity.requiredThreshold,
      pendingSigners: entity.pendingSigners,
      signatures: entity.signatures.map(({ publicKey, weight }) => ({
        publicKey,
        weight,
      })),
      memo: entity.memo ?? undefined,
      expiresAtLedger: entity.expiresAtLedger ?? undefined,
      submittedAt: entity.submittedAt ?? undefined,
      stellarTxId: entity.stellarTxId ?? undefined,
      metadata: entity.metadata ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
