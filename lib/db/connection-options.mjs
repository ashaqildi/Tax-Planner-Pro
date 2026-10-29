import { SUPABASE_CA } from './supabase-ca.mjs';

/** @param {string | undefined} connectionString */
export function databaseConnectionOptions(connectionString) {
  if (!connectionString) return { connectionString };
  const url = new URL(connectionString);
  const supabase = url.hostname.endsWith('.pooler.supabase.com') || url.hostname.endsWith('.supabase.co');
  if (!supabase) return { connectionString };
  // pg's URL SSL parameters replace the explicit SSL object. Remove them so
  // the official provider CA and strict certificate/hostname checks survive.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca: SUPABASE_CA, rejectUnauthorized: true } };
}
