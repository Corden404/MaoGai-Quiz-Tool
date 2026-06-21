import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { createDeleteAccountHandler } from "./handler.mjs";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Required Supabase environment variables are missing.");
}

const authOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const adminClient = createClient(supabaseUrl, serviceRoleKey, authOptions);

const handler = createDeleteAccountHandler({
  getUserByToken: async (accessToken: string) => {
    const callerClient = createClient(supabaseUrl, anonKey, authOptions);
    const { data, error } = await callerClient.auth.getUser(accessToken);
    return error ? null : data.user;
  },

  verifyPassword: async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const verificationClient = createClient(supabaseUrl, anonKey, authOptions);
    const { data, error } = await verificationClient.auth.signInWithPassword({
      email,
      password,
    });
    return error ? null : data.user;
  },

  revokeSessions: async ({
    accessToken,
  }: {
    accessToken: string;
    userId: string;
  }) => {
    const { error } = await adminClient.auth.admin.signOut(accessToken, "global");
    if (error) throw error;
  },

  deleteUser: async (userId: string) => {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw error;
  },
});

Deno.serve(handler);
