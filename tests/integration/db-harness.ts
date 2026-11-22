import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(__dirname, "..", "..");

/**
 * Minimal stand-in for the parts of Supabase the migrations depend on:
 * the auth schema, auth.uid(), and the anon/authenticated/service_role roles.
 */
const SUPABASE_SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export async function createTestDatabase({ seed = true } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const migrationsDir = path.join(root, "supabase", "migrations");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  if (seed) await db.exec(readFileSync(path.join(root, "supabase", "seed.sql"), "utf8"));
  return db;
}

export async function createUser(db: PGlite, id: string, fullName = "Test Student") {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${id.slice(0, 8)}@example.com`,
    JSON.stringify({ full_name: fullName }),
  ]);
}

/** Run `fn` as an authenticated client user (RLS applies). */
export async function asUser<T>(db: PGlite, userId: string, fn: (tx: PGlite) => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn(db);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function asRole<T>(db: PGlite, role: "anon" | "service_role", fn: (tx: PGlite) => Promise<T>): Promise<T> {
  await db.exec(`set role ${role};`);
  try {
    return await fn(db);
  } finally {
    await db.exec(`reset role;`);
  }
}
