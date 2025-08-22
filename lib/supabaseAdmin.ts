// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,  // same URL
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!  // NEVER expose this to client
);
