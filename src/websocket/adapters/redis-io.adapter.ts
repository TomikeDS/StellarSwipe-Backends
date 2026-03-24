import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: any;

    constructor(private app: any, private configService: ConfigService) {
        super(app);
    }

    async connectToRedis(): Promise<void> {
        const host = this.configService.get<string>('redisCache.host') || 'localhost';
        const port = this.configService.get<number>('redisCache.port') || 6379;
        const password = this.configService.get<string>('redisCache.password');
        const db = this.configService.get<number>('redisCache.db') || 0;

        const url = password
            ? `redis://:${password}@${host}:${port}/${db}`
            : `redis://${host}:${port}/${db}`;

        const pubClient = createClient({ url });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        this.adapterConstructor = createAdapter(pubClient, subClient);
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
