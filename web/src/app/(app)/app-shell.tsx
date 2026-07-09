"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Truck, ClipboardList,
  Building2, Users, RotateCcw, Trash2, ClipboardCheck, Receipt, Wallet,
  BarChart3, Settings, Menu, X, Bell,
} from "lucide-react";
import LogoutButton from "@/components/logout-button";
import OrgSwitcher from "./org-switcher";
import type { Membership } from "./org-actions";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { href: "/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/returns", label: "Returns", icon: RotateCcw },
  { href: "/wastage", label: "Wastage", icon: Trash2 },
  { href: "/audits", label: "Audits", icon: ClipboardCheck },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/cash-register", label: "Cash Register", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({
  children,
  userLabel,
  memberships,
  currentOrgId,
  orgName,
  licenseStatus,
  memberCount,
}: {
  children: React.ReactNode;
  userLabel: string;
  memberships: Membership[];
  currentOrgId: string | null;
  orgName: string;
  licenseStatus: string;
  memberCount: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#0f1224] text-white flex flex-col transition-transform md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b border-white/10">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-sm">S</span>
          <span className="font-bold text-lg">StockPro</span>
          <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  active ? "bg-blue-600 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 text-xs text-white/50">
          License: <span className={licenseStatus === "active" ? "text-green-400" : "text-red-400"}>{licenseStatus}</span>
          {" · "}
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main column */}
      <div className="flex-1 flex flex-col md:pl-60 min-w-0">
        <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3 px-4 h-16">
            <button onClick={() => setMobileOpen(true)} className="md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold truncate md:hidden">{orgName}</span>
            <div className="flex-1" />
            <button className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white" title="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <OrgSwitcher memberships={memberships} currentOrgId={currentOrgId} />
            <span className="text-sm text-zinc-500 hidden sm:inline whitespace-nowrap">{userLabel}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
