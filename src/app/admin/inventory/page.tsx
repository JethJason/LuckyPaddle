import { redirect } from "next/navigation";
import InventoryManager from "@/components/InventoryManager";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <InventoryManager />;
}
