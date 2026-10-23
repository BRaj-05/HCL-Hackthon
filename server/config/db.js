const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to configure PostgreSQL.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Opens the PostgreSQL connection for application bootstrap.
 * This is deliberately not called here; server startup remains unchanged.
 */
async function connectDatabase() {
  await prisma.$connect();
  return prisma;
}

module.exports = connectDatabase;
module.exports.prisma = prisma;
