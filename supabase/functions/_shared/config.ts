// Shared configuration for all Edge Functions
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export function getSupabaseClient() {
  const { createClient } = require('npm:@supabase/supabase-js@2');
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}
