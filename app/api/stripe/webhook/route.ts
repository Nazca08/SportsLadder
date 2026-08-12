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

  if (session.payment_status !== "paid") {
    return new Response("Session not paid.", { status: 200 });
  }

  const admin = createAdminClient();

  // Service role, so this bypasses RLS -- which is what we want. There is no
  // signed-in user in a webhook request.
  const { error: enrollError } = await admin
    .from("enrollments")
    .update({ paid: true })
    .eq("id", enrollmentId);

  if (enrollError) {
    console.error("Stripe webhook: failed to mark enrollment paid", enrollError);
    // 500 so Stripe retries. The player has been charged; they must get access.
    return new Response("Failed to update enrollment.", { status: 500 });
  }

  const { error: paymentError } = await admin
    .from("payments")
    .update({ status: "paid" })
    .eq("stripe_session_id", session.id);

  if (paymentError) {
    // The enrollment is already unlocked, so the player is fine. This only
    // affects the payment record, and is worth knowing about but not worth
    // making Stripe retry over.
    console.error("Stripe webhook: failed to mark payment paid", paymentError);
  }

  return new Response("OK", { status: 200 });
}
