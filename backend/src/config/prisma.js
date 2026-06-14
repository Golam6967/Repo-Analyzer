const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

let prisma;

if (global.__prisma) {
  prisma = global.__prisma;
} else {
  // DIRECT_URL uses the session-mode pooler (port 5432) which works with pg driver adapter.
  // DATABASE_URL uses PgBouncer transaction-mode (port 6543, ?pgbouncer=true) which is a
  // Prisma-internal hint and not understood by the pg library directly.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
}

module.exports = prisma;
