import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class SessionManagerService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

    async setSession(key: string, value: any, ttl?: number): Promise<void> {
        await this.cacheManager.set(`session:${key}`, value, ttl);
    }

    async getSession<T>(key: string): Promise<T | undefined> {
        return await this.cacheManager.get<T>(`session:${key}`);
    }

    async deleteSession(key: string): Promise<void> {
        await this.cacheManager.del(`session:${key}`);
    }
}
