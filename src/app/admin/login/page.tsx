import { redirect } from "next/navigation";
import AdminLogin from "@/components/AdminLogin";
import { isAdmin, usesDevPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  if (isAdmin()) redirect("/admin");
  return <AdminLogin showDevHint={usesDevPassword()} />;
}
