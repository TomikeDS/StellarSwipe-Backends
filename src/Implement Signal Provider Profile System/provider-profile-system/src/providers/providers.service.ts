import { Injectable } from '@nestjs/common';
import { ProviderProfile } from './entities/provider-profile.entity';
import { ProviderFollower } from './entities/provider-follower.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CacheService } from '../cache/cache.service';
import { VerificationService } from '../verification/verification.service';
import { SignalsService } from '../signals/signals.service';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly verificationService: VerificationService,
    private readonly signalsService: SignalsService,
  ) {}

  async getProviderProfile(walletAddress: string): Promise<ProviderProfile> {
    const cachedProfile = await this.cacheService.get<ProviderProfile>(`profile_${walletAddress}`);
    if (cachedProfile) {
      return cachedProfile;
    }

    const profile = await this.findProfileByWalletAddress(walletAddress);
    if (profile) {
      const stats = await this.calculateStats(profile);
      profile.stats = stats;
      await this.cacheService.set(`profile_${walletAddress}`, profile, 600); // Cache for 10 minutes
    }
    return profile;
  }

  async updateProfile(walletAddress: string, updateProfileDto: UpdateProfileDto): Promise<ProviderProfile> {
    const profile = await this.findProfileByWalletAddress(walletAddress);
    if (!profile) {
      throw new Error('Profile not found');
    }

    Object.assign(profile, updateProfileDto);
    await this.saveProfile(profile);
    return profile;
  }

  async followProvider(followerWallet: string, providerWallet: string): Promise<void> {
    // Logic to add follower
    await this.addFollower(followerWallet, providerWallet);
  }

  async unfollowProvider(followerWallet: string, providerWallet: string): Promise<void> {
    // Logic to remove follower
    await this.removeFollower(followerWallet, providerWallet);
  }

  private async calculateStats(profile: ProviderProfile) {
    const totalSignals = await this.signalsService.getTotalSignals(profile.walletAddress);
    const winRate = await this.signalsService.getWinRate(profile.walletAddress);
    const averagePnL = await this.signalsService.getAveragePnL(profile.walletAddress);
    const totalCopiers = await this.getTotalCopiers(profile.walletAddress);
    const followerCount = await this.getFollowerCount(profile.walletAddress);

    return {
      totalSignals,
      winRate,
      averagePnL,
      totalCopiers,
      followerCount,
      memberSince: profile.createdAt,
    };
  }

  private async findProfileByWalletAddress(walletAddress: string): Promise<ProviderProfile> {
    // Logic to find profile by wallet address
  }

  private async saveProfile(profile: ProviderProfile): Promise<void> {
    // Logic to save the updated profile
  }

  private async addFollower(followerWallet: string, providerWallet: string): Promise<void> {
    // Logic to add a follower
  }

  private async removeFollower(followerWallet: string, providerWallet: string): Promise<void> {
    // Logic to remove a follower
  }

  private async getTotalCopiers(walletAddress: string): Promise<number> {
    // Logic to get total copiers
  }

  private async getFollowerCount(walletAddress: string): Promise<number> {
    // Logic to get follower count
  }
}