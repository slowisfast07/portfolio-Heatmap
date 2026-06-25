// Supabase client + cloud-sync helpers.
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build time. When either is missing
// the app runs in local/demo mode (supabaseEnabled === false) and never touches the network.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = !!(url && anon);
export const supabase = supabaseEnabled
  ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

/* normalize a Supabase auth user → the app's compact user shape */
export function normUser(u) {
  if (!u) return null;
  const m = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email || m.email || "",
    name: m.name || (u.email ? u.email.split("@")[0] : "투자자"),
    nickname: m.nickname || "",
    joined: (u.created_at || "").slice(0, 10),
    demo: false,
  };
}

/* portfolio cloud row (one per user, JSONB blob) */
export async function loadCloud(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.from("portfolios").select("data").eq("user_id", userId).maybeSingle();
  if (error) { console.warn("[cloud] load failed:", error.message); return null; }
  return data?.data || null;
}
export async function saveCloud(userId, data) {
  if (!supabase || !userId) return;
  const { error } = await supabase.from("portfolios").upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.warn("[cloud] save failed:", error.message);
}
