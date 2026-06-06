import { prisma } from "./prisma";

// v1 is single-store with no auth. We lazily ensure exactly one Store row exists,
// seeded from env, and reuse it everywhere.
export async function getStore() {
  const existing = await prisma.store.findFirst();
  if (existing) return existing;
  return prisma.store.create({
    data: {
      name: process.env.STORE_NAME ?? "My Kirana Store",
      upiVpa: process.env.STORE_UPI_VPA ?? "mystore@paytm",
      ownerEmail: process.env.STORE_OWNER_EMAIL ?? "owner@example.com",
    },
  });
}
