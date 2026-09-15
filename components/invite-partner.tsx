"use client";

import { useState } from "react";

/**
 * Shown when the partner search finds nobody.
 *
 * A doubles league needs a partner who already has an account, so somebody
 * whose partner has never signed up hits a wall: no results, and no way to
 * enter the league at all. This turns that into an errand -- send them a link,
 * come back once they have joined.
 */
export function InvitePartner({
  url,
  myName,
  searchedFor,
}: {
  url: string;
  myName: string;
  searchedFor: string;
}) {
  const [copied, setCopied] = useState(false);

  const who = searchedFor ? `"${searchedFor}"` : "them";
  const message =
    `${myName} here — I'm signing us up for a doubles league on RallyRank.club. ` +
    `Create an account with this link and I'll add you as my partner: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked. Text and email still work.
    }
  }

  return (
    <div className="rounded-lg border border-ball/40 bg-ball/10 p-3">
      <p className="text-sm mb-1">No account for {who} yet.</p>
      <p className="text-chalk-dim text-xs mb-3">
        Send them a link to sign up. Once they have, come back and they&apos;ll show up in
        the search.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={`sms:?&body=${encodeURIComponent(message)}`}
          className="text-center border border-white/15 rounded-lg py-2 text-sm hover:border-ball transition-colors"
        >
          Text
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(
            "Play doubles with me on RallyRank"
          )}&body=${encodeURIComponent(message)}`}
          className="text-center border border-white/15 rounded-lg py-2 text-sm hover:border-ball transition-colors"
        >
          Email
        </a>
        <button
          type="button"
          onClick={copy}
          className="text-center border border-white/15 rounded-lg py-2 text-sm hover:border-ball transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
