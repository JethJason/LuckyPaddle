import { redirect } from "next/navigation";
import ReserveManager from "@/components/ReserveManager";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function ReservePage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <ReserveManager />;
}
