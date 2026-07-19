import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';

class InMemoryRedis {
  private store = new Map<string, string>();
  private expiry = new Map<string, number>();

  private now() {
    return Date.now();
  }

  private cleanup(key: string) {
    const expiry = this.expiry.get(key);
    if (expiry && expiry <= this.now()) {
      this.store.delete(key);
      this.expiry.delete(key);
    }
  }

  get(key: string) {
    this.cleanup(key);
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string, ttlSeconds?: number) {
    this.store.set(key, value);
    if (ttlSeconds) {
      this.expiry.set(key, this.now() + ttlSeconds * 1000);
    } else {
      this.expiry.delete(key);
    }
    return 'OK';
  }

  del(...keys: string[]) {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        this.expiry.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  incr(key: string) {
    this.cleanup(key);
    const current = this.store.get(key) ?? '0';
    const next = (parseInt(current, 10) || 0) + 1;
    this.store.set(key, String(next));
    return next;
  }

  expire(key: string, seconds: number) {
    if (!this.store.has(key)) return 0;
    this.expiry.set(key, this.now() + seconds * 1000);
    return 1;
  }

  keys(pattern: string) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    this.cleanupAll();
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }

  private cleanupAll() {
    for (const key of this.expiry.keys()) {
      this.cleanup(key);
    }
  }

  quit() {
    this.store.clear();
    this.expiry.clear();
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | InMemoryRedis | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
    } else {
      this.client = new InMemoryRedis();
    }
  }

  async onModuleInit() {
    if (this.client instanceof Redis) {
      try {
        await Promise.race([
          this.client.ping(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Redis ping timeout')), 2000),
          ),
        ]);
      } catch (err) {
        console.warn(
          'Redis unavailable; switching to in-memory fallback.',
          (err as Error).message,
        );
        try {
          this.client.disconnect();
        } catch {
          /* ignore */
        }
        this.client = new InMemoryRedis();
      }
    }
  }

  get redis() {
    return this.client as Redis | InMemoryRedis;
  }

  get isAvailable() {
    return this.client instanceof Redis;
  }

  async get(key: string): Promise<string | null> {
    return (this.client as any).get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<any> {
    if (ttlSeconds && ttlSeconds > 0) {
      return (this.client as any).set(key, value, 'EX', ttlSeconds);
    }
    return (this.client as any).set(key, value);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return (this.client as any).del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return (this.client as any).keys(pattern);
  }

  async onModuleDestroy() {
    if (this.client instanceof Redis) {
      await this.client.quit();
    } else if (this.client instanceof InMemoryRedis) {
      this.client.quit();
    }
  }
}
