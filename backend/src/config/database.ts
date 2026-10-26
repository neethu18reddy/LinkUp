import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

let client: PrismaClient | undefined;

export function getDatabase(): PrismaClient | undefined {
  if (!env.DATABASE_URL) return undefined;
  client ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
      max: 5,
    }),
  });
  return client;
}

export async function disconnectDatabase() {
  await client?.$disconnect();
}
