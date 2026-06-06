import { getDashboardState } from "@/lib/ingest";
import { resetStore } from "@/lib/store";

// Reseed the demo to its initial state.
export async function POST() {
  resetStore();
  return Response.json(getDashboardState());
}
