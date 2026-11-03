import { redirect } from "next/navigation";
import BlockManager from "@/components/BlockManager";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function BlockPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <BlockManager />;
}
