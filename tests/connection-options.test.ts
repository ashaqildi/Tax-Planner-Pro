import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { databaseConnectionOptions } from '../lib/db/connection-options.mjs';
import { SUPABASE_CA } from '../lib/db/supabase-ca.mjs';

test('pg retains the Supabase CA and strict TLS when the URI contains SSL parameters', () => {
  const url = 'postgresql://postgres.example:p%40ssword@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';
  const client = new pg.Client(databaseConnectionOptions(url));
  const params = (client as any).connectionParameters;
  assert.equal(params.host, 'aws-0-us-east-1.pooler.supabase.com');
  assert.equal(params.port, 6543);
  assert.equal(params.password, 'p@ssword');
  assert.equal(params.ssl.ca, SUPABASE_CA);
  assert.equal(params.ssl.rejectUnauthorized, true);
});

test('other PostgreSQL providers retain their original connection configuration', () => {
  const url = 'postgresql://test:example@db.example.org:5432/test?sslmode=verify-full';
  assert.deepEqual(databaseConnectionOptions(url), { connectionString: url });
});
