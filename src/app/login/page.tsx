"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "login" | "signup") {
    setBusy(true); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;

      if (result.data.session) {
        setMessage(mode === "login"
          ? "Signed in. Redirecting to your dashboard…"
          : "Account created and signed in. Redirecting to your dashboard…");
        router.push("/dashboard");
        return;
      }

      setMessage("Account created. Check your email to finish registration, then sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication unavailable"); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="panel auth-panel"><Link className="brand auth-brand" href="/dashboard"><span className="brand-mark" /><span><span className="brand-name">Investment Dashboard</span><span className="brand-caption">Private workspace</span></span></Link><div className="eyebrow">Private data</div><h1 className="page-title">Sign in</h1><p className="page-description">Supabase authentication protects your transactions, watchlist and notes.</p><form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submit("login"); }}><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-primary" disabled={busy} type="submit">{busy ? "Please wait…" : "Sign in"}</button><button className="button" disabled={busy} onClick={() => void submit("signup")} type="button">Create account</button></form>{message ? <p className="auth-message">{message}</p> : null}</section></main>;
}
