/**
 * Seed script: creates the initial super_user account.
 *
 * Usage (after filling in .env):
 *   npx tsx scripts/seedSuperUser.ts
 *
 * This script:
 *  1. Creates a Supabase Auth user (email: performa@headoffice.local, password: auto-generated)
 *  2. Inserts the matching row in the `users` table with role='super_user', PIN=5555
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// ---------- Config ----------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SERVICE_ROLE || '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌  Missing VITE_SUPABASE_URL or SERVICE_ROLE in environment.');
  console.error('    Run with:  npx tsx --env-file=.env scripts/seedSuperUser.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- Helpers ----------
function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

// ---------- Main ----------
async function seed() {
  const email = 'info@performabi.com';
  const password = 'p3rf0rm4';   // default password — change after first login
  const username = 'performa';
  const fullName = 'Performa (Super User)';
  const pin = '5555';

  console.log('🔧  Creating Supabase Auth user …');

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    // If user already exists, try to look them up
    if (authError.message?.includes('already been registered')) {
      console.log('ℹ️   Auth user already exists — looking up ID …');
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === email);
      if (!existing) {
        console.error('❌  Could not find existing auth user.');
        process.exit(1);
      }
      await upsertProfile(existing.id, username, fullName, pin);
      return;
    }
    console.error('❌  Auth error:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅  Auth user created: ${userId}`);

  await upsertProfile(userId, username, fullName, pin);
}

async function upsertProfile(
  userId: string,
  username: string,
  fullName: string,
  pin: string,
) {
  console.log('🔧  Upserting users profile …');

  const { error } = await supabase.from('users').upsert(
    {
      user_id: userId,
      username,
      pin_hash: hashPin(pin),
      full_name: fullName,
      role: 'super_user',
      is_active: true,
      assigned_store_id: null,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('❌  Profile upsert error:', error.message);
    process.exit(1);
  }

  console.log('✅  Super user profile ready!');
  console.log('');
  console.log('   📧 Email:    info@performabi.com');
  console.log('   🔑 Password: p3rf0rm4');
  console.log('   🔢 PIN:      5555');
  console.log('');
  console.log('   ⚠️  Change the password after your first login.');
}

seed();
