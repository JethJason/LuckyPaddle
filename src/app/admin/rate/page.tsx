import { redirect } from "next/navigation";
import RateEditor from "@/components/RateEditor";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function RatePage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <RateEditor />;
}
