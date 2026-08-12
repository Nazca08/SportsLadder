import { resumeCheckoutFromForm } from "@/app/leagues/join/actions";
import { formattedFeeFor } from "@/lib/payments/checkout";
import { SignOutButton } from "@/components/sign-out-button";

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
}: {
  enrollmentId: string;
  leagueLabel: string;
  format: string;
  canceled?: boolean;
  justPaid?: boolean;
}) {
  const fee = formattedFeeFor(format);
  const isDoubles = format === "doubles";

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
          {isDoubles ? " for the pair of you" : ""}, and you will be able to post offers,
          send challenges, and appear in the standings as soon as it clears.
        </p>

        <form action={resumeCheckoutFromForm}>
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <button
            type="submit"
            className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 hover:opacity-90 transition-opacity"
          >
            Pay {fee} and join
          </button>
        </form>

        <p className="text-chalk-dim text-xs mt-4 text-center">
          Payment is handled by Stripe. Card details never touch this site.
        </p>
      </div>
    </main>
  );
}
