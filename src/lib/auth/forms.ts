export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateSignup(email: string, password: string, confirmation: string) {
  if (!validateEmail(email)) return "Enter a valid email address.";
  if (password.length < 6) return "Your password must contain at least 6 characters.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
}
