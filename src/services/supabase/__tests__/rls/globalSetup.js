const { execSync } = require('node:child_process');

/**
 * Optional full reset before integration tests (local: FORCE_DB_RESET=1).
 * CI should run `supabase db reset` in the workflow before Jest.
 */
module.exports = async function globalSetup() {
  if (process.env.FORCE_DB_RESET !== '1') return;
  try {
    execSync('supabase db reset --yes', { cwd: process.cwd(), stdio: 'inherit' });
  } catch (e) {
    console.warn('[rls globalSetup] supabase db reset skipped or failed:', e?.message ?? e);
  }
};
