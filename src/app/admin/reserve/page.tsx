import { redirect } from "next/navigation";
import ReserveManager from "@/components/ReserveManager";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function ReservePage() {
  if (!isAdmin()) redirect("/admin/login");
  return <ReserveManager />;
}
