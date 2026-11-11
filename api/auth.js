
import { createClient } from "@supabase/supabase-js";

export async function requireAdmin(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    const error = new Error("Invalid authentication token");
    error.status = 401;
    throw error;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const adminUserId = process.env.SUPABASE_ADMIN_USER_ID;

  if (!supabaseUrl || !supabaseKey || !adminUserId) {
    const error = new Error(
      "Server authentication is not configured"
    );
    error.status = 500;
    throw error;
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } =
    await supabase.auth.getUser(token);

  if (error || !data?.user) {
    const authError = new Error("Invalid or expired session");
    authError.status = 401;
    throw authError;
  }

  if (data.user.id !== adminUserId) {
    const forbidden = new Error("Admin access required");
    forbidden.status = 403;
    throw forbidden;
  }

  return data.user;
}
