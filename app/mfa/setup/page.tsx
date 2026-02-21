"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";

// ── Backup code helpers ──────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

type Screen = "enroll" | "backup-codes";

export default function MFASetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBackupCode = searchParams.get("from") === "backup-code";

  // Enrollment state
  const [factorId, setFactorId] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Backup codes state
  const [screen, setScreen] = useState<Screen>("enroll");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent text-sm";

  const startEnrollment = useCallback(async () => {
    // Reset all enrollment state so the spinner shows on retry/reset
    setInitError(null);
    setTotpUri("");
    setSecret("");
    setFactorId("");
    setVerifyCode("");
    setEnrollError(null);
    setShowSecret(false);

    // 1. Check what factors already exist for this user
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setInitError("Failed to check MFA status. Please refresh the page.");
      return;
    }

    // 2. If a verified factor already exists, MFA setup is complete — skip ahead.
    //    factors.totp is typed as verified-only by the SDK.
    if (factors.totp.length > 0) {
      router.replace("/certifications");
      return;
    }

    // 3. If an unverified (incomplete) factor exists, delete it before enrolling
    //    a fresh one. This is the root cause of the "factor already exists" error.
    //    Unverified factors only appear in factors.all, not factors.totp.
    const unverifiedFactor = factors.all.find(
      (f) => f.factor_type === "totp" && f.status === "unverified"
    );
    if (unverifiedFactor) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: unverifiedFactor.id,
      });
      if (unenrollError) {
        setInitError(
          "Failed to clear a previous incomplete MFA setup. Please refresh the page."
        );
        return;
      }
    }

    // 4. Enroll a brand-new TOTP factor
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    if (error || !data) {
      setInitError(
        error?.message ?? "Failed to start MFA setup. Please refresh the page."
      );
      return;
    }

    setFactorId(data.id);
    setTotpUri(data.totp.uri);
    setSecret(data.totp.secret);
  }, [router]);

  useEffect(() => {
    startEnrollment();
  }, [startEnrollment]);

  async function handleReset() {
    setResetting(true);
    await startEnrollment();
    setResetting(false);
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setEnrollLoading(true);
    setEnrollError(null);

    // Challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challengeData) {
      setEnrollError(
        challengeError?.message ?? "Failed to start verification. Please try again."
      );
      setEnrollLoading(false);
      return;
    }

    // Verify
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    });
    if (verifyError) {
      setEnrollError("Invalid code. Make sure your device clock is correct and try again.");
      setEnrollLoading(false);
      return;
    }

    // Generate and store backup codes
    setSaving(true);
    const codes = generateBackupCodes();
    const hashes = await Promise.all(codes.map(hashCode));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Clear any existing backup codes for this factor, then insert new ones
      await supabase
        .from("backup_codes")
        .delete()
        .eq("user_id", user.id)
        .eq("factor_id", factorId);

      await supabase.from("backup_codes").insert(
        hashes.map((code_hash) => ({
          user_id: user.id,
          factor_id: factorId,
          code_hash,
        }))
      );
    }

    setBackupCodes(codes);
    setSaving(false);
    setEnrollLoading(false);
    setScreen("backup-codes");
  }

  function downloadCodes() {
    const text = [
      "CPE Tracker — MFA Backup Codes",
      "Keep these codes safe. Each can only be used once.",
      "",
      ...backupCodes,
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");
    const a = document.createElement("a");
    a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    a.download = "cpe-tracker-backup-codes.txt";
    a.click();
  }

  async function handleDone() {
    await supabase.auth.refreshSession();
    router.push("/certifications");
    router.refresh();
  }

  // ── Backup codes screen ────────────────────────────────────────────────────
  if (screen === "backup-codes") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              MFA Enabled
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Save your backup codes — they won&apos;t be shown again.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <code
                  key={code}
                  className="text-sm font-mono text-center text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5"
                >
                  {code}
                </code>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Each code can only be used once. Using a backup code removes your authenticator — you&apos;ll be prompted to re-enroll immediately.
          </p>

          <div className="flex gap-3">
            <button
              onClick={downloadCodes}
              className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Download .txt
            </button>
            <button
              onClick={handleDone}
              className="flex-1 py-2 px-3 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors"
            >
              I&apos;ve saved these
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Enrollment screen ──────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Set Up Two-Factor Authentication
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {fromBackupCode
              ? "Your backup code was used. Please re-enroll a new authenticator."
              : "Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code."}
          </p>
        </div>

        {fromBackupCode && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2.5 text-amber-700 dark:text-amber-400 text-sm">
            Your previous authenticator was removed. Set up a new one to continue using the app.
          </div>
        )}

        {initError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-red-700 dark:text-red-400 text-sm mb-4">
            <p>{initError}</p>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="mt-2 underline disabled:opacity-50"
            >
              {resetting ? "Retrying…" : "Try again"}
            </button>
          </div>
        ) : !totpUri ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-900 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white border border-gray-200 dark:border-gray-600 rounded-xl">
                <QRCode value={totpUri} size={220} />
              </div>
            </div>

            {/* Secret fallback */}
            <div className="mb-5 text-center">
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="text-xs text-blue-900 dark:text-blue-400 hover:underline"
              >
                {showSecret ? "Hide secret key" : "Can't scan? Enter the key manually"}
              </button>
              {showSecret && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <code className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
                    {secret}
                  </code>
                </div>
              )}
            </div>

            {/* Verification form */}
            <form onSubmit={handleEnable} className="space-y-4">
              {enrollError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-red-700 dark:text-red-400 text-sm">
                  {enrollError}
                </div>
              )}
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  6-Digit Code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) =>
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className={`${inputClass} text-center tracking-widest text-lg`}
                />
              </div>
              <button
                type="submit"
                disabled={enrollLoading || saving || verifyCode.length < 6}
                className="w-full py-2 px-4 bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enrollLoading || saving ? "Enabling…" : "Enable MFA"}
              </button>
            </form>

            {/* Start Over — lets users recover from a stuck state */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting || enrollLoading || saving}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
              >
                {resetting ? "Resetting…" : "QR code not working? Start over"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
