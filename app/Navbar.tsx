"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function linkClass(href: string) {
    return pathname?.startsWith(href)
      ? "text-blue-900 dark:text-blue-400"
      : "text-gray-600 dark:text-gray-400 hover:text-blue-900 dark:hover:text-blue-400";
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Top bar (always visible) ─────────────────────────────────────── */}
        <div className="flex items-center justify-between h-16">

          {/* Left: logo + desktop nav links */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2L4 7V14C4 19.5 8.5 24.7 14 26C19.5 24.7 24 19.5 24 14V7L14 2Z" fill="#1e40af" stroke="#3b82f6" strokeWidth="1.5"/>
                <path d="M10 14L13 17L18 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-gray-900 dark:text-white">Cred</span><span className="text-blue-600 dark:text-blue-400">Vault</span>
              </span>
            </div>

            {/* Desktop nav links — hidden on mobile */}
            {user && (
              <div className="hidden sm:flex items-center gap-8">
                <Link href="/certifications" className={`text-sm font-medium transition-colors ${linkClass("/certifications")}`}>
                  Certifications
                </Link>
                <Link href="/cpe-activities" className={`text-sm font-medium transition-colors ${linkClass("/cpe-activities")}`}>
                  CPE Activities
                </Link>
                <Link href="/account" className={`text-sm font-medium transition-colors ${linkClass("/account")}`}>
                  Account
                </Link>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Desktop sign out — hidden on mobile */}
            {user && (
              <button
                onClick={handleLogout}
                className="hidden sm:block px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Sign Out
              </button>
            )}

            {/* Theme toggle — always visible */}
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Mobile hamburger — hidden on desktop */}
            {user && (
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                className="sm:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {menuOpen ? (
                  /* X / close */
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  /* Hamburger */
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile dropdown menu ─────────────────────────────────────────── */}
        {user && menuOpen && (
          <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 py-2">
            <Link
              href="/certifications"
              className={`block px-2 py-3 text-sm font-medium rounded-lg transition-colors ${linkClass("/certifications")}`}
            >
              Certifications
            </Link>
            <Link
              href="/cpe-activities"
              className={`block px-2 py-3 text-sm font-medium rounded-lg transition-colors ${linkClass("/cpe-activities")}`}
            >
              CPE Activities
            </Link>
            <Link
              href="/account"
              className={`block px-2 py-3 text-sm font-medium rounded-lg transition-colors ${linkClass("/account")}`}
            >
              Account
            </Link>
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleLogout}
                className="w-full text-left px-2 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

      </div>
    </nav>
  );
}
