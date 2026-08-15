import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entry price for one league, for one season, in cents.
 *
 * Doubles is priced per TEAM, not per player: the schema creates one enrollment
 * per team, so the pair pays this once between them. Charging each player
 * separately would be a schema change, not a price change.
 */
export const SINGLES_FEE_CENTS = 2500;
export const DOUBLES_TEAM_FEE_CENTS = 3500;

export function feeCentsFor(format: string): number {
  return format === "doubles" ? DOUBLES_TEAM_FEE_CENTS : SINGLES_FEE_CENTS;
}

export function formatFee(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Convenience for UI that knows the format but not the cents. */
export const formattedFeeFor = (format: string) => formatFee(feeCentsFor(format));

/** Throws a readable error at call time rather than a cryptic one at build time. */
function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it in Vercel under Settings, Environment Variables."
    );
  }
  return new Stripe(key);
}

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. It should be your full site address, e.g. https://rallyrank.club"
    );
  }
  return url.replace(/\/$/, "");
}

/**
 * Creates a Stripe Checkout session for one enrollment and returns the URL to
 * send the player to. The enrollment id travels in metadata so the webhook can
 * match the payment back to it -- this is the only link between the two, so it
 * must not be dropped.
 */
export async function createCheckoutUrl(
  enrollmentId: string,
  format: string,
  leagueLabel: string,
  customerEmail?: string
): Promise<string> {
  const stripe = stripeClient();
  const base = siteUrl();
  const amountCents = feeCentsFor(format);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    // Shows a "promotion code" field on the Stripe page. Codes themselves are
    // created and expired in the Stripe dashboard, not here, so running a
    // promotion never needs a code change.
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: format === "doubles" ? "League entry (doubles team)" : "League entry",
            description: leagueLabel,
          },
        },
      },
    ],
    // Read back by the webhook. Without this the payment cannot be matched to
    // an enrollment and the player pays without getting access.
    metadata: { enrollment_id: enrollmentId },
    success_url: `${base}/leagues/${enrollmentId}?paid=1`,
    cancel_url: `${base}/leagues/${enrollmentId}?canceled=1`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");

  // Record the attempt as pending. The webhook flips it to paid. A row sitting
  // at 'pending' forever means someone started checkout and walked away, which
  // is useful to be able to see.
  const admin = createAdminClient();
  await admin.from("payments").insert({
    enrollment_id: enrollmentId,
    stripe_session_id: session.id,
    amount_cents: amountCents,
    status: "pending",
  });

  return session.url;
}
