import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/logout-button";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/pos", label: "POS" },
  { href: "/quotations", label: "Quotations" },
  { href: "/products", label: "Products" },
  { href: "/purchases", label: "Purchases" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/customers", label: "Customers" },
  { href: "/returns", label: "Returns" },
  { href: "/wastage", label: "Wastage" },
  { href: "/audits", label: "Audits" },
  { href: "/expenses", label: "Expenses" },
  { href: "/cash-register", label: "Cash Register" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  // License gate: JWT app_metadata carries the org; RLS lets a user read only
  // their own organization row. No row (stale pre-tenant session) or a
  // non-active license both block access.
  const { data: org } = await supabase
    .from("organizations")
    .select("name, license_status")
    .maybeSingle();

  if (!org || org.license_status !== "active") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
          <h1 className="text-xl font-bold mb-2">
            {org ? "Subscription inactive" : "Session refresh needed"}
          </h1>
          <p className="text-sm text-zinc-500 mb-4">
            {org
              ? `The ${org.name} subscription is currently ${org.license_status}. Please contact your provider to restore access.`
              : "Your account was updated. Please log out and sign in again to continue."}
          </p>
          <LogoutButton />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-4 px-4 h-14">
          <Link href="/" className="font-bold text-lg whitespace-nowrap">
            StockPro
          </Link>
          <nav className="flex-1 flex gap-1 overflow-x-auto text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-md whitespace-nowrap text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm whitespace-nowrap">
            <span className="text-zinc-500 hidden sm:inline">
              {profile?.full_name || user.email}
              {profile?.role ? ` · ${profile.role}` : ""}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="p-4 md:p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
