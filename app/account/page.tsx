"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../AuthProvider";
import { supabase } from "@/lib/supabase";

type Panel = null | "regenerate" | "disable";

async function hashCode(code: string): Promise<string> {
  const clean = code.replace("-", "").toUpperCase();
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(clean)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}

export default function AccountPage() {
  const { user } = useAuth();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [unusedCodeCount, setUnusedCodeCount] = useState<number | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Panel / form state
  const [panel, setPanel] = useState<Panel>(null);
  const [panelCode, setPanelCode] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  // New backup codes after regeneration
  const [newCodes, setNewCodes] = useState<string[]>([]);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent text-sm";

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.[0] ?? null;
    setFactorId(totp?.id ?? null);

    if (totp && user) {
      const { count } = await supabase
        .from("backup_codes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("factor_id", totp.id)
        .is("used_at", null);
      setUnusedCodeCount(count ?? 0);
    }
    setLoadingMeta(false);
  }, [user]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  function openPanel(p: Panel) {
    setPanel(p);
    setPanelCode("");
    setPanelError(null);
    setNewCodes([]);
  }

  // ── Regenerate backup codes ─────────────────────────────────────────────────
  async function handleRegenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !user) return;
    setPanelLoading(true);
    setPanelError(null);

    // Verify TOTP to confirm identity
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: panelCode,
    });
    if (verifyError) {
      setPanelError("Invalid code. Please try again.");
      setPanelLoading(false);
      return;
    }

    // Delete old codes, generate new
    await supabase
      .from("backup_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("factor_id", factorId);

    const codes = generateBackupCodes();
    const hashes = await Promise.all(codes.map(hashCode));
    await supabase.from("backup_codes").insert(
      hashes.map((code_hash) => ({
        user_id: user.id,
        factor_id: factorId,
        code_hash,
      }))
    );

    setNewCodes(codes);
    setUnusedCodeCount(codes.length);
    setPanelLoading(false);
  }

  // ── Disable MFA ─────────────────────────────────────────────────────────────
  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !user) return;
    setPanelLoading(true);
    setPanelError(null);

    // Verify TOTP → upgrades to aal2, required to call unenroll
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: panelCode,
    });
    if (verifyError) {
      setPanelError("Invalid code. Please try again.");
      setPanelLoading(false);
      return;
    }

    // Unenroll the factor
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      setPanelError("Failed to disable MFA. Please try again.");
      setPanelLoading(false);
      return;
    }

    // Delete backup codes
    await supabase
      .from("backup_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("factor_id", factorId);

    // Refresh session — middleware will redirect to /mfa/setup since factor is gone
    await supabase.auth.refreshSession();
    window.location.href = "/mfa/setup";
  }

  function downloadCodes(codes: string[]) {
    const text = [
      "CPE Tracker — MFA Backup Codes",
      "Keep these codes safe. Each can only be used once.",
      "",
      ...codes,
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");
    const a = document.createElement("a");
    a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    a.download = "cpe-tracker-backup-codes.txt";
    a.click();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Account
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Manage your profile and security settings.
      </p>

      {/* Profile section */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Profile
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
            {user?.email ?? "—"}
          </p>
        </div>
      </section>

      {/* MFA section */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Two-Factor Authentication
          </h2>
          {!loadingMeta && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400" />
              Enabled
            </span>
          )}
        </div>

        {loadingMeta ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Backup codes row */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Backup codes
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {unusedCodeCount !== null
                    ? `${unusedCodeCount} of 8 remaining`
                    : "Loading…"}
                </p>
              </div>
              <button
                onClick={() => openPanel("regenerate")}
                className="text-sm text-blue-900 dark:text-blue-400 hover:underline font-medium"
              >
                Regenerate
              </button>
            </div>

            {/* Regenerate panel */}
            {panel === "regenerate" && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {newCodes.length > 0 ? (
                  <>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                      New backup codes — save them now
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {newCodes.map((code) => (
                        <code
                          key={code}
                          className="text-sm font-mono text-center text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5"
                        >
                          {code}
                        </code>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadCodes(newCodes)}
                        className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Download .txt
                      </button>
                      <button
                        onClick={() => openPanel(null)}
                        className="flex-1 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleRegenerate} className="space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Enter your current authenticator code to generate new backup codes. Your old codes will be invalidated.
                    </p>
                    {panelError && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {panelError}
                      </p>
                    )}
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={panelCode}
                      onChange={(e) =>
                        setPanelCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      required
                      placeholder="000000"
                      className={`${inputClass} text-center tracking-widest`}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openPanel(null)}
                        className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={panelLoading || panelCode.length < 6}
                        className="flex-1 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {panelLoading ? "Verifying…" : "Regenerate Codes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Disable row */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Disable and re-enroll
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Use this to switch to a new authenticator app.
                </p>
              </div>
              <button
                onClick={() => openPanel("disable")}
                className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Disable MFA
              </button>
            </div>

            {/* Disable panel */}
            {panel === "disable" && (
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <form onSubmit={handleDisable} className="space-y-3">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    This removes your current authenticator. You&apos;ll be immediately redirected to set up a new one — MFA is required to use this app.
                  </p>
                  {panelError && (
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                      {panelError}
                    </p>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={panelCode}
                    onChange={(e) =>
                      setPanelCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                    placeholder="Enter current 6-digit code to confirm"
                    className={`${inputClass} text-center tracking-widest`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openPanel(null)}
                      className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={panelLoading || panelCode.length < 6}
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {panelLoading ? "Disabling…" : "Disable MFA"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
