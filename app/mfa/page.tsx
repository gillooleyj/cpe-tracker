"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "totp" | "backup";

export default function MFAVerifyPage() {
  const router = useRouter();

  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [mode, setMode] = useState<Mode>("totp");

  // TOTP state
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  // Backup code state
  const [backupCode, setBackupCode] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  const [initError, setInitError] = useState<string | null>(null);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent text-sm";

  const initChallenge = useCallback(async () => {
    setInitError(null);
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError || !factors?.totp?.length) {
      setInitError("No authenticator found. Please sign in again.");
      return;
    }
    const id = factors.totp[0].id;
    setFactorId(id);

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: id });
    if (challengeError || !challenge) {
      setInitError("Failed to start MFA challenge. Please refresh.");
      return;
    }
    setChallengeId(challenge.id);
  }, []);

  useEffect(() => {
    initChallenge();
  }, [initChallenge]);

  // ── TOTP verification ────────────────────────────────────────────────────────
  async function handleTOTP(e: React.FormEvent) {
    e.preventDefault();
    setTotpLoading(true);
    setTotpError(null);

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: totpCode,
    });

    if (error) {
      setTotpError("Invalid code. Please try again.");
      setTotpLoading(false);
      // Re-issue a fresh challenge so the old one doesn't expire
      initChallenge();
      return;
    }

    router.push("/certifications");
    router.refresh();
  }

  // ── Backup code verification ─────────────────────────────────────────────────
  async function handleBackupCode(e: React.FormEvent) {
    e.preventDefault();
    setBackupLoading(true);
    setBackupError(null);

    try {
      const res = await fetch("/api/auth/use-backup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: backupCode.trim().toUpperCase(), factorId }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        setBackupError(error ?? "Invalid or already-used backup code.");
        setBackupLoading(false);
        return;
      }

      // Factor is now deleted — refresh session then middleware sends to /mfa/setup
      await supabase.auth.refreshSession();
      router.push("/mfa/setup?from=backup-code");
      router.refresh();
    } catch {
      setBackupError("Something went wrong. Please try again.");
      setBackupLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Two-Factor Authentication
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mode === "totp"
              ? "Enter the 6-digit code from your authenticator app."
              : "Enter one of your backup codes."}
          </p>
        </div>

        {initError && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-red-700 dark:text-red-400 text-sm">
            {initError}
          </div>
        )}

        {mode === "totp" ? (
          <form onSubmit={handleTOTP} className="space-y-4">
            {totpError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-red-700 dark:text-red-400 text-sm">
                {totpError}
              </div>
            )}
            <div>
              <label
                htmlFor="totp"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Authenticator Code
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                className={`${inputClass} text-center tracking-widest text-lg`}
              />
            </div>
            <button
              type="submit"
              disabled={totpLoading || totpCode.length < 6 || !challengeId}
              className="w-full py-2 px-4 bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {totpLoading ? "Verifying…" : "Verify"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleBackupCode} className="space-y-4">
            {backupError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-red-700 dark:text-red-400 text-sm">
                {backupError}
              </div>
            )}
            <div>
              <label
                htmlFor="backup"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Backup Code
              </label>
              <input
                id="backup"
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                required
                autoFocus
                autoComplete="off"
                placeholder="XXXXX-XXXXX"
                className={`${inputClass} text-center font-mono tracking-wider`}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Using a backup code will remove your authenticator. You&apos;ll
                need to re-enroll MFA immediately after.
              </p>
            </div>
            <button
              type="submit"
              disabled={backupLoading || !backupCode.trim() || !factorId}
              className="w-full py-2 px-4 bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backupLoading ? "Verifying…" : "Use Backup Code"}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "totp" ? "backup" : "totp"));
              setTotpError(null);
              setBackupError(null);
            }}
            className="text-sm text-blue-900 dark:text-blue-400 hover:underline"
          >
            {mode === "totp"
              ? "Use a backup code instead"
              : "Use authenticator app instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
