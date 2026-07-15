import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadBackupToDrive } from "./google-drive";

// Every org-scoped business table, plus settings (keyed by organization_id + key
// instead of a bare id, but still just an organization_id filter away).
const BACKUP_TABLES = [
  "categories", "suppliers", "customers", "products",
  "purchases", "batches", "purchase_items", "sales", "sale_items",
  "customer_ledger", "customer_prices", "expenses", "cash_register_log",
  "cash_shifts", "consignment_ledger", "consignment_settlements",
  "supplier_ledger", "purchase_orders", "purchase_order_items",
  "customer_returns", "supplier_returns", "wastage", "audit_sessions", "audit_items",
  "quotations", "quotation_items", "settings",
] as const;

const RETENTION_DAYS = 14;
const BUCKET = "backups";

export async function runOrgBackup(admin: SupabaseClient, orgId: string, orgSlug: string) {
  const tables: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const { data, error } = await admin.from(table).select("*").eq("organization_id", orgId);
    if (error) throw new Error(`Backup failed reading ${table}: ${error.message}`);
    tables[table] = data ?? [];
  }

  const manifest = {
    organization_id: orgId,
    org_slug: orgSlug,
    generated_at: new Date().toISOString(),
    tables,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const path = `${orgSlug}/${dateStr}.json`;
  const manifestJson = JSON.stringify(manifest);
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, manifestJson, { contentType: "application/json", upsert: true });
  if (uploadErr) throw new Error(`Backup upload failed: ${uploadErr.message}`);

  await pruneOldBackups(admin, orgSlug);

  // Best-effort: Supabase Storage above is the backup of record. A connected
  // Google Drive is an extra copy for the operator — its failure shouldn't
  // fail the backup that already succeeded.
  let driveUploaded = false;
  try {
    const result = await uploadBackupToDrive(admin, orgId, `${dateStr}.json`, manifestJson);
    driveUploaded = result.uploaded;
  } catch (e) {
    console.error(`Google Drive backup upload failed for org ${orgSlug}:`, e);
  }

  const rowCount = Object.values(tables).reduce((s, rows) => s + rows.length, 0);
  return { path, rowCount, driveUploaded };
}

async function pruneOldBackups(admin: SupabaseClient, orgSlug: string) {
  const { data: files } = await admin.storage.from(BUCKET).list(orgSlug);
  if (!files) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const stale = files.filter((f) => f.name.replace(".json", "") < cutoffStr).map((f) => `${orgSlug}/${f.name}`);
  if (stale.length) await admin.storage.from(BUCKET).remove(stale);
}

export async function runAllOrgsBackup(admin: SupabaseClient) {
  const { data: orgs, error } = await admin.from("organizations").select("id, slug").eq("license_status", "active");
  if (error) throw new Error(error.message);

  const results: { org: string; ok: boolean; error?: string }[] = [];
  for (const org of orgs ?? []) {
    try {
      await runOrgBackup(admin, org.id, org.slug);
      results.push({ org: org.slug, ok: true });
    } catch (e) {
      results.push({ org: org.slug, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

export async function getLatestBackup(admin: SupabaseClient, orgSlug: string) {
  const { data: files } = await admin.storage.from(BUCKET).list(orgSlug, { sortBy: { column: "name", order: "desc" } });
  const latest = files?.[0];
  if (!latest) return null;

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(`${orgSlug}/${latest.name}`, 60);
  return { name: latest.name, updatedAt: latest.updated_at ?? latest.created_at, url: signed?.signedUrl ?? null };
}
