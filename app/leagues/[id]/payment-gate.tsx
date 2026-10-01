import { resumeCheckoutFromForm } from "@/app/leagues/join/actions";
import { formattedFeeFor, feeCentsFor, formatFee, PROMO_CODE, PROMO_BLURB } from "@/lib/payments/checkout";
import { NudgePartner } from "@/components/nudge-partner";
import { SignOutButton } from "@/components/sign-out-button";
import { LeaveLeagueButton } from "@/components/leave-league-button";

/**
 * Shown instead of the league when an enrollment has not been paid for.
 *
 * `canceled` distinguishes "you backed out of Stripe" from "you have not
 * started yet", which are the same state in the database but feel very
 * different to the person looking at the screen.
 */
export function PaymentGate({
  enrollmentId,
  leagueLabel,
  format,
  canceled,
  justPaid,
  iHavePaid,
  partnerName,
}: {
  enrollmentId: string;
  leagueLabel: string;
  format: string;
  canceled?: boolean;
  justPaid?: boolean;
  /** Whether this player has settled their own share. */
  iHavePaid?: boolean;
  /** The other half of a doubles pair, when there is one. */
  partnerName?: string | null;
}) {
  const fee = formattedFeeFor(format);
  const isDoubles = format === "doubles";
  const bothFee = formatFee(feeCentsFor(format) * 2);
  const partner = partnerName ?? "your partner";

  // The branch this screen was missing. In doubles the enrollment stays unpaid
  // until BOTH shares are in, so a player who has paid their own saw the same
  // "Pay and join" button they had just used -- which reads as the payment
  // having failed, and leads to pressing it again. What they actually need is
  // to know they are done and to be able to chase the other half.
  if (isDoubles && iHavePaid) {
    return (
      <main className="min-h-screen p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <a href="/dashboard" className="text-chalk-dim text-sm hover:text-chalk">
            &larr; All leagues
          </a>
          <SignOutButton />
        </div>

        <div className="bg-panel border border-white/10 rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold mb-1">You&apos;re paid up</h1>
          <p className="text-chalk-dim text-sm mb-6">{leagueLabel}</p>

          <div className="mb-6 rounded-lg border border-ball/40 bg-ball/10 p-4">
            <p className="text-sm">
              Your {fee} is in. Waiting on {partner} to pay theirs &mdash; the pair of you
              go live the moment it lands.
            </p>
          </div>

          <p className="text-sm leading-relaxed text-chalk-dim mb-6">
            Nothing more for you to do here. You&apos;ll be able to post offers, send
            challenges and appear in the standings as soon as {partner} is in.
          </p>

          {partnerName && (
            <div className="mb-6">
              <NudgePartner
                partnerName={partnerName}
                leagueLabel={leagueLabel}
                fee={fee}
              />
            </div>
          )}

          {/* The deadlock breaker: if the partner will not or cannot pay, one
              player can settle the whole thing rather than both being stuck. */}
          <form action={resumeCheckoutFromForm}>
            <input type="hidden" name="enrollmentId" value={enrollmentId} />
            <input type="hidden" name="coverPartner" value="1" />
            <button
              type="submit"
              className="w-full border border-white/15 rounded-lg py-3 text-sm hover:border-ball transition-colors"
            >
              Or cover {partnerName ? `${partnerName}'s` : "their"} {fee} as well
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center">
            <p className="text-chalk-dim text-xs mb-2">Changed your mind?</p>
            <LeaveLeagueButton enrollmentId={enrollmentId} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="text-chalk-dim text-sm hover:text-chalk">
          &larr; All leagues
        </a>
        <SignOutButton />
      </div>

      <div className="bg-panel border border-white/10 rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold mb-1">One step left</h1>
        <p className="text-chalk-dim text-sm mb-6">{leagueLabel}</p>

        {justPaid && (
          // Stripe redirects the browser back faster than the webhook always
          // arrives. If we still see an unpaid enrollment here, it is usually a
          // few seconds of lag rather than a real failure.
          <div className="mb-6 rounded-lg border border-ball/40 bg-ball/10 p-4">
            <p className="text-sm">
              Your payment is going through. This can take a few seconds &mdash; refresh
              the page shortly and you should be in.
            </p>
          </div>
        )}

        {canceled && !justPaid && (
          <div className="mb-6 rounded-lg border border-paddle/40 bg-paddle/10 p-4">
            <p className="text-sm">
              Checkout was canceled, so nothing was charged. Your spot is still here when
              you want it.
            </p>
          </div>
        )}

        <p className="text-sm leading-relaxed text-chalk-dim mb-6">
          Your spot in this league is reserved but not active yet. Entry is{" "}
          <span className="text-chalk font-semibold">{fee}</span> for the season
          {isDoubles ? ` each \u2014 ${bothFee} for the pair of you` : ""}, and you will be
          able to post offers, send challenges, and appear in the standings as soon as it
          clears.
        </p>

        {/* Said plainly, because "entry is $20" on a doubles league was read as
            $20 covering both of them. */}
        {isDoubles && (
          <p className="text-chalk-dim text-sm leading-relaxed mb-6">
            {partnerName ? `${partnerName} pays` : "Your partner pays"} their own {fee}.
            Neither of you is in until both shares are settled &mdash; or you can cover
            both below.
          </p>
        )}

        <div className="mb-6 rounded-lg border border-ball/40 bg-ball/10 p-4 text-center">
          <p className="text-xs text-chalk-dim">Launch promo &mdash; enter at checkout</p>
          <p className="font-score text-xl font-bold tracking-[0.15em] text-ball mt-1">
            {PROMO_CODE}
          </p>
          <p className="text-xs text-chalk-dim mt-1">Leagues are {PROMO_BLURB}.</p>
        </div>

        <form action={resumeCheckoutFromForm}>
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <button
            type="submit"
            className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 hover:opacity-90 transition-opacity"
          >
            Pay {fee} and join
          </button>
        </form>

        {isDoubles && (
          <form action={resumeCheckoutFromForm} className="mt-2">
            <input type="hidden" name="enrollmentId" value={enrollmentId} />
            <input type="hidden" name="coverPartner" value="1" />
            <button
              type="submit"
              className="w-full border border-white/15 rounded-lg py-3 text-sm hover:border-ball transition-colors"
            >
              Pay for both of us &mdash; {bothFee}
            </button>
          </form>
        )}

        <p className="text-chalk-dim text-xs mt-4 text-center">
          Payment is handled by Stripe. Card details never touch this site.
        </p>

        {/* A player who decides against paying needs a way out; without this the
            unpaid league sits on their dashboard permanently. */}
        <div className="mt-6 border-t border-white/10 pt-4 text-center">
          <p className="text-chalk-dim text-xs mb-2">Changed your mind?</p>
          <LeaveLeagueButton enrollmentId={enrollmentId} />
        </div>
      </div>
    </main>
  );
}
