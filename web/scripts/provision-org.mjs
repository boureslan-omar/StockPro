#!/usr/bin/env node
// Developer-only tool: provision and manage StockPro organizations.
// Requires the service-role key, so it can never run from a customer browser.
//
// Usage (run from web/):
//   node scripts/provision-org.mjs create --name "Nuts Co" --slug nuts --email owner@nuts.com --password "secret123" [--full-name "Owner Name"]
//   node scripts/provision-org.mjs suspend --slug nuts
//   node scripts/provision-org.mjs resume  --slug nuts
//   node scripts/provision-org.mjs list

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
  default:
    console.log("Commands: create | suspend | resume | cancel | list");
    process.exit(1);
}
