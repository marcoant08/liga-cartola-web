"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

const memberNav = [
  { href: "/", label: "Minhas ligas" },
  { href: "/leagues/new", label: "Nova liga" },
  { href: "/leagues/join", label: "Entrar com convite" },
  { href: "/profile", label: "Perfil" },
];

const STATS_PAGE_PATH = /^\/leagues\/[^/]+\/estatisticas$/;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, ready } = useAuth();
  const hideHeader = STATS_PAGE_PATH.test(pathname);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {!hideHeader && (
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link href={user ? "/" : "/login"} className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
            Liga Cartola
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {user ? (
              memberNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      active
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })
            ) : (
              <>
                <Link
                  href="/login"
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    pathname === "/login"
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }`}
                >
                  Entrar
                </Link>
                <Link
                  href="/register"
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    pathname === "/register"
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }`}
                >
                  Cadastrar
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            {user ? (
              <>
                <span className="max-w-[200px] truncate" title={user.email}>
                  {user.name ?? user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    window.location.href = "/login";
                  }}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Sair
                </button>
              </>
            ) : ready ? (
              <span className="text-zinc-500">Não autenticado</span>
            ) : (
              <span className="text-zinc-400">…</span>
            )}
          </div>
        </div>
      </header>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
