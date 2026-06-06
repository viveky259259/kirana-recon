import { getDashboardState } from "@/lib/ingest";

// Snapshot of the whole dashboard. The client polls this to stay in sync.
export async function GET() {
  return Response.json(getDashboardState());
}
