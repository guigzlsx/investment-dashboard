"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage } from "../../lib/auth/messages";
import { ANALYSIS_DEPTHS, displayNameForUser, initialsForUser, PROFILE_CURRENCIES, type AnalysisDepth, type ProfileCurrency } from "../../lib/auth/profile";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

interface ProfileData {
  display_name: string | null;
  email: string | null;
  base_currency: ProfileCurrency;
  default_analysis_depth: AnalysisDepth;
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function ProfileView() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<ProfileCurrency>("EUR");
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>("QUICK");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!active) return;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setMessageTone("error");
          setMessage(await responseMessage(response, "Unable to load your profile."));
          setLoading(false);
          return;
        }
        const body = await response.json() as { data: ProfileData };
        if (!active) return;
        setProfile(body.data);
        setDisplayName(body.data.display_name ?? "");
        setBaseCurrency(body.data.base_currency);
        setAnalysisDepth(body.data.default_analysis_depth);
        setLoading(false);
      } catch {
        if (!active) return;
        setMessageTone("error");
        setMessage("The profile service is unreachable. Check your connection and try again.");
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [router]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || null, baseCurrency, defaultAnalysisDepth: analysisDepth }),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setMessageTone("error");
        setMessage(await responseMessage(response, "Profile update failed."));
        return;
      }
      const body = await response.json() as { data: ProfileData };
      setProfile(body.data);
      setDisplayName(body.data.display_name ?? "");
      setMessageTone("success");
      setMessage("Profile saved.");
      window.dispatchEvent(new Event("profile-updated"));
    } catch {
      setMessageTone("error");
      setMessage("Profile update failed. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 6) {
      setMessageTone("error");
      setMessage("Your password must contain at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessageTone("error");
      setMessage("The passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessageTone("success");
      setMessage("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessageTone("error");
      setMessage(authErrorMessage(error));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        setMessageTone("error");
        setMessage(await responseMessage(response, "Account deletion failed."));
        return;
      }
      await createSupabaseBrowserClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setMessageTone("error");
      setMessage("Account deletion failed. Check your connection and try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading || !profile) return <div className="panel loading-panel">Loading profile…</div>;

  const displayNameLabel = displayNameForUser(profile.display_name, profile.email);
  const initials = initialsForUser(profile.display_name, profile.email);
  return (
    <div className="profile-stack">
      {message ? <div aria-live="polite" className={`inline-message ${messageTone}`}>{message}</div> : null}
      <div className="dashboard-grid equal">
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Profile</div><div className="panel-caption">How your account appears in the workspace.</div></div><span className="profile-avatar">{initials}</span></div>
          <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
            <label htmlFor="display-name">Display name<input id="display-name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={profile.email?.split("@")[0] ?? "Your name"} /></label>
            <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save changes"}</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Account</div><div className="panel-caption">Your authentication identity.</div></div></div>
          <div className="profile-detail"><span>Email</span><strong>{profile.email ?? "—"}</strong></div>
          <div className="profile-detail"><span>Account name</span><strong>{displayNameLabel}</strong></div>
        </section>
      </div>

      <div className="dashboard-grid equal">
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Preferences</div><div className="panel-caption">Saved for your future analysis experience.</div></div></div>
          <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
            <label htmlFor="base-currency">Base currency<select id="base-currency" value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value as ProfileCurrency)}>{PROFILE_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
            <label htmlFor="analysis-depth">Default analysis depth<select id="analysis-depth" value={analysisDepth} onChange={(event) => setAnalysisDepth(event.target.value as AnalysisDepth)}>{ANALYSIS_DEPTHS.map((depth) => <option key={depth} value={depth}>{depth === "QUICK" ? "Quick" : "Detailed"}</option>)}</select></label>
            <p className="profile-note">Portfolio calculations currently remain on the portfolio’s existing base currency.</p>
            <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save preferences"}</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Security</div><div className="panel-caption">Update your password through Supabase Auth.</div></div></div>
          <form className="profile-form" onSubmit={(event) => void changePassword(event)}>
            <label htmlFor="new-password">New password<input id="new-password" autoComplete="new-password" minLength={6} required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label htmlFor="confirm-new-password">Confirm password<input id="confirm-new-password" autoComplete="new-password" minLength={6} required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="button" disabled={passwordBusy} type="submit">{passwordBusy ? "Updating…" : "Change password"}</button>
          </form>
        </section>
      </div>

      <section className="panel danger-panel">
        <div><div className="panel-title">Danger zone</div><div className="panel-caption">Permanently delete your account and personal portfolio data.</div></div>
        {!confirmDelete ? <button className="button danger-button" onClick={() => setConfirmDelete(true)} type="button">Delete account</button> : <div className="delete-confirm"><strong>Delete my account permanently?</strong><div><button className="button" disabled={deleteBusy} onClick={() => setConfirmDelete(false)} type="button">Cancel</button><button className="button danger-button" disabled={deleteBusy} onClick={() => void deleteAccount()} type="button">{deleteBusy ? "Deleting…" : "Delete account"}</button></div></div>}
      </section>
    </div>
  );
}
