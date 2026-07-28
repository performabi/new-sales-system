/**
 * Seed script: creates the initial super_admin account.
 *
 * Usage (after .env is configured with your new Supabase project):
 *   npx tsx --env-file=.env scripts/seedSuperUser.ts
 *
 * This script:
 *  1. Invites info@performabi.com via Supabase Auth (sends invite email)
 *  2. Inserts the matching row in public.super_users with role='super_admin'
 *
 * Prerequisites:
 *  - SMTP configured in Supabase Auth settings (so invite emails send)
 *  - Migrations 000, 001, 002 already run in SQL Editor
 */
import { createClient } from '@supabase/supabase-js';

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

async function seed() {
  const email = 'info@performabi.com';
  const fullName = 'Performa (Super Admin)';

  console.log('🔧  Inviting super admin via Supabase Auth …');

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      is_super_admin: true,
      full_name: fullName,
    },
  });

  if (error) {
    // If already invited, look up existing user
    if (error.message?.includes('already been invited') || error.message?.includes('already been registered')) {
      console.log('ℹ️   Auth user already exists — looking up ID …');
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === email);
      if (!existing) {
        console.error('❌  Could not find existing auth user.');
        process.exit(1);
      }
      await upsertSuperUser(existing.id, email, fullName);
      return;
    }
    console.error('❌  Auth invite error:', error.message);
    process.exit(1);
  }

  if (!data?.user) {
    console.error('❌  No user returned from invite.');
    process.exit(1);
  }

  console.log(`✅  Auth invite sent: ${data.user.id}`);
  await upsertSuperUser(data.user.id, email, fullName);
}

async function upsertSuperUser(userId: string, email: string, fullName: string) {
  console.log('🔧  Adding to public.super_users …');

  const { error } = await supabase.from('super_users').upsert(
    {
      super_user_id: userId,
      email,
      full_name: fullName,
      role: 'super_admin',
      is_active: true,
    },
    { onConflict: 'super_user_id' },
  );

  if (error) {
    console.error('❌  super_users insert error:', error.message);
    process.exit(1);
  }

  console.log('✅  Super admin created!');
  console.log('');
  console.log('   📧 Email:    info@performabi.com');
  console.log('');
  console.log('   ℹ️  An invite email has been sent to this address.');
  console.log('   ℹ️  Click the link in the email to set your password.');
  console.log('');
  console.log('   ⚠️  After first login, you will be redirected to /admin/dashboard');
  console.log('   ⚠️  From there you can provision your own company tenant and');
  console.log('       then add more super_admin / support team members.');
}

seed();
