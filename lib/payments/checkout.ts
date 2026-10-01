import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The launch promotion. This is display only -- the discount itself lives in
 * the Stripe dashboard as a promotion code attached to a 100%-off coupon.
 * Changing this string changes what the site advertises, NOT what Stripe
 * accepts, so the two have to be kept in step by hand.
 */
export const PROMO_CODE = "FREE2026";
export const PROMO_BLURB = "free through the end of 2026";

/**
 * Entry price for one league, for one season, in cents.
 *
 * Both figures are PER PLAYER. A doubles pair therefore pays $40 between them,
 * $20 each, rather than one of them covering the team -- which used to leave
 * one partner chasing the other for half.
 *
 * The enrollment is still a single row for the team. What changed is that it
 * only counts as paid once BOTH players have paid their own share, tracked as
 * one payments row per player.
 */
export const SINGLES_FEE_CENTS = 2500;
export const DOUBLES_PER_PLAYER_FEE_CENTS = 2000;

export function feeCentsFor(format: string): number {
  return format === "doubles" ? DOUBLES_PER_PLAYER_FEE_CENTS : SINGLES_FEE_CENTS;
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
  customerEmail?: string,
  playerId?: string,
  /**
   * Extra players this payment settles, when somebody pays for their partner
   * too. Their ids ride along in metadata so the webhook can credit them.
   */
  coversPlayerIds: string[] = []
): Promise<string> {
  const stripe = stripeClient();
  const base = siteUrl();
  // One share per person being paid for: yourself, plus anyone you are
  // covering.
  const shares = 1 + coversPlayerIds.length;
  const amountCents = feeCentsFor(format) * shares;

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
            name:
              format === "doubles"
                ? shares > 1
                  ? "League entry (both players)"
                  : "League entry (your half of a doubles pair)"
                : "League entry",
            description: leagueLabel,
          },
        },
      },
    ],
    // Read back by the webhook. Without this the payment cannot be matched to
    // an enrollment and the player pays without getting access.
    metadata: {
      enrollment_id: enrollmentId,
      ...(coversPlayerIds.length ? { covers: coversPlayerIds.join(",") } : {}),
    },
    success_url: `${base}/leagues/${enrollmentId}?paid=1`,
    cancel_url: `${base}/leagues/${enrollmentId}?canceled=1`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");

  // Record the attempt as pending. The webhook flips it to paid. A row sitting
  // at 'pending' forever means someone started checkout and walked away, which
  // is useful to be able to see.
  const admin = createAdminClient();
  // player_id and league_label are snapshots. A player can leave a league they
  // paid for, which nulls enrollment_id -- these keep the payment record
  // answerable on its own afterwards.
  const row: Record<string, unknown> = {
    enrollment_id: enrollmentId,
    stripe_session_id: session.id,
    amount_cents: amountCents,
    status: "pending",
    player_id: playerId ?? null,
    league_label: leagueLabel,
    covers_player_ids: coversPlayerIds,
  };

  let { error } = await admin.from("payments").insert(row);

  // `covers_player_ids` arrives with migration 0027, and PostgREST rejects the
  // WHOLE insert when one column is unknown. That used to fail silently here --
  // no payment row, so the webhook had nothing to mark paid, so every player
  // paid and stayed locked out. Rather than depend on a migration having been
  // run, drop the column and retry: paying for a partner stops working until
  // 0027 lands, but ordinary payments go through.
  if (error && isUnknownColumn(error, "covers_player_ids")) {
    console.error(
      "payments.covers_player_ids is missing -- run migration 0027. " +
        "Paying for a partner is unavailable until then."
    );
    delete row.covers_player_ids;
    ({ error } = await admin.from("payments").insert(row));
  }

  // Never send anyone to Stripe on the back of a payment we failed to record.
  // The webhook matches on this row; without it the money moves and the
  // enrollment stays locked forever.
  if (error) {
    console.error("Failed to record the pending payment", error);
    throw new Error(
      `Could not start checkout: the payment could not be recorded (${
        error.message || error.code || "unknown error"
      }).`
    );
  }

  return session.url;
}

/** True when PostgREST is complaining that a column does not exist. */
function isUnknownColumn(error: { code?: string; message?: string }, column: string): boolean {
  // PGRST204 is "column not found in schema cache"; 42703 is Postgres's own
  // undefined_column. Both have been seen depending on how stale the cache is.
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return Boolean(error.message && error.message.includes(column));
}
