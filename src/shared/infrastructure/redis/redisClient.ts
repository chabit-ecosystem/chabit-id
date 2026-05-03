import { Redis } from 'ioredis';
import type { RedisClient } from 'hono-rate-limiter';
import { logger } from '../logger.js';

let client: Redis | null = null;

export function getRedisClient(): RedisClient | null {
  const url = process.env['REDIS_URL'];
  if (!url) return null;

  if (!client) {
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
    client.on('error', (err: unknown) => logger.error({ err }, 'redis error'));
  }
  return client as unknown as RedisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
