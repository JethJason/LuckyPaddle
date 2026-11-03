import { redirect } from "next/navigation";
import RateEditor from "@/components/RateEditor";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function RatePage() {
  if (!isAdmin()) redirect("/admin/login");
  return <RateEditor />;
}
