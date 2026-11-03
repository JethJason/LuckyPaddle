import { redirect } from "next/navigation";
import AdminLogin from "@/components/AdminLogin";
import { isAdmin, usesDevPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: { passwordChanged?: string } }) {
  if (await isAdmin()) redirect("/admin");
  return <AdminLogin showDevHint={usesDevPassword()} passwordChanged={searchParams.passwordChanged === "1"} />;
}
