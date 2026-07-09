"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMyMemberships } from "../(app)/org-actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirect") ?? "/";
    const { memberships } = await getMyMemberships();
    if (memberships.length > 1) {
      router.push(`/select-organization?redirect=${encodeURIComponent(redirectTo)}`);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 transition"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-center text-zinc-500">
        Accounts are provided by your administrator.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 overflow-hidden">
      {/* Fixed brand background — always the StockPro mark, regardless of any
          per-organization logo customization applied elsewhere in the app.
          Tiled so the whole viewport reads as branded, not just one faded
          center image; the card in front stays opaque enough to stay legible. */}
      <div
        className="absolute inset-0 pointer-events-none select-none opacity-[0.15] dark:opacity-20"
        style={{ backgroundImage: "url(/logo.png)", backgroundRepeat: "repeat", backgroundSize: "360px auto" }}
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-lg">
        <div className="flex justify-center mb-4">
          <div className="rounded-xl overflow-hidden shadow-sm">
            <Image src="/logo.png" alt="StockPro" width={220} height={120} priority className="h-auto w-44 block" />
          </div>
        </div>
        <p className="text-sm text-zinc-500 text-center mb-6">
          Warehouse &amp; wholesale management
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
