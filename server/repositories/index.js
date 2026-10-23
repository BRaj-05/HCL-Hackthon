const BaseRepository = require("./BaseRepository");
const { prisma } = require("../config/db");

module.exports = {
  Loan: new BaseRepository(prisma.loan),
  Schedule: new BaseRepository(prisma.schedule),
  Payment: new BaseRepository(prisma.payment),
  PaymentAllocation: new BaseRepository(prisma.paymentAllocation),
  Contact: new BaseRepository(prisma.contact),
  Settlement: new BaseRepository(prisma.settlement),
  Score: new BaseRepository(prisma.score),
  AuditLog: new BaseRepository(prisma.auditLog),
  OutboxEvent: new BaseRepository(prisma.outboxEvent),
  AppConfig: new BaseRepository(prisma.appConfig),
};
