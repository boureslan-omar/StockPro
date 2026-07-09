import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/logout-button";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/pos", label: "POS" },
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
