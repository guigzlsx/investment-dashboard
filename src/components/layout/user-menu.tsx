"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage } from "../../lib/auth/messages";
import { displayNameForUser, initialsForUser } from "../../lib/auth/profile";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

interface ProfileData {
  display_name: string | null;
  email: string | null;
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!active || !response.ok) return;
        const body = await response.json() as { data?: ProfileData };
        if (active && body.data) setProfile(body.data);
      } catch {
        // The menu keeps its previous identity while a transient request fails.
      }
    };
    void refresh();
    window.addEventListener("profile-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("profile-updated", refresh);
    };
  }, []);

  async function signOut() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setMessage(authErrorMessage(error));
      setBusy(false);
    }
  }

  const displayName = displayNameForUser(profile?.display_name, profile?.email);
  const initials = initialsForUser(profile?.display_name, profile?.email);
  return (
    <div className={`user-menu ${compact ? "compact" : ""}`}>
      <button aria-expanded={open} aria-haspopup="menu" className="user-menu-trigger" disabled={busy} onClick={() => setOpen((current) => !current)} type="button">
        <span className="user-avatar">{profile ? initials : "…"}</span>
        {!compact ? <span className="user-menu-identity"><strong>{displayName}</strong><small>Profile</small></span> : null}
      </button>
      {open ? <div className="user-menu-popover" role="menu">
        <div className="user-menu-popover-header"><strong>{displayName}</strong><small>{profile?.email ?? "Loading account…"}</small></div>
        <Link href="/profile" onClick={() => setOpen(false)} role="menuitem">Profile</Link>
        <button disabled={busy} onClick={() => void signOut()} role="menuitem" type="button">{busy ? "Signing out…" : "Sign out"}</button>
        {message ? <p className="user-menu-error">{message}</p> : null}
      </div> : null}
    </div>
  );
}
