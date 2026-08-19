"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlayerStats } from "@/lib/leagues/player-stats";

type Profile = { fullName: string; displayName: string; phone: string; avatarUrl: string; rating: string };

type Props = {
  userId: string;
  email: string;
  profile: Profile;
  stats: PlayerStats;
};

export function SettingsClient({ userId, email, profile, stats }: Props) {
  const supabase = createClient();

  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [fullName, setFullName] = useState(profile.fullName);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone);
  const [rating, setRating] = useState(profile.rating);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [emailError, setEmailError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    setAvatarError("");
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust so the new photo shows immediately

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: freshUrl }).eq("id", userId);
      if (updateError) throw updateError;

      setAvatarUrl(freshUrl);
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleProfileSave() {
    setProfileSaving(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      if (!fullName.trim()) throw new Error("Name can't be empty.");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          display_name: displayName.trim() || null,
          phone: phone.trim() || null,
          rating: rating || null,
        })
        .eq("id", userId);
      if (error) throw error;
      setProfileSaved(true);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleEmailChange() {
    setEmailError("");
    setEmailStatus("");
    if (!newEmail.trim()) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) return setEmailError(error.message);
    setEmailStatus(`Check ${newEmail.trim()} for a confirmation link \u2014 your email won't change until you click it.`);
    setNewEmail("");
  }

  async function handlePasswordChange() {
    setPasswordError("");
    setPasswordStatus("");
    if (newPassword.length < 8) return setPasswordError("Password must be at least 8 characters.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setPasswordError(error.message);
    setPasswordStatus("Password updated.");
    setNewPassword("");
  }

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <section className="bg-panel border border-white/10 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Photo</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-court-deep border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-chalk-dim text-xs">No photo</span>
            )}
          </div>
          <div>
            <label className="inline-block bg-ball text-ink font-display text-sm font-semibold rounded-lg px-3 py-2 cursor-pointer">
              {avatarUploading ? "Uploading\u2026" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={avatarUploading}
                onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
              />
            </label>
            {avatarError && <div className="text-paddle text-xs mt-2">{avatarError}</div>}
          </div>
        </div>
      </section>

      {/* Profile info */}
      <section className="bg-panel border border-white/10 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold mb-1">Profile</h2>
        <p className="text-chalk-dim text-xs mb-4">
          Team or display name is optional — if set, it's shown instead of your real name on standings, offers, and challenges.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-chalk-dim text-xs font-display uppercase">Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full mt-1 bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-chalk-dim text-xs font-display uppercase">Team / display name (optional)</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. The Aces" className="w-full mt-1 bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-chalk-dim text-xs font-display uppercase">Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" className="w-full mt-1 bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </div>
          {profileError && <div className="text-paddle text-xs">{profileError}</div>}
          {profileSaved && <div className="text-ball text-xs">Saved.</div>}
          <label className="block text-chalk-dim text-xs mb-1">Your rating</label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm mb-1"
          >
            <option value="">Not set</option>
            {["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <p className="text-chalk-dim text-xs mb-4">
            Shown next to your name in open leagues, where players of every rating share
            one ladder, so opponents know what kind of match to expect.
          </p>

          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="bg-ball text-ink font-display text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {profileSaving ? "Saving\u2026" : "Save profile"}
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="bg-panel border border-white/10 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-4">
          <div>
            <label className="text-chalk-dim text-xs font-display uppercase">Current email</label>
            <div className="text-sm mt-1">{email}</div>
            <div className="flex gap-2 mt-2">
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" className="flex-1 bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <button onClick={handleEmailChange} className="bg-court-deep border border-white/10 font-display text-sm rounded-lg px-3 py-2 shrink-0">Change email</button>
            </div>
            {emailError && <div className="text-paddle text-xs mt-1">{emailError}</div>}
            {emailStatus && <div className="text-ball text-xs mt-1">{emailStatus}</div>}
          </div>
          <div>
            <label className="text-chalk-dim text-xs font-display uppercase">New password</label>
            <div className="flex gap-2 mt-1">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="flex-1 bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <button onClick={handlePasswordChange} className="bg-court-deep border border-white/10 font-display text-sm rounded-lg px-3 py-2 shrink-0">Change password</button>
            </div>
            {passwordError && <div className="text-paddle text-xs mt-1">{passwordError}</div>}
            {passwordStatus && <div className="text-ball text-xs mt-1">{passwordStatus}</div>}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-panel border border-white/10 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Your record</h2>
        <div className="text-3xl font-score font-bold mb-1">
          {stats.overallWins}-{stats.overallLosses}
        </div>
        <p className="text-chalk-dim text-xs mb-4">Across every league you've ever played in.</p>

        {stats.byLevel.length > 0 && (
          <div className="mb-4">
            <h3 className="text-chalk-dim text-xs font-display uppercase mb-2">By level</h3>
            <div className="space-y-1">
              {stats.byLevel.map((row) => (
                <div key={row.level} className="flex items-center justify-between bg-court-deep rounded-lg px-3 py-2 text-sm">
                  <span>{row.level}</span>
                  <span className="font-score">{row.wins}-{row.losses}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.byOpponent.length > 0 && (
          <div>
            <h3 className="text-chalk-dim text-xs font-display uppercase mb-2">Head-to-head</h3>
            <div className="space-y-1">
              {stats.byOpponent.map((row) => (
                <div key={row.opponentId} className="flex items-center justify-between bg-court-deep rounded-lg px-3 py-2 text-sm">
                  <span>{row.opponentName}</span>
                  <span className="font-score">{row.wins}-{row.losses}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.overallWins === 0 && stats.overallLosses === 0 && (
          <p className="text-chalk-dim text-sm">No completed matches yet.</p>
        )}
      </section>
    </div>
  );
}
