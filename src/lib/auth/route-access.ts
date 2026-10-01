export function getAuthRedirect(pathname: string, isAuthenticated: boolean) {
  if (pathname === "/login") return isAuthenticated ? "/dashboard" : null;
  if (pathname === "/") return isAuthenticated ? "/dashboard" : "/login";
  if (pathname.startsWith("/api/")) return null;
  return isAuthenticated ? null : "/login";
}
