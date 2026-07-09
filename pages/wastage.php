<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/layout.php';
requireRole('admin', 'stock');

$message = '';

// ── Save wastage record ───────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save') {
    $pid       = (int)($_POST['product_id'] ?? 0);
    $qty       = (float)($_POST['quantity'] ?? 0);
    $reason    = $_POST['reason'] ?? '';
    $note      = trim($_POST['note'] ?? '');
    $wDate     = $_POST['wastage_date'] ?: date('Y-m-d');
    $allowed   = ['expired','damaged','owner_use','sample','lost','other'];

    if (!$pid || $qty <= 0 || !in_array($reason, $allowed)) {
        $message = 'error:Please fill in all required fields correctly.';
    } else {
        $prod = $pdo->prepare("SELECT name, unit, stock, cost_price, product_type FROM products WHERE id=?");
        $prod->execute([$pid]);
        $prod = $prod->fetch();

        if (!$prod) {
            $message = 'error:Product not found.';
        } elseif ($prod['product_type'] !== 'bulk' && $qty > (float)$prod['stock']) {
            $message = 'error:Quantity exceeds available stock (' . (float)$prod['stock'] . ' ' . $prod['unit'] . ').';
        } else {
            $pdo->beginTransaction();
            try {
                $unitCost = $prod['cost_price'];
                if ($prod['product_type'] === 'regular') {
                    $unitCost = deductStockFIFO($pdo, $pid, $qty);
                } else {
                    $pdo->prepare("UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id=?")->execute([$qty, $pid]);
                }
                $pdo->prepare("INSERT INTO wastage (product_id, product_name, quantity, unit, unit_cost, reason, reason_note, wastage_date, created_by) VALUES (?,?,?,?,?,?,?,?,?)")
                    ->execute([$pid, $prod['name'], $qty, $prod['unit'], $unitCost, $reason, $note, $wDate, $_SESSION['user_id'] ?? null]);
                $pdo->commit();
                $message = 'success:Wastage recorded — ' . $qty . ' ' . $prod['unit'] . ' of ' . $prod['name'] . ' removed from stock.';
            } catch (Exception $e) {
                $pdo->rollBack();
                $message = 'error:' . $e->getMessage();
            }
        }
    }
}

// ── Delete wastage record ─────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete') {
    requireRole('admin');
    $wid = (int)($_POST['wastage_id'] ?? 0);
    if ($wid) {
        $row = $pdo->prepare("SELECT product_id, quantity, unit_cost FROM wastage WHERE id=?");
        $row->execute([$wid]);
        $row = $row->fetch();
        if ($row) {
            $pdo->beginTransaction();
            try {
                // Restore stock
                $pdo->prepare("UPDATE products SET stock = stock + ? WHERE id=?")->execute([$row['quantity'], $row['product_id']]);
                // Try to restore the most recent batch
                $batch = $pdo->prepare("SELECT id FROM batches WHERE product_id=? ORDER BY created_at DESC LIMIT 1");
                $batch->execute([$row['product_id']]);
                $batchId = $batch->fetchColumn();
                if ($batchId) {
                    $pdo->prepare("UPDATE batches SET quantity_remaining = quantity_remaining + ? WHERE id=?")->execute([$row['quantity'], $batchId]);
                }
                $pdo->prepare("DELETE FROM wastage WHERE id=?")->execute([$wid]);
                $pdo->commit();
                $message = 'success:Wastage record deleted and stock restored.';
            } catch (Exception $e) {
                $pdo->rollBack();
                $message = 'error:' . $e->getMessage();
            }
        }
    }
}

// ── Filters ───────────────────────────────────────────────────────────────────
$fReason = $_GET['reason'] ?? '';
$fFrom   = $_GET['from']   ?? date('Y-m-01');
$fTo     = $_GET['to']     ?? date('Y-m-d');
$fProd   = trim($_GET['product'] ?? '');

$where  = ['w.wastage_date BETWEEN ? AND ?'];
$params = [$fFrom, $fTo];
if ($fReason && $fReason !== 'all') { $where[] = 'w.reason = ?'; $params[] = $fReason; }
if ($fProd) { $where[] = 'w.product_name LIKE ?'; $params[] = "%$fProd%"; }
$whereSQL = 'WHERE ' . implode(' AND ', $where);

$records = $pdo->prepare("
    SELECT w.*, p.unit AS p_unit
    FROM wastage w
    LEFT JOIN products p ON p.id = w.product_id
    $whereSQL
    ORDER BY w.wastage_date DESC, w.id DESC
");
$records->execute($params);
$records = $records->fetchAll();

// Summary for current filter
$totalQty  = 0;
$totalCost = 0;
foreach ($records as $r) { $totalQty += $r['quantity']; $totalCost += $r['quantity'] * $r['unit_cost']; }

// Month-to-date total (regardless of filter)
$mtd = $pdo->prepare("SELECT COALESCE(SUM(quantity * unit_cost), 0) FROM wastage WHERE wastage_date BETWEEN ? AND ?");
$mtd->execute([date('Y-m-01'), date('Y-m-d')]);
$mtdCost = (float)$mtd->fetchColumn();

$reasonLabels = [
    'expired'   => ['label' => 'Expired',    'color' => 'danger',   'icon' => 'bi-calendar-x'],
    'damaged'   => ['label' => 'Damaged',    'color' => 'warning',  'icon' => 'bi-exclamation-triangle'],
    'owner_use' => ['label' => 'Owner Use',  'color' => 'info',     'icon' => 'bi-person'],
    'sample'    => ['label' => 'Sample',     'color' => 'primary',  'icon' => 'bi-gift'],
    'lost'      => ['label' => 'Lost',       'color' => 'secondary','icon' => 'bi-question-circle'],
    'other'     => ['label' => 'Other',      'color' => 'dark',     'icon' => 'bi-three-dots'],
];

renderHead('Wastage');
renderNav('wastage');
alertBox($message);
?>

<div class="container-fluid py-3">

<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <h4 class="fw-bold mb-0"><i class="bi bi-trash3 me-2"></i>Wastage</h4>
    <button class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#addWastageModal">
        <i class="bi bi-plus-lg me-1"></i>Record Wastage
    </button>
</div>

<!-- Summary cards -->
<div class="row g-3 mb-3">
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center">
            <div class="card-body py-3">
                <div class="text-muted small">This Month Loss</div>
                <div class="fw-bold fs-5 text-danger"><?= fmtUSD($mtdCost) ?></div>
            </div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center">
            <div class="card-body py-3">
                <div class="text-muted small">Filtered Records</div>
                <div class="fw-bold fs-5"><?= count($records) ?></div>
            </div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center">
            <div class="card-body py-3">
                <div class="text-muted small">Filtered Loss Value</div>
                <div class="fw-bold fs-5 text-danger"><?= fmtUSD($totalCost) ?></div>
            </div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="card stat-card text-center">
            <div class="card-body py-3">
                <div class="text-muted small">Filtered Qty</div>
                <div class="fw-bold fs-5"><?= number_format($totalQty, 2) ?></div>
            </div>
        </div>
    </div>
</div>

<!-- Filters -->
<form method="GET" class="card stat-card mb-3 p-3">
    <div class="row g-2 align-items-end">
        <div class="col-md-3">
            <label class="form-label small fw-semibold">Reason</label>
            <select name="reason" class="form-select form-select-sm">
                <option value="all" <?= !$fReason||$fReason==='all'?'selected':'' ?>>All Reasons</option>
                <?php foreach ($reasonLabels as $key => $r): ?>
                <option value="<?= $key ?>" <?= $fReason===$key?'selected':'' ?>><?= $r['label'] ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-2">
            <label class="form-label small fw-semibold">From</label>
            <input type="date" name="from" class="form-control form-control-sm" value="<?= htmlspecialchars($fFrom) ?>">
        </div>
        <div class="col-md-2">
            <label class="form-label small fw-semibold">To</label>
            <input type="date" name="to" class="form-control form-control-sm" value="<?= htmlspecialchars($fTo) ?>">
        </div>
        <div class="col-md-3">
            <label class="form-label small fw-semibold">Product</label>
            <input type="text" name="product" class="form-control form-control-sm" value="<?= htmlspecialchars($fProd) ?>" placeholder="Search by name...">
        </div>
        <div class="col-md-2 d-flex gap-1">
            <button type="submit" class="btn btn-sm btn-primary flex-grow-1"><i class="bi bi-funnel me-1"></i>Filter</button>
            <a href="wastage.php" class="btn btn-sm btn-outline-secondary"><i class="bi bi-x"></i></a>
        </div>
    </div>
</form>

<!-- Records table -->
<div class="card stat-card">
<div class="table-responsive">
<table class="table table-hover mb-0 align-middle">
    <thead class="table-dark">
        <tr>
            <th>Date</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Reason</th>
            <th>Note</th>
            <th class="text-end">Unit Cost</th>
            <th class="text-end">Total Loss</th>
            <th></th>
        </tr>
    </thead>
    <tbody>
    <?php if (!$records): ?>
    <tr><td colspan="8" class="text-center text-muted py-4">No wastage records in this range.</td></tr>
    <?php endif; ?>
    <?php foreach ($records as $r):
        $rl = $reasonLabels[$r['reason']] ?? ['label'=>ucfirst($r['reason']),'color'=>'secondary','icon'=>'bi-circle'];
        $loss = $r['quantity'] * $r['unit_cost'];
    ?>
    <tr>
        <td class="small"><?= date('d/m/Y', strtotime($r['wastage_date'])) ?></td>
        <td class="fw-semibold"><?= htmlspecialchars($r['product_name']) ?></td>
        <td><?= (float)$r['quantity'] ?> <?= htmlspecialchars($r['unit'] ?: ($r['p_unit'] ?? '')) ?></td>
        <td>
            <span class="badge bg-<?= $rl['color'] ?>">
                <i class="<?= $rl['icon'] ?> me-1"></i><?= $rl['label'] ?>
            </span>
        </td>
        <td class="small text-muted"><?= htmlspecialchars($r['reason_note'] ?? '') ?></td>
        <td class="text-end small"><?= fmtUSD($r['unit_cost']) ?></td>
        <td class="text-end fw-semibold text-danger"><?= fmtUSD($loss) ?></td>
        <td>
            <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
            <form method="POST" class="d-inline">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="wastage_id" value="<?= $r['id'] ?>">
                <button type="submit" class="btn btn-sm btn-outline-danger p-1"
                        onclick="return confirm('Delete this record and restore stock?')" title="Delete &amp; restore stock">
                    <i class="bi bi-arrow-counterclockwise"></i>
                </button>
            </form>
            <?php endif; ?>
        </td>
    </tr>
    <?php endforeach; ?>
    </tbody>
    <?php if ($records): ?>
    <tfoot class="table-light fw-bold">
        <tr>
            <td colspan="6" class="text-end">Total Loss:</td>
            <td class="text-end text-danger"><?= fmtUSD($totalCost) ?></td>
            <td></td>
        </tr>
    </tfoot>
    <?php endif; ?>
</table>
</div>
</div>

</div>

<!-- ── Add Wastage Modal ──────────────────────────────────────────────────────── -->
<div class="modal fade" id="addWastageModal" tabindex="-1">
<div class="modal-dialog">
<div class="modal-content">
<form method="POST" id="wastageForm" onsubmit="return validateWastage()">
<input type="hidden" name="action" value="save">
<div class="modal-header" style="background:#dc3545;color:#fff">
    <h5 class="modal-title fw-bold"><i class="bi bi-trash3 me-2"></i>Record Wastage</h5>
    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
</div>
<div class="modal-body">

    <!-- Product search -->
    <div class="mb-3">
        <label class="form-label fw-semibold">Product <span class="text-danger">*</span></label>
        <div class="position-relative">
            <input type="text" id="wastage-product-search" class="form-control" placeholder="Type product name or barcode..." autocomplete="off">
            <div id="wastage-product-drop" class="list-group position-absolute w-100 shadow" style="z-index:9999;display:none;max-height:200px;overflow-y:auto"></div>
        </div>
        <input type="hidden" name="product_id" id="wastage-product-id">
        <div id="wastage-product-info" class="small mt-1 d-none text-success"></div>
    </div>

    <!-- Quantity -->
    <div class="mb-3">
        <label class="form-label fw-semibold">Quantity <span class="text-danger">*</span></label>
        <div class="input-group">
            <input type="number" name="quantity" id="wastage-qty" class="form-control" min="0.001" step="0.001" placeholder="0" required>
            <span class="input-group-text" id="wastage-unit-label">units</span>
        </div>
        <div id="wastage-stock-hint" class="small text-muted mt-1"></div>
    </div>

    <!-- Reason -->
    <div class="mb-3">
        <label class="form-label fw-semibold">Reason <span class="text-danger">*</span></label>
        <div class="row g-2">
            <?php foreach ($reasonLabels as $key => $r): ?>
            <div class="col-6">
                <input type="radio" class="btn-check" name="reason" id="reason-<?= $key ?>" value="<?= $key ?>">
                <label class="btn btn-outline-<?= $r['color'] ?> w-100 text-start" for="reason-<?= $key ?>" style="font-size:.85rem">
                    <i class="<?= $r['icon'] ?> me-1"></i><?= $r['label'] ?>
                </label>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Note -->
    <div class="mb-3">
        <label class="form-label fw-semibold">Note <span class="text-muted small fw-normal">(optional)</span></label>
        <input type="text" name="note" class="form-control" placeholder="e.g. Found expired during shelf check">
    </div>

    <!-- Date -->
    <div class="mb-1">
        <label class="form-label fw-semibold">Wastage Date</label>
        <input type="date" name="wastage_date" class="form-control" value="<?= date('Y-m-d') ?>">
    </div>

</div>
<div class="modal-footer">
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
    <button type="submit" class="btn btn-danger fw-bold"><i class="bi bi-check2 me-1"></i>Record Wastage</button>
</div>
</form>
</div>
</div>
</div>

<script>
// ── Product search for wastage ────────────────────────────────────────────────
const wSearch = document.getElementById('wastage-product-search');
const wDrop   = document.getElementById('wastage-product-drop');
let   wSearchTimer = null;

if (wSearch) {
    wSearch.addEventListener('input', () => {
        clearTimeout(wSearchTimer);
        const q = wSearch.value.trim();
        if (q.length < 1) { wDrop.style.display = 'none'; return; }
        wSearchTimer = setTimeout(() => {
            fetch(`/stockpro/pages/api.php?action=search_products_purchase&q=${encodeURIComponent(q)}`)
                .then(r => r.json())
                .then(list => {
                    if (!list.length) { wDrop.style.display = 'none'; return; }
                    wDrop.innerHTML = list.map(p => `
                        <button type="button" class="list-group-item list-group-item-action py-2 px-3 small"
                                onclick='selectWastageProduct(${JSON.stringify(p)})'>
                            <strong>${p.name}</strong>
                            <span class="text-muted ms-2">${p.unit || ''}</span>
                            <span class="float-end text-success">${parseFloat(p.stock || 0).toFixed(2)} in stock</span>
                        </button>`).join('');
                    wDrop.style.display = 'block';
                });
        }, 250);
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('#wastage-product-search') && !e.target.closest('#wastage-product-drop'))
            wDrop.style.display = 'none';
    });
}

function selectWastageProduct(p) {
    document.getElementById('wastage-product-id').value   = p.id;
    document.getElementById('wastage-product-search').value = p.name;
    document.getElementById('wastage-unit-label').textContent = p.unit || 'units';
    wDrop.style.display = 'none';
    const info = document.getElementById('wastage-product-info');
    info.classList.remove('d-none');
    info.textContent = `Stock: ${parseFloat(p.stock || 0).toFixed(2)} ${p.unit || 'units'}  |  Cost: $${parseFloat(p.cost_price || 0).toFixed(4)}`;
    const hint = document.getElementById('wastage-stock-hint');
    hint.textContent = `Max: ${parseFloat(p.stock || 0).toFixed(3)} ${p.unit || 'units'}`;
    document.getElementById('wastage-qty').max = p.product_type === 'bulk' ? '' : parseFloat(p.stock || 0);
    document.getElementById('wastage-qty').focus();
}

function validateWastage() {
    if (!document.getElementById('wastage-product-id').value) {
        alert('Please select a product from the list.');
        return false;
    }
    if (!document.querySelector('input[name="reason"]:checked')) {
        alert('Please select a reason.');
        return false;
    }
    return true;
}
</script>

<?php renderFoot(); ?>
