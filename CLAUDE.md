# StockPro — Claude Context

StockPro is a **separate POS/inventory product** targeting warehouses and wholesale businesses.
It was bootstrapped from the dahdouh mini market codebase (v3.2.1) but is now an independent project
with its own feature roadmap, its own GitHub repo (to be created), and its own database.

## Core identity
- **Product:** Warehouse & wholesale management system
- **NOT** a mini market POS — different business model, different features needed
- Working directory: `c:\xampp\htdocs\stockpro\`
- URL: `http://localhost/stockpro/`
- Database: `pos_stockpro`
- Version at fork: **v3.2.1** (dahdouh base)

## Tech stack
- PHP 8+ / MySQL (MariaDB 10.4) / XAMPP
- No framework — plain PDO, Bootstrap 5, vanilla JS fetch API
- Bootstrap Icons for UI

## Architecture (inherited, may diverge)
- `includes/config.php` — DB connection (`pos_stockpro`), auth, `requireRole()`, `checkLicense()`
- `includes/layout.php` — `renderHead()`, `renderNav()` (scrollable navbar, uiScale)
- `includes/license.php` — RSA machine-locked license
- `pages/api.php` — all AJAX endpoints
- `assets/css/pos.css` — CSS custom properties (`--ui-scale`)

## Key design decisions (inherited)
- All prices stored in **USD**; LBP displayed via exchange rate from `settings` table
- FIFO batch stock for regular products
- Customer ledger: positive = credit, negative = debt
- `date_default_timezone_set('Asia/Beirut')` in config.php — do not remove

## GitHub
- New dedicated repo to be created for stockpro
- Auto-update disabled for now (manifest URL blank in settings)
- License tools remain in `dahdouh/tools/` — never copy to stockpro

## Security rules (never violate)
- `dahdouh/tools/private_key.pem` must NEVER be deployed anywhere
- `pos-license-vault` GitHub repo must stay private
- New features for stockpro go here only — do not back-port to dahdouh unless explicitly asked
