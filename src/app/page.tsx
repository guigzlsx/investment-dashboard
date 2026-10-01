import { redirect } from "next/navigation";
import { getServerUser } from "../lib/supabase/server";

export default async function Home() {
  redirect((await getServerUser()) ? "/dashboard" : "/login");
}
