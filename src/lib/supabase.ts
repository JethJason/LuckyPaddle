import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

// Next.js 14 caches fetch() responses by default; always read live data from Supabase.
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
});
