#!/usr/bin/env node
// Developer-only tool: provision and manage StockPro organizations.
// Requires the service-role key, so it can never run from a customer browser.
//
// Usage (run from web/):
//   node scripts/provision-org.mjs create --name "Nuts Co" --slug nuts --email owner@nuts.com --password "secret123" [--full-name "Owner Name"]
//   node scripts/provision-org.mjs suspend --slug nuts
//   node scripts/provision-org.mjs resume  --slug nuts
//   node scripts/provision-org.mjs list
//   node scripts/provision-org.mjs add-membership --email owner@nuts.com --slug other-biz --role admin
//   node scripts/provision-org.mjs list-memberships --email owner@nuts.com

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    /* fall through to process.env */
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in web/.env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const command = process.argv[2];

async function create() {
  const name = arg("name");
  const slug = arg("slug");
  const email = arg("email");
  const password = arg("password");
  const fullName = arg("full-name") ?? "";
  if (!name || !slug || !email || !password) {
    console.error('Required: --name "Business" --slug business --email owner@x.com --password "secret"');
    process.exit(1);
  }

  const licenseKey = "LIC-" + randomBytes(6).toString("hex").toUpperCase();

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name, slug, license_key: licenseKey })
    .select()
    .single();
  if (orgErr) {
    console.error("Failed to create organization:", orgErr.message);
    process.exit(1);
  }

  const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { organization_id: org.id, role: "admin" },
  });
  if (userErr) {
    await supabase.from("organizations").delete().eq("id", org.id);
    console.error("Failed to create admin user (org rolled back):", userErr.message);
    process.exit(1);
  }

  await supabase.from("org_memberships").insert({ user_id: userData.user.id, organization_id: org.id, role: "admin" });

  console.log("✔ Organization provisioned");
  console.log("  Name:        " + org.name);
  console.log("  License key: " + org.license_key);
  console.log("  Admin login: " + email);
  console.log("  Password:    " + password);
  console.log("  User ID:     " + userData.user.id);
  console.log("\nHand the login + license key to the business owner. They sign in directly — no registration step.");
}

async function setStatus(status) {
  const slug = arg("slug");
  const key = arg("license");
  if (!slug && !key) {
    console.error("Required: --slug <slug> or --license <LIC-...>");
    process.exit(1);
  }
  let q = supabase.from("organizations").update({ license_status: status }).select();
  q = slug ? q.eq("slug", slug) : q.eq("license_key", key);
  const { data, error } = await q;
  if (error || !data?.length) {
    console.error("Failed:", error?.message ?? "organization not found");
    process.exit(1);
  }
  console.log(`✔ ${data[0].name} → ${status}`);
}

async function list() {
  const { data, error } = await supabase
    .from("organizations")
    .select("name, slug, license_key, license_status, created_at")
    .order("created_at");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.table(data);
}

async function addMembership() {
  const email = arg("email");
  const slug = arg("slug");
  const role = arg("role") ?? "cashier";
  if (!email || !slug) {
    console.error('Required: --email owner@x.com --slug business [--role admin|cashier|stock]');
    process.exit(1);
  }

  const { data: org, error: orgErr } = await supabase.from("organizations").select("id, name").eq("slug", slug).single();
  if (orgErr || !org) {
    console.error("Organization not found:", slug);
    process.exit(1);
  }

  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) {
    console.error(userErr.message);
    process.exit(1);
  }
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error("No existing user with that email — use `create` for a brand new user.");
    process.exit(1);
  }

  const { error } = await supabase.from("org_memberships").upsert(
    { user_id: user.id, organization_id: org.id, role },
    { onConflict: "user_id,organization_id" }
  );
  if (error) {
    console.error("Failed to add membership:", error.message);
    process.exit(1);
  }

  console.log(`✔ ${email} can now switch into "${org.name}" as ${role}`);
}

async function listMemberships() {
  const email = arg("email");
  if (!email) {
    console.error("Required: --email owner@x.com");
    process.exit(1);
  }
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error("No user with that email.");
    process.exit(1);
  }
  const { data, error } = await supabase
    .from("org_memberships")
    .select("role, organizations(name, slug, license_status)")
    .eq("user_id", user.id);
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.table(data.map((m) => ({ org: m.organizations.name, slug: m.organizations.slug, role: m.role, status: m.organizations.license_status })));
}

switch (command) {
  case "create":
    await create();
    break;
  case "suspend":
    await setStatus("suspended");
    break;
  case "resume":
    await setStatus("active");
    break;
  case "cancel":
    await setStatus("cancelled");
    break;
  case "list":
    await list();
    break;
  case "add-membership":
    await addMembership();
    break;
  case "list-memberships":
    await listMemberships();
    break;
  default:
    console.log("Commands: create | suspend | resume | cancel | list | add-membership | list-memberships");
    process.exit(1);
}
