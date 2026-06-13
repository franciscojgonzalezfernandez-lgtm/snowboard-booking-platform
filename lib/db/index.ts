import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * The app's Prisma client type. Inject this as the `prisma` dependency of pure,
 * unit-tested functions instead of hand-writing a structural "surface" type:
 * production passes the real `prisma` with no cast, and every `where`/`select`/
 * `data` shape is checked against the generated schema (so a select that drifts
 * from the code that reads it becomes a compile error). Tests still pass a
 * partial mock cast to `Db`.
 */
export type Db = PrismaClient;

/** Client passed to a `$transaction(async (tx) => …)` callback. */
export type DbTx = Prisma.TransactionClient;
