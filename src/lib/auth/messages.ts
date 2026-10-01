export function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : null;

  if (message.includes("email not confirmed")) return "Your email address is not confirmed yet. Check your inbox before signing in.";
  if (message.includes("invalid login credentials")) return "The email or password is incorrect.";
  if (message.includes("user already registered")) return "An account already exists for this email. Sign in instead.";
  if (status === 429 || message.includes("rate limit") || message.includes("too many requests")) return "Too many attempts. Please wait a moment and try again.";
  if (message.includes("password") && (message.includes("at least") || message.includes("should be"))) return "Your password does not meet the current security requirements.";
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("fetch")) return "The authentication service is unreachable. Check your connection and try again.";
  return "Authentication is temporarily unavailable. Please try again.";
}
