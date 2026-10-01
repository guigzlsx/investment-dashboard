import { redirect } from "next/navigation";
import { LoginForm } from "../../components/auth/login-form";
import { getServerUser } from "../../lib/supabase/server";

export default async function LoginPage() {
  if (await getServerUser()) redirect("/dashboard");
  return <LoginForm />;
}
