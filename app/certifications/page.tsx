"use client";

import { useEffect, useState } from "react";
import { supabase, type Certification } from "@/lib/supabase";
import {
  validateCertForm,
  type CertFormFields,
  type FieldErrors,
  type FieldWarnings,
} from "@/lib/certValidation";
import { useAuth } from "../AuthProvider";
import CertAutocomplete from "./CertAutocomplete";
import DateInput from "./DateInput";

const EMPTY_FORM: CertFormFields = {
  name: "",
  organization: "",
  organization_url: "",
  issue_date: "",
  expiration_date: "",
  cpe_required: "",
  cpe_cycle_length: "",
  annual_minimum_cpe: "",
  digital_certificate_url: "",
};

function getStatus(expirationDate: string | null) {
  if (!expirationDate) return null;
  const now = new Date();
  const exp = new Date(expirationDate);
  const daysLeft = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft < 0)
    return { label: "Expired", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", daysLeft };
  if (daysLeft <= 90)
    return {
      label: "Expiring Soon",
      color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
      daysLeft,
    };
  return { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400", daysLeft };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatCycle(months: number | null) {
  if (!months) return null;
  if (months % 12 === 0) return `${months / 12} yr`;
  return `${months} mo`;
}

export default function CertificationsPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form visibility
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CertFormFields>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Per-field validation state
  const [fieldErrors, setFieldErrors]     = useState<FieldErrors>({});
  const [fieldWarnings, setFieldWarnings] = useState<FieldWarnings>({});
  // Controls whether inline errors are shown (only after first submit attempt)
  const [hasAttempted, setHasAttempted] = useState(false);

  // ── Shared input class builders ──────────────────────────────────────────────
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  function inputCls(key: keyof CertFormFields, extra = "") {
    const base =
      "w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 " +
      "text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 " +
      "focus:outline-none focus:ring-2 focus:border-transparent";
    const state = fieldErrors[key]
      ? "border-red-400 dark:border-red-500 focus:ring-red-400 dark:focus:ring-red-500"
      : "border-gray-300 dark:border-gray-600 focus:ring-blue-900 dark:focus:ring-blue-500";
    return `${base} ${state} ${extra}`.trim();
  }

  // ── Inline error / warning helpers ───────────────────────────────────────────
  function FieldError({ name }: { name: keyof CertFormFields }) {
    const msg = fieldErrors[name];
    if (!msg) return null;
    return (
      <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
        {msg}
      </p>
    );
  }

  function FieldWarning({ name }: { name: keyof CertFormFields }) {
    const msg = fieldWarnings[name];
    if (!msg || fieldErrors[name]) return null;
    return (
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{msg}</p>
    );
  }

  // ── Data fetching ────────────────────────────────────────────────────────────
  async function fetchCerts() {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("certifications")
      .select("*")
      .eq("user_id", user.id)
      .order("expiration_date", { ascending: true, nullsFirst: false });
    if (error) {
      setError(error.message);
    } else {
      setCerts(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchCerts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function field(key: keyof CertFormFields, value: string) {
    const newForm = { ...form, [key]: value };
    setForm(newForm);
    // Once the user has attempted submission, re-validate on every keystroke
    // so errors clear in real-time (including cross-field checks like date order).
    if (hasAttempted) {
      const { errors, warnings } = validateCertForm(newForm);
      setFieldErrors(errors);
      setFieldWarnings(warnings);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFieldWarnings({});
    setFormError(null);
    setHasAttempted(false);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHasAttempted(true);
    setFormError(null);

    // Client-side validation — mirrors server exactly via the shared module
    const { errors, warnings, valid } = validateCertForm(form);
    setFieldErrors(errors);
    setFieldWarnings(warnings);
    if (!valid) return;

    setSaving(true);

    const res = await fetch("/api/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.status === 429) {
      const body = await res.json();
      setFormError(body.error ?? "Too many submissions. Please wait a minute.");
      setSaving(false);
      return;
    }

    if (!res.ok) {
      const body = await res.json();
      if (body.errors) {
        // Server caught something the client missed (shouldn't happen, but
        // surface it as per-field errors anyway)
        setFieldErrors(body.errors as FieldErrors);
      } else {
        setFormError(body.error ?? "Failed to save certification.");
      }
      setSaving(false);
      return;
    }

    // Success
    resetForm();
    setShowForm(false);
    await fetchCerts();
    setSaving(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Certifications</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your professional certifications and CPE requirements.
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
            }
            setShowForm((v) => !v);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 dark:bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm"
        >
          {showForm ? (
            <><span className="text-lg leading-none">×</span> Cancel</>
          ) : (
            <><span className="text-lg leading-none">+</span> Add Certification</>
          )}
        </button>
      </div>

      {/* Add certification form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">
            New Certification
          </h2>

          {/* noValidate disables browser native bubbles; we show our own messages */}
          <form onSubmit={handleSubmit} autoComplete="off" noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Certification name */}
              <div>
                <label className={labelClass}>
                  Certification Name <span className="text-red-500">*</span>
                </label>
                <CertAutocomplete
                  value={form.name}
                  hasError={!!fieldErrors.name}
                  onChange={(v) => field("name", v)}
                  onSelect={(t) =>
                    setForm((f) => ({
                      ...f,
                      name:              t.name,
                      organization:      t.organization,
                      organization_url:  t.organization_url,
                      cpe_required:      String(t.cpe_required),
                      cpe_cycle_length:  String(t.cpe_cycle_length),
                      annual_minimum_cpe:
                        t.annual_minimum_cpe != null ? String(t.annual_minimum_cpe) : "",
                    }))
                  }
                />
                <FieldError name="name" />
              </div>

              {/* Organization */}
              <div>
                <label className={labelClass}>
                  Organization <span className="text-red-500">*</span>
                </label>
                <input
                  type="search"
                  name="organization-field"
                  autoComplete="chrome-off"
                  data-form-type="other"
                  data-lpignore="true"
                  value={form.organization}
                  onChange={(e) => field("organization", e.target.value)}
                  placeholder="e.g. ISC2"
                  aria-invalid={!!fieldErrors.organization}
                  className={`${inputCls("organization")} [&::-webkit-search-cancel-button]:hidden`}
                />
                <FieldError name="organization" />
              </div>

              {/* Organization URL */}
              <div>
                <label className={labelClass}>Organization URL</label>
                <input
                  type="search"
                  name="organization-url-field"
                  autoComplete="chrome-off"
                  data-form-type="other"
                  data-lpignore="true"
                  value={form.organization_url}
                  onChange={(e) => field("organization_url", e.target.value)}
                  placeholder="https://www.isc2.org"
                  aria-invalid={!!fieldErrors.organization_url}
                  className={`${inputCls("organization_url")} [&::-webkit-search-cancel-button]:hidden`}
                />
                <FieldError name="organization_url" />
              </div>

              {/* Issue date */}
              <div>
                <label className={labelClass}>
                  Issue Date <span className="text-red-500">*</span>
                </label>
                <DateInput
                  value={form.issue_date}
                  hasError={!!fieldErrors.issue_date}
                  onChange={(v) => field("issue_date", v)}
                />
                <FieldError name="issue_date" />
              </div>

              {/* Expiration date */}
              <div>
                <label className={labelClass}>
                  Expiration Date <span className="text-red-500">*</span>
                </label>
                <DateInput
                  value={form.expiration_date}
                  hasError={!!fieldErrors.expiration_date}
                  onChange={(v) => field("expiration_date", v)}
                />
                <FieldError name="expiration_date" />
                <FieldWarning name="expiration_date" />
              </div>

              {/* CPE hours required */}
              <div>
                <label className={labelClass}>
                  CPE Hours Required <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={form.cpe_required}
                  onChange={(e) => field("cpe_required", e.target.value)}
                  placeholder="e.g. 120"
                  aria-invalid={!!fieldErrors.cpe_required}
                  className={inputCls("cpe_required")}
                />
                <FieldError name="cpe_required" />
              </div>

              {/* CPE cycle length */}
              <div>
                <label className={labelClass}>CPE Cycle Length (months)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={form.cpe_cycle_length}
                  onChange={(e) => field("cpe_cycle_length", e.target.value)}
                  placeholder="e.g. 36"
                  aria-invalid={!!fieldErrors.cpe_cycle_length}
                  className={inputCls("cpe_cycle_length")}
                />
                <FieldError name="cpe_cycle_length" />
              </div>

              {/* Annual minimum CPE */}
              <div>
                <label className={labelClass}>Annual Minimum CPE</label>
                <input
                  type="number"
                  min="0"
                  value={form.annual_minimum_cpe}
                  onChange={(e) => field("annual_minimum_cpe", e.target.value)}
                  placeholder="e.g. 40 (leave blank if none)"
                  aria-invalid={!!fieldErrors.annual_minimum_cpe}
                  className={inputCls("annual_minimum_cpe")}
                />
                <FieldError name="annual_minimum_cpe" />
              </div>

              {/* Digital certificate URL */}
              <div className="sm:col-span-2">
                <label className={labelClass}>Digital Certificate URL</label>
                <input
                  type="url"
                  value={form.digital_certificate_url}
                  onChange={(e) => field("digital_certificate_url", e.target.value)}
                  placeholder="https://..."
                  aria-invalid={!!fieldErrors.digital_certificate_url}
                  className={inputCls("digital_certificate_url")}
                />
                <FieldError name="digital_certificate_url" />
              </div>
            </div>

            {/* Form-level error (rate limit, server error, etc.) */}
            {formError && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"
              >
                {formError}
              </p>
            )}

            {/* Summary when there are field errors and user has attempted submit */}
            {hasAttempted && Object.keys(fieldErrors).length > 0 && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                Please fix the errors above before saving.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving…" : "Save Certification"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500 text-sm">
          Loading certifications…
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400 text-sm">
          <strong>Error loading certifications:</strong> {error}
        </div>
      ) : certs.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🎓</div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            No certifications yet
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Click &ldquo;Add Certification&rdquo; to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {certs.map((cert) => {
            const status = getStatus(cert.expiration_date);
            const cycle = formatCycle(cert.cpe_cycle_length);
            return (
              <div
                key={cert.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">
                    {cert.name}
                  </h3>
                  {status && (
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}
                    >
                      {status.label}
                    </span>
                  )}
                </div>

                {/* Organization */}
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {cert.organization_url ? (
                    <a
                      href={cert.organization_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-900 dark:text-blue-400 hover:underline font-medium"
                    >
                      {cert.organization}
                    </a>
                  ) : (
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {cert.organization}
                    </span>
                  )}
                </div>

                <hr className="border-gray-100 dark:border-gray-700" />

                {/* Details grid */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide text-[10px]">
                      Issued
                    </dt>
                    <dd className="text-gray-700 dark:text-gray-300 mt-0.5">
                      {formatDate(cert.issue_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide text-[10px]">
                      Expires
                    </dt>
                    <dd className="text-gray-700 dark:text-gray-300 mt-0.5">
                      {formatDate(cert.expiration_date)}
                    </dd>
                  </div>

                  {cert.cpe_required != null && (
                    <div>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide text-[10px]">
                        CPE Required
                      </dt>
                      <dd className="text-gray-700 dark:text-gray-300 mt-0.5">
                        {cert.cpe_required} hrs{cycle ? ` / ${cycle}` : ""}
                      </dd>
                    </div>
                  )}

                  {cert.annual_minimum_cpe != null && (
                    <div>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide text-[10px]">
                        Annual Min
                      </dt>
                      <dd className="text-gray-700 dark:text-gray-300 mt-0.5">
                        {cert.annual_minimum_cpe} hrs/yr
                      </dd>
                    </div>
                  )}

                  {status && status.daysLeft >= 0 && (
                    <div>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide text-[10px]">
                        Days Left
                      </dt>
                      <dd className="text-gray-700 dark:text-gray-300 mt-0.5">{status.daysLeft}</dd>
                    </div>
                  )}
                </dl>

                {/* Certificate link */}
                {cert.digital_certificate_url && (
                  <a
                    href={cert.digital_certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-blue-900 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    View Certificate
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
