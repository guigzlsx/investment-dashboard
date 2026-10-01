"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage } from "../../lib/auth/messages";
import { validateEmail, validateSignup } from "../../lib/auth/forms";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type Mode = "login" | "signup";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setConfirmation("");
  }

  async function submit() {
    setMessage("");
    const normalizedEmail = email.trim();
    if (!validateEmail(normalizedEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (mode === "signup") {
      const validation = validateSignup(normalizedEmail, password, confirmation);
      if (validation) {
        setMessage(validation);
        return;
      }
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        : await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { display_name: normalizedEmail.split("@")[0] } } });
      if (result.error) throw result.error;

      if (result.data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setMessage("Your account was created. Check your email to confirm it, then sign in.");
      setMode("login");
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark" />
          <span><span className="brand-name">Investment Dashboard</span><span className="brand-caption">Private workspace</span></span>
        </Link>
        <div className="eyebrow">Private data</div>
        <h1 className="page-title">{isSignup ? "Create account" : "Sign in"}</h1>
        <p className="page-description">Your transactions, watchlist and notes stay protected by Supabase authentication.</p>
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label htmlFor="auth-email">Email<input id="auth-email" autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label htmlFor="auth-password">Password<input id="auth-password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={6} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {isSignup ? <label htmlFor="auth-confirm-password">Confirm password<input id="auth-confirm-password" autoComplete="new-password" minLength={6} required type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}
          <button className="button button-primary" disabled={busy} type="submit">{busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}</button>
        </form>
        {message ? <p aria-live="polite" className="auth-message">{message}</p> : null}
        <div className="auth-switch">
          {isSignup ? <><span>Already have an account?</span><button disabled={busy} onClick={() => switchMode("login")} type="button">Sign in</button></> : <><span>New here?</span><button disabled={busy} onClick={() => switchMode("signup")} type="button">Create account</button></>}
        </div>
      </section>
    </main>
  );
}
