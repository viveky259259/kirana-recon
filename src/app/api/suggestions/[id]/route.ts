import { confirmSuggestion, dismissSuggestion, getDashboardState } from "@/lib/ingest";

// The store owner's verdict on a Sarvam suggestion.
//   POST /api/suggestions/:id  { action: "confirm" }
//   POST /api/suggestions/:id  { action: "dismiss", feedback: "..." }
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { action?: string; feedback?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "confirm") {
    const payment = confirmSuggestion(id);
    if (!payment) {
      return Response.json({ error: "No open suggestion for that payment." }, { status: 404 });
    }
    return Response.json({ payment, state: getDashboardState() });
  }

  if (body.action === "dismiss") {
    const payment = dismissSuggestion(id, (body.feedback ?? "").trim());
    if (!payment) {
      return Response.json({ error: "No open suggestion for that payment." }, { status: 404 });
    }
    return Response.json({ payment, state: getDashboardState() });
  }

  return Response.json({ error: 'Expected `action` of "confirm" or "dismiss".' }, { status: 400 });
}
