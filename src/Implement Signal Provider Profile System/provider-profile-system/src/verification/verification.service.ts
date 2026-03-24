import { Injectable } from '@nestjs/common';

@Injectable()
export class VerificationService {
    private readonly minimumStake = 1000; // Minimum stake required for verification

    verifyProvider(stake: number): boolean {
        return stake >= this.minimumStake;
    }
}