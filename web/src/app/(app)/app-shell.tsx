"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Truck, ClipboardList,
  Building2, Users, RotateCcw, Trash2, ClipboardCheck, Receipt, Wallet,
  BarChart3, Settings, Menu, X, Bell, ChevronLeft, ChevronRight,
} from "lucide-react";
import LogoutButton from "@/components/logout-button";
import OrgSwitcher from "./org-switcher";
import type { Membership } from "./org-actions";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Sales",
    items: [
      { href: "/pos", label: "POS", icon: ShoppingCart },
      { href: "/quotations", label: "Quotations", icon: FileText },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/returns", label: "Returns", icon: RotateCcw },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/purchases", label: "Purchases", icon: Truck },
      { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
      { href: "/suppliers", label: "Suppliers", icon: Building2 },
      { href: "/wastage", label: "Wastage", icon: Trash2 },
      { href: "/audits", label: "Audits", icon: ClipboardCheck },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/cash-register", label: "Cash Register", icon: Wallet },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

const COLLAPSE_COOKIE = "sidebar-collapsed";

export default function AppShell({
  children,
  userLabel,
  memberships,
  currentOrgId,
  orgName,
  licenseStatus,
  memberCount,
  initialCollapsed,
}: {
  children: React.ReactNode;
  userLabel: string;
  memberships: Membership[];
  currentOrgId: string | null;
  orgName: string;
  licenseStatus: string;
  memberCount: number;
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Seeded from a cookie the server already read, so the very first paint
  // (server-rendered, before hydration) already matches the user's saved
  // preference — no flash of the wrong width on load.
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${COLLAPSE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000`;
      return next;
    });
  }

  const sidebarWidth = collapsed ? "md:w-16" : "md:w-60";
  const contentPad = collapsed ? "md:pl-16" : "md:pl-60";

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 ${sidebarWidth} bg-[#111c42] text-white flex flex-col transition-[transform,width] duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b border-white/10 shrink-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 font-bold text-sm shadow-sm shadow-blue-500/50">
            S
          </span>
          {!collapsed && <span className="font-bold text-lg truncate">StockPro</span>}
          <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full ${
            collapsed ? "space-y-2" : "space-y-5"
          }`}
        >
          {NAV_SECTIONS.map((section, i) => (
            <div key={section.label}>
              {i > 0 && collapsed && <div className="mx-2 mb-2 border-t border-white/10" />}
              <p
                className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35 leading-tight ${
                  collapsed ? "text-center px-1 whitespace-normal break-words" : "px-3"
                }`}
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        collapsed ? "justify-center" : ""
                      } ${active ? "bg-blue-500 text-white shadow-sm shadow-blue-500/40" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:flex absolute -right-3 bottom-24 h-6 w-6 items-center justify-center rounded-full bg-blue-500 hover:bg-blue-400 text-white shadow-md ring-2 ring-[#111c42] transition z-50"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {!collapsed && (
          <div className="px-4 py-3 border-t border-white/10 text-xs text-white/50 shrink-0">
            License: <span className={licenseStatus === "active" ? "text-green-400" : "text-red-400"}>{licenseStatus}</span>
            {" · "}
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </div>
        )}
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main column */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 md:border-l md:border-zinc-200 md:dark:border-zinc-800 ${contentPad}`}>
        <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3 px-4 md:px-6 h-16">
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
        <main className="flex-1 min-w-0 p-4 md:p-8 w-full overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
