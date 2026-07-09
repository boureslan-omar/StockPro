<?php
// ══════════════════════════════════════════════════════════════════════════════
//  UPGRADE 17 — v3.5.0
//  • products.track_expiry  — per-product expiry tracking toggle
//  • batches.expiry_date    — expiry date stored per batch
//  • customer_prices table  — last price per customer/product (for POS)
//  • wastage table          — stock removal records with reason
//  • audit_sessions table   — stock audit header
//  • audit_items table      — stock audit line items
//  Safe to run multiple times (idempotent).
// ══════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/includes/config.php';

if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'])) {
    http_response_code(403); die('Access denied.');
}

$steps  = [];
$errors = [];

// ── Block 1: products.track_expiry ──────────────────────────────────────────
try {
    $col = $pdo->query("SHOW COLUMNS FROM products LIKE 'track_expiry'")->fetch();
    if ($col) {
        $steps[] = 'products.track_expiry — already exists, skipped';
    } else {
        $pdo->exec("ALTER TABLE products ADD COLUMN track_expiry TINYINT(1) NOT NULL DEFAULT 0");
        $steps[] = 'products.track_expiry — column added';
    }
} catch (Exception $e) {
    $errors[] = 'Block 1 (products.track_expiry): ' . $e->getMessage();
}

// ── Block 2: batches.expiry_date ────────────────────────────────────────────
try {
    $col = $pdo->query("SHOW COLUMNS FROM batches LIKE 'expiry_date'")->fetch();
    if ($col) {
        $steps[] = 'batches.expiry_date — already exists, skipped';
    } else {
        $pdo->exec("ALTER TABLE batches ADD COLUMN expiry_date DATE NULL DEFAULT NULL");
        $steps[] = 'batches.expiry_date — column added';
    }
} catch (Exception $e) {
    $errors[] = 'Block 2 (batches.expiry_date): ' . $e->getMessage();
}

// ── Block 3: customer_prices table ──────────────────────────────────────────
try {
    $tbl = $pdo->query("SHOW TABLES LIKE 'customer_prices'")->fetch();
    if ($tbl) {
        $steps[] = 'customer_prices — already exists, skipped';
    } else {
        $pdo->exec("
            CREATE TABLE customer_prices (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                product_id  INT NOT NULL,
                last_price  DECIMAL(10,4) NOT NULL,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_cust_prod (customer_id, product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $steps[] = 'customer_prices — table created';
    }
} catch (Exception $e) {
    $errors[] = 'Block 3 (customer_prices): ' . $e->getMessage();
}

// ── Block 4: wastage table ───────────────────────────────────────────────────
try {
    $tbl = $pdo->query("SHOW TABLES LIKE 'wastage'")->fetch();
    if ($tbl) {
        $steps[] = 'wastage — already exists, skipped';
    } else {
        $pdo->exec("
            CREATE TABLE wastage (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                product_id   INT NOT NULL,
                product_name VARCHAR(255),
                quantity     DECIMAL(10,3) NOT NULL,
                unit         VARCHAR(20),
                unit_cost    DECIMAL(10,4) DEFAULT 0,
                reason       ENUM('expired','damaged','owner_use','sample','lost','other') NOT NULL,
                reason_note  TEXT,
                wastage_date DATE NOT NULL,
                created_by   INT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $steps[] = 'wastage — table created';
    }
} catch (Exception $e) {
    $errors[] = 'Block 4 (wastage): ' . $e->getMessage();
}

// ── Block 5: audit_sessions table ───────────────────────────────────────────
try {
    $tbl = $pdo->query("SHOW TABLES LIKE 'audit_sessions'")->fetch();
    if ($tbl) {
        $steps[] = 'audit_sessions — already exists, skipped';
    } else {
        $pdo->exec("
            CREATE TABLE audit_sessions (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                audit_date DATE NOT NULL,
                status     ENUM('in_progress','completed','applied') DEFAULT 'completed',
                note       TEXT,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $steps[] = 'audit_sessions — table created';
    }
} catch (Exception $e) {
    $errors[] = 'Block 5 (audit_sessions): ' . $e->getMessage();
}

// ── Block 6: audit_items table ──────────────────────────────────────────────
try {
    $tbl = $pdo->query("SHOW TABLES LIKE 'audit_items'")->fetch();
    if ($tbl) {
        $steps[] = 'audit_items — already exists, skipped';
    } else {
        $pdo->exec("
            CREATE TABLE audit_items (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                audit_id     INT NOT NULL,
                product_id   INT NOT NULL,
                product_name VARCHAR(255),
                system_qty   DECIMAL(10,3) NOT NULL,
                physical_qty DECIMAL(10,3) NOT NULL,
                unit         VARCHAR(20),
                note         TEXT,
                FOREIGN KEY (audit_id) REFERENCES audit_sessions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $steps[] = 'audit_items — table created';
    }
} catch (Exception $e) {
    $errors[] = 'Block 6 (audit_items): ' . $e->getMessage();
}

// ── Block 7: version.json → v3.5.0 ──────────────────────────────────────────
try {
    $vf = json_decode(file_get_contents(__DIR__ . '/version.json') ?: '{}', true) ?: [];
    if (in_array(17, $vf['installed_upgrades'] ?? [])) {
        $steps[] = 'version.json — upgrade 17 already marked, skipped';
    } else {
        $installed   = $vf['installed_upgrades'] ?? [];
        $installed[] = 17;
        sort($installed);
        $vf['installed_upgrades'] = $installed;
        $vf['version']      = '3.5.0';
        $vf['last_updated'] = date('Y-m-d');
        file_put_contents(__DIR__ . '/version.json', json_encode($vf, JSON_PRETTY_PRINT));
        $steps[] = 'version.json → v3.5.0, upgrade 17 marked installed';
    }
} catch (Exception $e) {
    $errors[] = 'Block 7 (version.json): ' . $e->getMessage();
}
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Upgrade 17 — v3.5.0</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
</head>
<body class="bg-light">
<div class="container py-5" style="max-width:680px">
<div class="card shadow-sm p-4">
  <h4 class="fw-bold mb-1"><i class="bi bi-arrow-up-circle me-2 text-success"></i>Upgrade 17 — v3.5.0</h4>
  <p class="text-muted small mb-1">What's new:</p>
  <ul class="small text-muted mb-4">
    <li><strong>Expiry Tracking</strong> — Products can now be flagged with "Track Expiry". Each batch stores an expiry date. The Products page shows an Expiry Monitor with expired and soon-to-expire batches.</li>
    <li><strong>Customer-Specific Pricing</strong> — POS remembers the last price charged to each customer per product. Opening a customer pre-fills saved prices and a margin % editor appears on each cart item.</li>
    <li><strong>Wastage</strong> — New Wastage page (admin/stock): record stock removals with reason (expired, damaged, owner use, sample, lost, other). Stock is deducted via FIFO. Records can be reviewed and deleted (stock restored).</li>
    <li><strong>Stock Audits</strong> — New Audits page (admin): create a full physical count session. System qty vs physical qty is compared per product. Optional "Apply Adjustments" updates stock to match the physical count.</li>
    <li><strong>Purchase Orders — Expiry Date</strong> — Receive PO modal now accepts expiry dates for products that have expiry tracking enabled.</li>
  </ul>

  <?php if ($errors): ?>
  <div class="alert alert-danger">
    <strong>Errors encountered:</strong>
    <ul class="mb-0 mt-2"><?php foreach ($errors as $e): ?><li><?= htmlspecialchars($e) ?></li><?php endforeach; ?></ul>
  </div>
  <?php endif; ?>

  <?php if ($steps): ?>
  <div class="alert alert-success">
    <strong>Steps completed:</strong>
    <ul class="mb-0 mt-2"><?php foreach ($steps as $s): ?><li><?= htmlspecialchars($s) ?></li><?php endforeach; ?></ul>
  </div>
  <?php endif; ?>

  <?php if (!$errors): ?>
  <div class="alert alert-info mb-0"><i class="bi bi-check-circle me-1"></i>Upgrade 17 complete. You may delete <code>upgrade17.php</code>.</div>
  <?php else: ?>
  <div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle me-1"></i>Some steps failed — review errors above and re-run.</div>
  <?php endif; ?>

  <a href="/stockpro/" class="btn btn-primary mt-3">&larr; Dashboard</a>
</div>
</div>
</body>
</html>
