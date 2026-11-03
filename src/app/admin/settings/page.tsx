import { redirect } from "next/navigation";
import AdminSettings from "@/components/AdminSettings";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return <AdminSettings displayName={admin.displayName} username={admin.username} />;
}
