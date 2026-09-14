"use client";

import { useState } from "react";

/**
 * Share a referral link by whatever means the person already uses.
 *
 * Four routes on purpose: the native share sheet is best on a phone but does
 * not exist on most desktop browsers, so text and email links cover that, and
 * copy covers everything else — WhatsApp, a club noticeboard, wherever.
 */
export function InviteShare({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState<boolean | null>(null);

  const message = `${name} invited you to play on RallyRank.club — real tennis and pickleball leagues near you. ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is blocked without https or on older browsers. Select the
      // field instead so the person can copy it themselves.
      const input = document.getElementById("invite-url") as HTMLInputElement | null;
      input?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function nativeShare() {
    // Feature-detected at click time rather than on render: checking during
    // render makes the server and client markup disagree.
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "RallyRank.club", text: message, url });
      } catch {
        // The person dismissed the sheet. Nothing to do.
      }
    } else {
      setCanShare(false);
      copy();
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          id="invite-url"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm font-score"
        />
        <button
          onClick={copy}
          className="bg-ball text-ink font-display font-semibold rounded-lg px-4 text-sm whitespace-nowrap"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* sms: with a body works on both iOS and Android; the ?& prefix is the
            quirk that makes iOS accept a body at all. */}
        <a
          href={`sms:?&body=${encodeURIComponent(message)}`}
          className="text-center border border-white/15 rounded-lg py-2.5 text-sm hover:border-ball transition-colors"
        >
          Text
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(
            "Come play on RallyRank.club"
          )}&body=${encodeURIComponent(message)}`}
          className="text-center border border-white/15 rounded-lg py-2.5 text-sm hover:border-ball transition-colors"
        >
          Email
        </a>
        <button
          onClick={nativeShare}
          className="text-center border border-white/15 rounded-lg py-2.5 text-sm hover:border-ball transition-colors"
        >
          Share
        </button>
      </div>

      {canShare === false && (
        <p className="text-chalk-dim text-xs mt-2">
          Your browser has no share menu, so the link is copied instead.
        </p>
      )}
    </div>
  );
}
