<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/layout.php';
requireRole('admin');

$message = '';

// ── Create audit ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'create_audit') {
    $auditDate  = $_POST['audit_date'] ?: date('Y-m-d');
    $note       = trim($_POST['note'] ?? '');
    $items      = $_POST['items'] ?? [];

    if (empty($items)) {
        $message = 'error:No items submitted.';
    } else {
        $pdo->beginTransaction();
        try {
            $pdo->prepare("INSERT INTO audit_sessions (audit_date, status, note, created_by) VALUES (?, 'completed', ?, ?)")
                ->execute([$auditDate, $note, $_SESSION['user_id'] ?? null]);
            $auditId = (int)$pdo->lastInsertId();

            $ins = $pdo->prepare("INSERT INTO audit_items (audit_id, product_id, product_name, system_qty, physical_qty, unit, note) VALUES (?,?,?,?,?,?,?)");
            foreach ($items as $item) {
                $pid      = (int)($item['product_id'] ?? 0);
                $sysQty   = (float)($item['system_qty'] ?? 0);
                $physQty  = (float)($item['physical_qty'] ?? 0);
                $pname    = trim($item['product_name'] ?? '');
                $unit     = trim($item['unit'] ?? 'pcs');
                $itemNote = trim($item['note'] ?? '');
                if (!$pid) continue;
                $ins->execute([$auditId, $pid, $pname, $sysQty, $physQty, $unit, $itemNote]);
            }
            $pdo->commit();
            $message = "success:Audit #$auditId created successfully.";
        } catch (Exception $e) {
            $pdo->rollBack();
            $message = 'error:' . $e->getMessage();
        }
    }
}

// ── Apply stock adjustments from audit ───────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'apply_audit') {
    $auditId = (int)($_POST['audit_id'] ?? 0);
    if ($auditId) {
        $items = $pdo->prepare("SELECT * FROM audit_items WHERE audit_id=?");
        $items->execute([$auditId]);
        $items = $items->fetchAll();

        $pdo->beginTransaction();
        try {
            foreach ($items as $item) {
                $discrepancy = (float)$item['physical_qty'] - (float)$item['system_qty'];
                if (abs($discrepancy) < 0.001) continue;
                // Adjust product stock to physical count
                $pdo->prepare("UPDATE products SET stock=? WHERE id=?")
                    ->execute([$item['physical_qty'], $item['product_id']]);
                // Adjust the most recent active batch
                if ($discrepancy != 0) {
                    $batch = $pdo->prepare("SELECT id, quantity_remaining FROM batches WHERE product_id=? AND quantity_remaining > 0 ORDER BY created_at DESC, id DESC LIMIT 1");
                    $batch->execute([$item['product_id']]);
                    $batch = $batch->fetch();
                    if ($batch) {
                        $newBatchQty = max(0, (float)$batch['quantity_remaining'] + $discrepancy);
                        $pdo->prepare("UPDATE batches SET quantity_remaining=? WHERE id=?")->execute([$newBatchQty, $batch['id']]);
                    }
                }
            }
            $pdo->prepare("UPDATE audit_sessions SET status='applied' WHERE id=?")->execute([$auditId]);
            $pdo->commit();
            $message = "success:Stock adjusted to match audit #$auditId.";
        } catch (Exception $e) {
            $pdo->rollBack();
            $message = 'error:' . $e->getMessage();
        }
    }
}

// ── Delete audit ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete_audit') {
    $auditId = (int)($_POST['audit_id'] ?? 0);
    if ($auditId) {
        $pdo->prepare("DELETE FROM audit_sessions WHERE id=?")->execute([$auditId]);
        $message = 'success:Audit deleted.';
    }
}

// ── Load products for new audit ───────────────────────────────────────────────
$categories = $pdo->query("SELECT * FROM categories ORDER BY name")->fetchAll();
$products   = $pdo->query("
    SELECT p.id, p.name, p.stock, p.unit, p.category_id, c.name AS cat_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.product_type = 'regular'
    ORDER BY p.name
")->fetchAll();

// ── Load past audits ──────────────────────────────────────────────────────────
$audits = $pdo->query("
    SELECT a.*,
           COUNT(ai.id)                                           AS item_count,
           SUM(ABS(ai.physical_qty - ai.system_qty))             AS total_discrepancy,
           SUM(CASE WHEN ai.physical_qty < ai.system_qty THEN 1 ELSE 0 END) AS shortage_count,
           SUM(CASE WHEN ai.physical_qty > ai.system_qty THEN 1 ELSE 0 END) AS surplus_count
    FROM audit_sessions a
    LEFT JOIN audit_items ai ON ai.audit_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
")->fetchAll();

// ── Load items for a specific audit (view) ────────────────────────────────────
$viewAuditId = (int)($_GET['view'] ?? 0);
$viewAudit   = null;
$viewItems   = [];
if ($viewAuditId) {
    $stmt = $pdo->prepare("SELECT * FROM audit_sessions WHERE id=?");
    $stmt->execute([$viewAuditId]);
    $viewAudit = $stmt->fetch();
    if ($viewAudit) {
        $stmt2 = $pdo->prepare("SELECT * FROM audit_items WHERE audit_id=? ORDER BY product_name");
        $stmt2->execute([$viewAuditId]);
        $viewItems = $stmt2->fetchAll();
    }
}

renderHead('Audits');
renderNav('audits');
alertBox($message);
?>

<div class="container-fluid py-3">

<?php if ($viewAudit): ?>
<!-- ── Audit Detail View ─────────────────────────────────────────────────── -->
<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <div>
        <a href="audits.php" class="btn btn-sm btn-outline-secondary me-2"><i class="bi bi-arrow-left"></i> Back</a>
        <h5 class="d-inline fw-bold">Audit — <?= date('d/m/Y', strtotime($viewAudit['audit_date'])) ?></h5>
        <span class="badge bg-<?= $viewAudit['status']==='applied'?'success':($viewAudit['status']==='completed'?'primary':'secondary') ?> ms-2">
            <?= ucfirst($viewAudit['status']) ?>
        </span>
    </div>
    <?php if ($viewAudit['status'] === 'completed'): ?>
    <form method="POST">
        <input type="hidden" name="action" value="apply_audit">
        <input type="hidden" name="audit_id" value="<?= $viewAudit['id'] ?>">
        <button type="submit" class="btn btn-warning fw-bold"
                onclick="return confirm('Apply these adjustments? Product stock will be updated to match physical counts.')"
                <i class="bi bi-check2-all me-1"></i>Apply Stock Adjustments
        </button>
    </form>
    <?php endif; ?>
</div>

<?php if ($viewAudit['note']): ?>
<div class="alert alert-info py-2 px-3 mb-3"><?= htmlspecialchars($viewAudit['note']) ?></div>
<?php endif; ?>

<?php
$shortages = array_filter($viewItems, fn($r) => $r['physical_qty'] < $r['system_qty']);
$surpluses = array_filter($viewItems, fn($r) => $r['physical_qty'] > $r['system_qty']);
$exact     = array_filter($viewItems, fn($r) => abs($r['physical_qty'] - $r['system_qty']) < 0.001);
?>
<div class="row g-3 mb-3">
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center"><div class="card-body py-3">
            <div class="text-muted small">Items Counted</div>
            <div class="fw-bold fs-5"><?= count($viewItems) ?></div>
        </div></div>
    </div>
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center"><div class="card-body py-3">
            <div class="text-muted small">Shortages</div>
            <div class="fw-bold fs-5 text-danger"><?= count($shortages) ?></div>
        </div></div>
    </div>
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center"><div class="card-body py-3">
            <div class="text-muted small">Surpluses</div>
            <div class="fw-bold fs-5 text-success"><?= count($surpluses) ?></div>
        </div></div>
    </div>
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center"><div class="card-body py-3">
            <div class="text-muted small">Exact Match</div>
            <div class="fw-bold fs-5 text-secondary"><?= count($exact) ?></div>
        </div></div>
    </div>
</div>

<div class="card stat-card">
<div class="table-responsive">
<table class="table table-hover align-middle mb-0">
    <thead class="table-dark">
        <tr><th>Product</th><th class="text-end">System Qty</th><th class="text-end">Physical Qty</th><th class="text-end">Discrepancy</th><th>Status</th><th>Note</th></tr>
    </thead>
    <tbody>
    <?php foreach ($viewItems as $r):
        $disc = (float)$r['physical_qty'] - (float)$r['system_qty'];
        $rowCls = abs($disc) < 0.001 ? '' : ($disc < 0 ? 'table-danger bg-opacity-25' : 'table-success bg-opacity-25');
    ?>
    <tr class="<?= $rowCls ?>">
        <td class="fw-semibold"><?= htmlspecialchars($r['product_name']) ?></td>
        <td class="text-end"><?= (float)$r['system_qty'] ?> <?= htmlspecialchars($r['unit']) ?></td>
        <td class="text-end"><?= (float)$r['physical_qty'] ?> <?= htmlspecialchars($r['unit']) ?></td>
        <td class="text-end fw-bold <?= $disc<0?'text-danger':($disc>0?'text-success':'text-muted') ?>">
            <?= $disc > 0 ? '+' : '' ?><?= round($disc, 3) ?>
        </td>
        <td>
            <?php if (abs($disc) < 0.001): ?>
            <span class="badge bg-success"><i class="bi bi-check2"></i> Match</span>
            <?php elseif ($disc < 0): ?>
            <span class="badge bg-danger"><i class="bi bi-arrow-down"></i> Shortage</span>
            <?php else: ?>
            <span class="badge bg-warning text-dark"><i class="bi bi-arrow-up"></i> Surplus</span>
            <?php endif; ?>
        </td>
        <td class="small text-muted"><?= htmlspecialchars($r['note'] ?? '') ?></td>
    </tr>
    <?php endforeach; ?>
    </tbody>
</table>
</div>
</div>

<?php else: ?>
<!-- ── Audit List ───────────────────────────────────────────────────────────── -->
<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <h4 class="fw-bold mb-0"><i class="bi bi-clipboard2-check me-2"></i>Stock Audits</h4>
    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#newAuditModal">
        <i class="bi bi-plus-lg me-1"></i>New Audit
    </button>
</div>

<div class="card stat-card">
<div class="table-responsive">
<table class="table table-hover align-middle mb-0">
    <thead class="table-dark">
        <tr><th>Date</th><th>Status</th><th>Items</th><th>Shortages</th><th>Surpluses</th><th>Total Disc.</th><th>Note</th><th>Actions</th></tr>
    </thead>
    <tbody>
    <?php if (!$audits): ?>
    <tr><td colspan="8" class="text-center text-muted py-4">No audits yet. Create one to get started.</td></tr>
    <?php endif; ?>
    <?php foreach ($audits as $a): ?>
    <tr>
        <td class="fw-semibold"><?= date('d/m/Y', strtotime($a['audit_date'])) ?></td>
        <td>
            <span class="badge bg-<?= $a['status']==='applied'?'success':($a['status']==='completed'?'primary':'secondary') ?>">
                <?= ucfirst($a['status'] ?? 'draft') ?>
            </span>
        </td>
        <td><?= (int)$a['item_count'] ?></td>
        <td class="text-danger fw-semibold"><?= (int)$a['shortage_count'] ?></td>
        <td class="text-success fw-semibold"><?= (int)$a['surplus_count'] ?></td>
        <td><?= round((float)$a['total_discrepancy'], 2) ?></td>
        <td class="small text-muted"><?= htmlspecialchars($a['note'] ?? '') ?></td>
        <td>
            <a href="?view=<?= $a['id'] ?>" class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i></a>
            <?php if ($a['status'] !== 'applied'): ?>
            <form method="POST" class="d-inline ms-1">
                <input type="hidden" name="action" value="delete_audit">
                <input type="hidden" name="audit_id" value="<?= $a['id'] ?>">
                <button type="submit" class="btn btn-sm btn-outline-danger" onclick="return confirm('Delete this audit?')">
                    <i class="bi bi-trash"></i>
                </button>
            </form>
            <?php endif; ?>
        </td>
    </tr>
    <?php endforeach; ?>
    </tbody>
</table>
</div>
</div>

<?php endif; ?>
</div>

<!-- ── New Audit Modal ───────────────────────────────────────────────────────── -->
<div class="modal fade" id="newAuditModal" tabindex="-1">
<div class="modal-dialog modal-xl">
<div class="modal-content">
<form method="POST" id="auditForm">
<input type="hidden" name="action" value="create_audit">
<div class="modal-header" style="background:#0d6efd;color:#fff">
    <h5 class="modal-title fw-bold"><i class="bi bi-clipboard2-check me-2"></i>New Stock Audit</h5>
    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
</div>
<div class="modal-body">

    <div class="row g-3 mb-3">
        <div class="col-md-3">
            <label class="form-label fw-semibold">Audit Date</label>
            <input type="date" name="audit_date" class="form-control" value="<?= date('Y-m-d') ?>">
        </div>
        <div class="col-md-3">
            <label class="form-label fw-semibold">Filter by Category</label>
            <select id="audit-cat-filter" class="form-select" onchange="filterAuditProducts()">
                <option value="">All Categories</option>
                <?php foreach ($categories as $c): ?>
                <option value="<?= $c['id'] ?>"><?= htmlspecialchars($c['name']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-6">
            <label class="form-label fw-semibold">Note (optional)</label>
            <input type="text" name="note" class="form-control" placeholder="e.g. Monthly audit — shelf check">
        </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="small text-muted">Enter the <strong>physical count</strong> for each product. Leave blank to skip.</div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="fillSystemQty()">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Reset All to System Qty
        </button>
    </div>

    <div class="table-responsive">
    <table class="table table-sm table-hover align-middle">
        <thead class="table-dark sticky-top">
            <tr>
                <th>Product</th>
                <th class="text-end" style="width:120px">System Qty</th>
                <th style="width:140px">Physical Count</th>
                <th style="width:90px">Variance</th>
                <th style="width:160px">Note</th>
            </tr>
        </thead>
        <tbody id="auditProductRows">
        <?php foreach ($products as $i => $p): ?>
        <tr class="audit-row" data-cat="<?= $p['category_id'] ?>">
            <td>
                <span class="fw-semibold"><?= htmlspecialchars($p['name']) ?></span>
                <?php if ($p['cat_name']): ?><span class="badge bg-light text-dark border ms-1" style="font-size:.65rem"><?= htmlspecialchars($p['cat_name']) ?></span><?php endif; ?>
                <input type="hidden" name="items[<?= $i ?>][product_id]"   value="<?= $p['id'] ?>">
                <input type="hidden" name="items[<?= $i ?>][product_name]" value="<?= htmlspecialchars($p['name'], ENT_QUOTES) ?>">
                <input type="hidden" name="items[<?= $i ?>][system_qty]"   value="<?= (float)$p['stock'] ?>">
                <input type="hidden" name="items[<?= $i ?>][unit]"         value="<?= htmlspecialchars($p['unit']) ?>">
            </td>
            <td class="text-end text-muted"><?= (float)$p['stock'] ?> <small><?= htmlspecialchars($p['unit']) ?></small></td>
            <td>
                <input type="number" name="items[<?= $i ?>][physical_qty]" id="phys-<?= $p['id'] ?>"
                       class="form-control form-control-sm text-center audit-phys"
                       data-sysqty="<?= (float)$p['stock'] ?>" data-pid="<?= $p['id'] ?>"
                       min="0" step="0.001" placeholder="Count..."
                       oninput="calcVariance(this)">
            </td>
            <td class="fw-bold text-center" id="var-<?= $p['id'] ?>">—</td>
            <td><input type="text" name="items[<?= $i ?>][note]" class="form-control form-control-sm" placeholder="Optional"></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    </div>

</div>
<div class="modal-footer">
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
    <button type="submit" class="btn btn-primary fw-bold">
        <i class="bi bi-save me-1"></i>Save Audit
    </button>
</div>
</form>
</div>
</div>
</div>

<script>
function calcVariance(inp) {
    const sysQty = parseFloat(inp.dataset.sysqty) || 0;
    const physQty = parseFloat(inp.value);
    const varEl = document.getElementById('var-' + inp.dataset.pid);
    if (!varEl) return;
    if (isNaN(physQty)) { varEl.textContent = '—'; varEl.className = 'fw-bold text-center text-muted'; return; }
    const diff = physQty - sysQty;
    varEl.textContent = (diff > 0 ? '+' : '') + diff.toFixed(3);
    varEl.className = 'fw-bold text-center ' + (Math.abs(diff) < 0.001 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-warning');
}

function filterAuditProducts() {
    const cat = document.getElementById('audit-cat-filter').value;
    document.querySelectorAll('.audit-row').forEach(tr => {
        tr.style.display = (!cat || tr.dataset.cat == cat) ? '' : 'none';
    });
}

function fillSystemQty() {
    document.querySelectorAll('.audit-phys').forEach(inp => {
        inp.value = inp.dataset.sysqty;
        calcVariance(inp);
    });
}
</script>

<?php renderFoot(); ?>
