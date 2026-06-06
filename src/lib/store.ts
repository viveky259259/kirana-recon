// In-memory, seeded store for the demo journey.
//
// We stash the store on `globalThis` so it survives Next.js dev hot-reloads
// (each HMR cycle re-evaluates modules; without this the data would reset on
// every edit). State still resets on a full server restart — which is fine for
// a demo, and the UI exposes a "Reset demo" button to reseed on demand.

import type { Customer, FeedbackEvent, Invoice, Payment } from "./types";

export type Store = {
  storeName: string;
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  feedback: FeedbackEvent[];
  seq: number;
};

function seed(): Store {
  const customers: Customer[] = [
    { id: "c1", name: "Ramesh Kumar", upiId: "ramesh@oksbi", reconPendingAmount: 1250 },
    { id: "c2", name: "Sunita Devi", upiId: "sunita.devi@okhdfcbank", reconPendingAmount: 450 },
    { id: "c3", name: "Imran Shaikh", upiId: "imran.shaikh@okaxis", reconPendingAmount: 3000 },
    { id: "c4", name: "Lakshmi Nair", upiId: "lakshmi@okicici", reconPendingAmount: 780 },
    { id: "c5", name: "Vijay Reddy", upiId: "vijay.reddy@okhdfcbank", reconPendingAmount: 2100 },
  ];

  const createdAt = "2026-06-01T09:00:00.000Z";
  const invoices: Invoice[] = [
    { invoiceId: "INV-1001", customerId: "c1", amount: 500, status: "pending", createdAt },
    { invoiceId: "INV-1002", customerId: "c3", amount: 1500, status: "pending", createdAt },
    { invoiceId: "INV-1003", customerId: "c2", amount: 450, status: "pending", createdAt },
    { invoiceId: "INV-1004", customerId: "c4", amount: 780, status: "pending", createdAt },
    { invoiceId: "INV-1005", customerId: "c5", amount: 1000, status: "pending", createdAt },
  ];

  return {
    storeName: "Sharma General Store",
    customers,
    invoices,
    payments: [],
    feedback: [],
    seq: 1,
  };
}

const globalForStore = globalThis as unknown as { __kiranaStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__kiranaStore) {
    globalForStore.__kiranaStore = seed();
  }
  return globalForStore.__kiranaStore;
}

export function resetStore(): Store {
  globalForStore.__kiranaStore = seed();
  return globalForStore.__kiranaStore;
}

/** Monotonic id helper, e.g. nextId("pay") -> "pay-1". */
export function nextId(prefix: string): string {
  const store = getStore();
  return `${prefix}-${store.seq++}`;
}

export function findCustomer(id: string | undefined): Customer | undefined {
  if (!id) return undefined;
  return getStore().customers.find((c) => c.id === id);
}
