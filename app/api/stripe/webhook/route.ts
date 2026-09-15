import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Signature verification needs the raw request body, so this route must not be
// statically optimised or run on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe calls this URL when a payment finishes.
 *
 * This -- not the browser returning from Stripe -- is the only trustworthy
 * signal that money actually moved. A player can close the tab before being
 * redirected, and anyone can type the success URL directly, so access is
 * granted here and nowhere else.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    console.error("Stripe webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server not configured for payments.", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header.", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secret);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Almost always either the wrong webhook secret, or something other than
    // Stripe posting here. Either way, refuse it.
    console.error("Stripe webhook: signature verification failed", err);
    return new Response("Invalid signature.", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge everything else so Stripe stops retrying it.
    return new Response("Ignored.", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const enrollmentId = session.metadata?.enrollment_id;

  if (!enrollmentId) {
    console.error("Stripe webhook: session has no enrollment_id in metadata", session.id);
    // 200 on purpose: retrying will not conjure metadata that was never set.
    return new Response("No enrollment_id in metadata.", { status: 200 });
  }

  // A 100% off promotion code produces a zero-dollar session, and Stripe
  // reports those as "no_payment_required" rather than "paid" -- there was no
  // payment to make. Treating only "paid" as success would silently lock out
  // every player who used a free code.
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return new Response("Session not paid.", { status: 200 });
  }

  const admin = createAdminClient();

  // Service role, so this bypasses RLS -- which is what we want. There is no
  // signed-in user in a webhook request.

  // Record this player's share first, then decide whether the enrollment is
  // fully paid. A doubles pair owes two shares, so one payment is not enough.
  const { error: paymentError } = await admin
    .from("payments")
    .update({ status: "paid" })
    .eq("stripe_session_id", session.id);

  if (paymentError) {
    console.error("Stripe webhook: failed to mark payment paid", paymentError);
    return new Response("Failed to record the payment.", { status: 500 });
  }

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("player_id, team_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) {
    console.error("Stripe webhook: enrollment no longer exists", enrollmentId);
    return new Response("Enrollment not found.", { status: 200 });
  }

  // Who owes a share: one player for singles, both partners for doubles.
  let required: string[] = [];
  if (enrollment.player_id) {
    required = [enrollment.player_id as string];
  } else if (enrollment.team_id) {
    const { data: team } = await admin
      .from("teams")
      .select("player1_id, player2_id")
      .eq("id", enrollment.team_id)
      .maybeSingle();
    if (team) required = [team.player1_id as string, team.player2_id as string];
  }

  const { data: paidRows } = await admin
    .from("payments")
    .select("player_id, covers_player_ids")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "paid");

  // A payment settles the payer's own share, plus anyone they covered.
  const paidPlayers = new Set<string>();
  for (const row of paidRows ?? []) {
    if ((row as any).player_id) paidPlayers.add((row as any).player_id);
    for (const id of ((row as any).covers_player_ids ?? []) as string[]) {
      paidPlayers.add(id);
    }
  }
  const everyoneHasPaid =
    required.length > 0 && required.every((id) => paidPlayers.has(id));

  if (everyoneHasPaid) {
    const { error: enrollError } = await admin
      .from("enrollments")
      .update({ paid: true })
      .eq("id", enrollmentId);

    if (enrollError) {
      console.error("Stripe webhook: failed to mark enrollment paid", enrollError);
      // 500 so Stripe retries. Somebody has been charged and must get access.
      return new Response("Failed to update enrollment.", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
