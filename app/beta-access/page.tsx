"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function BetaAccessForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get("redirect") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setLoading(true);

    const res = await fetch("/api/beta-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, redirect }),
    });

    if (res.ok) {
      const { redirect: url } = await res.json();
      router.push(url);
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-8">
        <div className="flex justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2L4 7V14C4 19.5 8.5 24.7 14 26C19.5 24.7 24 19.5 24 14V7L14 2Z" fill="#1e40af" stroke="#3b82f6" strokeWidth="1.5"/>
            <path d="M10 14L13 17L18 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-1">
          Beta Access
        </h1>
        <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-6">
          Enter the access password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-red-700 dark:text-red-400 text-sm">
              Incorrect password. Please try again.
            </div>
          )}

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2 px-4 bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BetaAccessPage() {
  return (
    <Suspense>
      <BetaAccessForm />
    </Suspense>
  );
}
