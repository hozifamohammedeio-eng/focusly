import { AuthForm } from "@/features/auth/auth-form";
import { redirectAuthenticated } from "@/features/auth/session";
export const dynamic = "force-dynamic";
export default async function Page() {
  await redirectAuthenticated();
  return <AuthForm mode="signup" />;
}
