import { bootstrapCredentials, hashAdminPassword, verifyAdminPassword, type AdminRole } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  active: boolean;
  created_at: string;
};

/** Creates the first owner exactly once, using server-only environment credentials. */
export async function ensureBootstrapAdmin() {
  const { count, error: countError } = await supabase
    .from("admin_users")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const { username, password } = bootstrapCredentials();
  if (!password) throw new Error("Set ADMIN_BOOTSTRAP_PASSWORD before creating the first admin user.");
  const password_hash = await hashAdminPassword(password);
  const { error } = await supabase.from("admin_users").insert({
    username,
    display_name: username === "owner" ? "Owner" : username,
    password_hash,
    role: "owner",
    active: true,
  });
  // Another simultaneous first-login request may have created the bootstrap user first.
  if (error && error.code !== "23505") throw error;
}

export async function findAdminByUsername(username: string) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("id,username,display_name,password_hash,role,active,session_version")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function changeAdminPassword(id: string, currentPassword: string, newPassword: string) {
  const { data: user, error: findError } = await supabase
    .from("admin_users")
    .select("password_hash,session_version,active")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!user || !user.active) return "not_found" as const;

  if (!(await verifyAdminPassword(currentPassword, user.password_hash))) return "invalid_current" as const;
  if (await verifyAdminPassword(newPassword, user.password_hash)) return "same_password" as const;

  const password_hash = await hashAdminPassword(newPassword);
  const { data, error } = await supabase
    .from("admin_users")
    .update({ password_hash, session_version: user.session_version + 1 })
    .eq("id", id)
    .eq("session_version", user.session_version)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data ? "updated" as const : "conflict" as const;
}

export async function changeAdminUsername(id: string, currentPassword: string, newUsername: string) {
  const { data: user, error: findError } = await supabase
    .from("admin_users")
    .select("username,password_hash,active")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!user || !user.active) return "not_found" as const;
  if (!(await verifyAdminPassword(currentPassword, user.password_hash))) return "invalid_current" as const;
  if (user.username === newUsername) return "unchanged" as const;

  const { data, error } = await supabase
    .from("admin_users")
    .update({ username: newUsername })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return "taken" as const;
  if (error) throw error;
  return data ? "updated" as const : "not_found" as const;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("id,username,display_name,role,active,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function createAdminUser(info: {
  username: string;
  displayName: string;
  password: string;
  createdBy: string;
  role: AdminRole;
}) {
  const password_hash = await hashAdminPassword(info.password);
  const { data, error } = await supabase
    .from("admin_users")
    .insert({
      username: info.username,
      display_name: info.displayName,
      password_hash,
      role: info.role,
      active: true,
      created_by: info.createdBy,
    })
    .select("id,username,display_name,role,active,created_at")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw error;
  return data as AdminUser;
}

export async function setAdminUserActive(id: string, active: boolean) {
  const { data: target, error: targetError } = await supabase
    .from("admin_users")
    .select("id,role,active")
    .eq("id", id)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) return "not_found" as const;
  if (target.active === active) return "unchanged" as const;

  if (!active && target.role === "owner") {
    const { count, error } = await supabase
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner")
      .eq("active", true);
    if (error) throw error;
    if ((count ?? 0) <= 1) return "last_owner" as const;
  }

  const { error } = await supabase.from("admin_users").update({ active }).eq("id", id);
  if (error) throw error;
  return "updated" as const;
}
