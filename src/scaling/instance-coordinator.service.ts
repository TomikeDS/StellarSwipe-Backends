import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';

@Injectable()
export class InstanceCoordinatorService implements OnModuleInit {
    private readonly logger = new Logger(InstanceCoordinatorService.name);
    private readonly instanceId = uuidv4();
    private readonly hostname = os.hostname();

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

    async onModuleInit() {
        this.logger.log(`Instance initialized: ID=${this.instanceId} Host=${this.hostname}`);
        await this.registerInstance();
        this.startHeartbeat();
    }

    getInstanceId(): string {
        return this.instanceId;
    }

    private async registerInstance() {
        const key = `instances:${this.instanceId}`;
        await this.cacheManager.set(key, {
            hostname: this.hostname,
            lastSeen: Date.now(),
        }, 60000); // 1 minute TTL
    }

    private startHeartbeat() {
        setInterval(async () => {
            await this.registerInstance();
        }, 30000); // Heartbeat every 30 seconds
    }

    async getActiveInstances(): Promise<string[]> {
        // This would ideally use redis 'KEYS instances:*' but cache-manager abstraction varies
        // For now, tracking instances in a set would be better
        return [];
    }
}
