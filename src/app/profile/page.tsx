import { AppShell } from "../../components/layout/app-shell";
import { ProfileView } from "../../components/profile/profile-view";

export default function ProfilePage() {
  return <AppShell description="Manage your account and the preferences used by your workspace." title="Profile"><ProfileView /></AppShell>;
}
