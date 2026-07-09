<?php
require_once __DIR__ . '/../includes/config.php';
if (!isLoggedIn()) { header('Location: /dahdouh/login.php'); exit; }
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Customer Display</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #e6edf3; font-family: 'Segoe UI', sans-serif;
       height: 100vh; display: flex; flex-direction: column;
       align-items: center; justify-content: center; }
#welcome-msg { font-size: 2rem; color: rgba(255,255,255,.35); font-weight: 300; letter-spacing: 2px; }
#total-usd { font-size: 5rem; font-weight: 800; color: #3fb950; letter-spacing: -2px; line-height: 1; }
#total-lbp { font-size: 1.6rem; color: rgba(255,255,255,.5); margin-top: .4rem; }
</style>
</head>
<body>
<div id="welcome-msg">Welcome!</div>
<div id="total-usd" style="display:none">$0.00</div>
<div id="total-lbp" style="display:none">0 LL</div>
<script>
const RATE = <?= EXCHANGE_RATE ?>;
function applyState(d) {
    const total    = parseFloat(d.total) || 0;
    const hasItems = (d.items || []).length > 0;
    document.getElementById('welcome-msg').style.display = hasItems ? 'none' : '';
    document.getElementById('total-usd').style.display   = hasItems ? '' : 'none';
    document.getElementById('total-lbp').style.display   = hasItems ? '' : 'none';
    document.getElementById('total-usd').textContent = '$' + total.toFixed(2);
    document.getElementById('total-lbp').textContent = Math.round(total * RATE).toLocaleString() + ' LL';
}
window.addEventListener('storage', function(e) {
    if (e.key === 'posDisplay') try { applyState(JSON.parse(e.newValue || '{}')); } catch(x) {}
});
setInterval(function() {
    try { var r = localStorage.getItem('posDisplay'); if (r) applyState(JSON.parse(r)); } catch(x) {}
}, 2000);
try { var r = localStorage.getItem('posDisplay'); if (r) applyState(JSON.parse(r)); } catch(x) {}
</script>
</body>
</html>
