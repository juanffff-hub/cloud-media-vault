import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createDatabase(databaseUrl: string) {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 8_000,
    query_timeout: 10_000,
  });
  // Un cliente por proceso. No registrar consultas, parámetros ni URLs.
  return new PrismaClient({ adapter, log: [], errorFormat: 'minimal' });
}

export async function checkDatabase(database: Pick<PrismaClient, '$queryRaw'>): Promise<void> {
  await database.$queryRaw`SELECT 1`;
}
