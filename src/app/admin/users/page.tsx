import { redirect } from "next/navigation";
import AdminUsers from "@/components/AdminUsers";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  if (admin.role !== "owner") redirect("/admin");
  return <AdminUsers />;
}
