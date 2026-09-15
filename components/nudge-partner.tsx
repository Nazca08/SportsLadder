"use client";

import { useState } from "react";

/**
 * Chase the other half of a doubles pair for their share.
 *
 * A pair is locked until both have paid, so without a way to prod them the only
 * option is remembering to mention it next time you happen to speak. Text and
 * email open the person's own apps with the message already written.
 */
export function NudgePartner({
  partnerName,
  leagueLabel,
  fee,
}: {
  partnerName: string;
  leagueLabel: string;
  fee: string;
}) {
  const [copied, setCopied] = useState(false);

  const base =
    typeof window !== "undefined" ? window.location.origin : "https://rallyrank.club";
  const message =
    `I've paid my half for ${leagueLabel} on RallyRank.club — ` +
    `you just need to pay yours (${fee}) and we're in. ${base}/dashboard`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked. The text and email buttons still work.
    }
  }

  return (
    <div>
      <p className="text-chalk-dim text-xs mb-2">Nudge {partnerName}</p>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={`sms:?&body=${encodeURIComponent(message)}`}
          className="text-center border border-white/15 rounded-lg py-2.5 text-sm hover:border-ball transition-colors"
        >
          Text
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(
            "Your half for " + leagueLabel
          )}&body=${encodeURIComponent(message)}`}
          className="text-center border border-white/15 rounded-lg py-2.5 text-sm hover:border-ball transition-colors"
        >
          Email
        </a>
        <button
          onClick={copy}
          className="text-center border border-white/15 rounded-lg py-2.5 text-sm hover:border-ball transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
