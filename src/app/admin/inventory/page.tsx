import { redirect } from "next/navigation";
import InventoryManager from "@/components/InventoryManager";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function InventoryPage() {
  if (!isAdmin()) redirect("/admin/login");
  return <InventoryManager />;
}
