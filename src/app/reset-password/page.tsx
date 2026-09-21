import { redirect } from "next/navigation";
import { getIdentity } from "@/features/auth/session";
import { AuthForm } from "@/features/auth/auth-form";
export const dynamic = "force-dynamic";
export default async function Page() {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") redirect("/login?status=invalidLink");
  return <AuthForm mode="reset" />;
}
