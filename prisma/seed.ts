import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Deterministic recon IDs so the bundled sample CSVs line up with these invoices.
const INVOICES = [
  { reconId: "KR-DEMO0001", amount: 450, customerName: "Ramesh" },
  { reconId: "KR-DEMO0002", amount: 1200, customerName: "Sunita" },
  { reconId: "KR-DEMO0003", amount: 85, customerName: "Walk-in" },
  { reconId: "KR-DEMO0004", amount: 640, customerName: "Imran" },
  { reconId: "KR-DEMO0005", amount: 300, customerName: "Lakshmi", isCredit: true },
];

async function main() {
  const store = await prisma.store.upsert({
    where: { id: "demo-store" },
    update: {},
    create: {
      id: "demo-store",
      name: process.env.STORE_NAME ?? "Sharma Kirana Store",
      upiVpa: process.env.STORE_UPI_VPA ?? "sharmakirana@paytm",
      ownerEmail: process.env.STORE_OWNER_EMAIL ?? "owner@example.com",
    },
  });

  for (const inv of INVOICES) {
    await prisma.invoice.upsert({
      where: { reconId: inv.reconId },
      update: {},
      create: {
        reconId: inv.reconId,
        amount: inv.amount,
        customerName: inv.customerName,
        isCredit: inv.isCredit ?? false,
        storeId: store.id,
      },
    });
  }

  console.log(`Seeded store "${store.name}" + ${INVOICES.length} invoices.`);
  console.log("Now import the sample CSVs in /samples on the Reconcile page.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
