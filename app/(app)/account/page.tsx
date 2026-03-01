"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../AuthProvider";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

// ── Static option lists ───────────────────────────────────────────────────────

const ORG_TYPE_OPTIONS = [
  "Federal Government",
  "State/Local Government",
  "DoD/Defense Contractor",
  "Healthcare Organization",
  "Financial Services",
  "Technology Company",
  "Consulting Firm",
  "Educational Institution",
  "Non-Profit Organization",
  "Self-Employed/Independent Consultant",
  "Private Sector - Small (under 50 employees)",
  "Private Sector - Medium (50–500 employees)",
  "Private Sector - Large (500+ employees)",
  "Other",
] as const;

const CERT_FOCUS_OPTIONS = [
  "Cybersecurity (CISSP, CISM, CEH, etc.)",
  "IT Management (ITIL, COBIT, etc.)",
  "Project Management (PMP, CAPM, etc.)",
  "Scrum/Agile (CSM, CSPO, SAFe, etc.)",
  "Cloud Computing (AWS, Azure, GCP, etc.)",
  "Privacy/Compliance (CIPP, CIPM, CGRC, etc.)",
  "Risk Management (CRISC, etc.)",
  "Multiple Focus Areas",
  "Other",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
  first_name:               string;
  last_name:                string;
  job_title:                string;
  organization_type:        string;
  city:                     string;
  state_province:           string;
  postal_code:              string;
  country:                  string;
  certification_focus:      string;
  remind_quarterly_submit:  boolean;
  remind_20hrs_unsubmitted: boolean;
  remind_90days_expiry:     boolean;
};

const EMPTY_PROFILE: Profile = {
  first_name:               "",
  last_name:                "",
  job_title:                "",
  organization_type:        "",
  city:                     "",
  state_province:           "",
  postal_code:              "",
  country:                  "",
  certification_focus:      "",
  remind_quarterly_submit:  false,
  remind_20hrs_unsubmitted: true,
  remind_90days_expiry:     true,
};

type MfaPanel = null | "regenerate" | "disable";

// ── Backup-code helpers (unchanged from original) ─────────────────────────────

async function hashCode(code: string): Promise<string> {
  const clean = code.replace("-", "").toUpperCase();
  return bcrypt.hash(clean, 10);
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user } = useAuth();

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent text-sm";
  const labelClass =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const selectClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent text-sm";

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile]               = useState<Profile>(EMPTY_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving]   = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Delete account state ───────────────────────────────────────────────────
  const [showDelete, setShowDelete]         = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState("");
  const [deleteLoading, setDeleteLoading]   = useState(false);
  const [deleteError, setDeleteError]       = useState<string | null>(null);

  // ── MFA state ──────────────────────────────────────────────────────────────
  const [factorId, setFactorId]             = useState<string | null>(null);
  const [unusedCodeCount, setUnusedCodeCount] = useState<number | null>(null);
  const [loadingMeta, setLoadingMeta]       = useState(true);
  const [panel, setPanel]                   = useState<MfaPanel>(null);
  const [panelCode, setPanelCode]           = useState("");
  const [panelError, setPanelError]         = useState<string | null>(null);
  const [panelLoading, setPanelLoading]     = useState(false);
  const [newCodes, setNewCodes]             = useState<string[]>([]);

  // ── Load profile ───────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);

    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setProfile({
        first_name:               data.first_name               ?? "",
        last_name:                data.last_name                ?? "",
        job_title:                data.job_title                ?? "",
        organization_type:        data.organization_type        ?? "",
        city:                     data.city                     ?? "",
        state_province:           data.state_province           ?? "",
        postal_code:              data.postal_code              ?? "",
        country:                  data.country                  ?? "",
        certification_focus:      data.certification_focus      ?? "",
        remind_quarterly_submit:  data.remind_quarterly_submit  ?? false,
        remind_20hrs_unsubmitted: data.remind_20hrs_unsubmitted ?? true,
        remind_90days_expiry:     data.remind_90days_expiry     ?? true,
      });
    }
    setProfileLoading(false);
  }, [user]);

  // ── Load MFA meta ──────────────────────────────────────────────────────────
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
    loadProfile();
    loadMeta();
  }, [loadProfile, loadMeta]);

  // ── Profile field helper ───────────────────────────────────────────────────
  function pf(key: keyof Profile, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function setPrefBool(
    key: "remind_quarterly_submit" | "remind_20hrs_unsubmitted" | "remind_90days_expiry",
    value: boolean
  ) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  // ── Save profile ───────────────────────────────────────────────────────────
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaveMsg(null);

    if (!profile.first_name.trim()) {
      setProfileSaveMsg({ type: "error", text: "First name is required." });
      return;
    }
    if (!profile.last_name.trim()) {
      setProfileSaveMsg({ type: "error", text: "Last name is required." });
      return;
    }

    setProfileSaving(true);

    const payload = {
      user_id:                  user!.id,
      first_name:               profile.first_name.trim(),
      last_name:                profile.last_name.trim(),
      job_title:                profile.job_title.trim()           || null,
      organization_type:        profile.organization_type          || null,
      city:                     profile.city.trim()                || null,
      state_province:           profile.state_province.trim()      || null,
      postal_code:              profile.postal_code.trim()         || null,
      country:                  profile.country.trim()             || null,
      certification_focus:      profile.certification_focus.trim() || null,
      remind_quarterly_submit:  profile.remind_quarterly_submit,
      remind_20hrs_unsubmitted: profile.remind_20hrs_unsubmitted,
      remind_90days_expiry:     profile.remind_90days_expiry,
    };

    const { error } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "user_id" });

    setProfileSaving(false);

    if (error) {
      setProfileSaveMsg({ type: "error", text: "Failed to save profile. Please try again." });
    } else {
      setProfileSaveMsg({ type: "success", text: "Profile saved." });
      // Auto-clear the success message after 4 seconds
      setTimeout(() => setProfileSaveMsg(null), 4_000);
    }
  }

  // ── MFA helpers (unchanged from original) ─────────────────────────────────
  function openPanel(p: MfaPanel) {
    setPanel(p);
    setPanelCode("");
    setPanelError(null);
    setNewCodes([]);
  }

  async function handleRegenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !user) return;
    setPanelLoading(true);
    setPanelError(null);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: panelCode,
    });
    if (verifyError) {
      setPanelError("Invalid code. Please try again.");
      setPanelLoading(false);
      return;
    }

    await supabase
      .from("backup_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("factor_id", factorId);

    const codes = generateBackupCodes();
    const hashes = await Promise.all(codes.map(hashCode));
    await supabase.from("backup_codes").insert(
      hashes.map((code_hash) => ({ user_id: user.id, factor_id: factorId, code_hash }))
    );

    setNewCodes(codes);
    setUnusedCodeCount(codes.length);
    setPanelLoading(false);
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !user) return;
    setPanelLoading(true);
    setPanelError(null);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: panelCode,
    });
    if (verifyError) {
      setPanelError("Invalid code. Please try again.");
      setPanelLoading(false);
      return;
    }

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      setPanelError("Failed to disable MFA. Please try again.");
      setPanelLoading(false);
      return;
    }

    await supabase
      .from("backup_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("factor_id", factorId);

    await supabase.auth.refreshSession();
    window.location.href = "/mfa/setup";
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);

    const res = await fetch("/api/account", { method: "DELETE" });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error ?? "Failed to delete account. Please try again.");
      setDeleteLoading(false);
      return;
    }

    // Sign out locally and return to home
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function downloadCodes(codes: string[]) {
    const text = [
      "Argus — MFA Backup Codes",
      "Keep these codes safe. Each can only be used once.",
      "",
      ...codes,
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");
    const a = document.createElement("a");
    a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    a.download = "argus-backup-codes.txt";
    a.click();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Account
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Manage your profile and security settings.
      </p>

      {/* ── Profile section ─────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">
          Profile
        </h2>

        {profileLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-4">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
            Loading profile…
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} noValidate className="space-y-5">

            {/* Email — read-only */}
            <div>
              <label className={labelClass}>Email</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                {user?.email ?? "—"}
              </p>
            </div>

            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className={labelClass}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={profile.first_name}
                  onChange={(e) => pf("first_name", e.target.value)}
                  autoComplete="given-name"
                  placeholder="Jane"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={profile.last_name}
                  onChange={(e) => pf("last_name", e.target.value)}
                  autoComplete="family-name"
                  placeholder="Smith"
                  className={inputClass}
                />
              </div>
            </div>

            <hr className="border-gray-100 dark:border-gray-700" />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Optional Details
            </p>

            {/* Job title */}
            <div>
              <label htmlFor="jobTitle" className={labelClass}>Job Title / Role</label>
              <input
                id="jobTitle"
                type="text"
                value={profile.job_title}
                onChange={(e) => pf("job_title", e.target.value)}
                autoComplete="organization-title"
                placeholder="e.g. Security Analyst"
                className={inputClass}
              />
            </div>

            {/* Organization type */}
            <div>
              <label htmlFor="orgType" className={labelClass}>Organization Type</label>
              <select
                id="orgType"
                value={profile.organization_type}
                onChange={(e) => pf("organization_type", e.target.value)}
                className={selectClass}
              >
                <option value="">Select type…</option>
                {ORG_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className={labelClass}>City</label>
                <input
                  id="city"
                  type="text"
                  value={profile.city}
                  onChange={(e) => pf("city", e.target.value)}
                  autoComplete="address-level2"
                  placeholder="e.g. Washington"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="stateProvince" className={labelClass}>
                  State / Province / Region
                </label>
                <input
                  id="stateProvince"
                  type="text"
                  value={profile.state_province}
                  onChange={(e) => pf("state_province", e.target.value)}
                  autoComplete="address-level1"
                  placeholder="e.g. DC"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="postalCode" className={labelClass}>
                  Postal Code / ZIP
                </label>
                <input
                  id="postalCode"
                  type="text"
                  value={profile.postal_code}
                  onChange={(e) => pf("postal_code", e.target.value)}
                  autoComplete="postal-code"
                  placeholder="e.g. 20001"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="country" className={labelClass}>Country</label>
                <input
                  id="country"
                  type="text"
                  value={profile.country}
                  onChange={(e) => pf("country", e.target.value)}
                  autoComplete="country-name"
                  placeholder="e.g. United States"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Primary certification focus */}
            <div>
              <label htmlFor="certFocus" className={labelClass}>
                Primary Certification Focus
              </label>
              <select
                id="certFocus"
                value={profile.certification_focus}
                onChange={(e) => pf("certification_focus", e.target.value)}
                className={selectClass}
              >
                <option value="">Select focus area…</option>
                {CERT_FOCUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {/* Save feedback */}
            {profileSaveMsg && (
              <p
                role="status"
                className={`text-sm ${
                  profileSaveMsg.type === "success"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {profileSaveMsg.text}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaving ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── Notification Preferences section ───────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Notification Preferences
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          Choose which reminders you&apos;d like to receive about your CPD submissions. (Future email notifications.)
        </p>

        {profileLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-4">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
            Loading preferences…
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} noValidate className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.remind_20hrs_unsubmitted}
                onChange={(e) => setPrefBool("remind_20hrs_unsubmitted", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-900 dark:accent-blue-400 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Unsubmitted hours reminder
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Notify me when I have more than 20 hours of unsubmitted CPD activities.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.remind_90days_expiry}
                onChange={(e) => setPrefBool("remind_90days_expiry", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-900 dark:accent-blue-400 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Expiry reminder
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Notify me when a certification expires within 90 days and I have unsubmitted hours.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.remind_quarterly_submit}
                onChange={(e) => setPrefBool("remind_quarterly_submit", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-900 dark:accent-blue-400 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Quarterly submission reminder
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Send me a quarterly reminder to submit my CPD activities to certification bodies.
                </p>
              </div>
            </label>

            {profileSaveMsg && (
              <p
                role="status"
                className={`text-sm ${
                  profileSaveMsg.type === "success"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {profileSaveMsg.text}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaving ? "Saving…" : "Save Preferences"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── MFA section ─────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
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
                      <p className="text-sm text-red-600 dark:text-red-400">{panelError}</p>
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

      {/* ── Data & Privacy section ───────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Data &amp; Privacy
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          Download a copy of all data associated with your account, or permanently delete your account.
        </p>

        <a
          href="/api/account/export"
          download
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download My Data
        </a>
      </section>

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-red-700 dark:text-red-400 mb-1">
          Danger Zone
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          Permanently deletes your account, all certifications, CPD activities, and uploaded files. This cannot be undone.
        </p>

        {!showDelete ? (
          <button
            onClick={() => { setShowDelete(true); setDeleteConfirm(""); setDeleteError(null); }}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Delete Account
          </button>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
              This will permanently delete your account and all associated data.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                disabled={deleteLoading}
                className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleteLoading}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? "Deleting…" : "Permanently Delete Account"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
