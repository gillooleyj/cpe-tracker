"use client";

import { useEffect, useState } from "react";
import { supabase, type Certification } from "@/lib/supabase";
import {
  validateCertForm,
  sanitizeCertForm,
  type CertFormFields,
  type FieldErrors,
  type FieldWarnings,
} from "@/lib/certValidation";
import { useAuth } from "../AuthProvider";
import CertAutocomplete from "./CertAutocomplete";
import DateInput from "./DateInput";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortMode = "priority" | "alphabetical";

type SmartStatusResult = {
  label: "Complete" | "On Track" | "Needs Attention" | "Urgent";
  emoji: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

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

const SORT_PREF_KEY = "cpe-tracker-sort-mode";

const SMART_PRIORITY: Record<string, number> = {
  Urgent: 0,
  "Needs Attention": 1,
  "On Track": 2,
  Complete: 3,
};

// ── Helper functions ──────────────────────────────────────────────────────────

function getDaysLeft(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate + "T00:00:00Z");
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getActiveStatus(cert: Certification): "Active" | "Expired" {
  const daysLeft = getDaysLeft(cert.expiration_date);
  if (daysLeft === null) return "Active";
  return daysLeft >= 0 ? "Active" : "Expired";
}

function getSmartStatus(cert: Certification): SmartStatusResult | null {
  if (getActiveStatus(cert) === "Expired") return null;
  if (!cert.expiration_date || cert.cpe_required == null) return null;

  const cpeEarned = cert.cpe_earned ?? 0;
  const cpeRequired = cert.cpe_required;
  const daysLeft = getDaysLeft(cert.expiration_date) ?? 0;

  if (cpeEarned >= cpeRequired) return { label: "Complete", emoji: "🟢" };

  const issueDate = new Date(cert.issue_date + "T00:00:00Z");
  const expDate = new Date(cert.expiration_date + "T00:00:00Z");
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil(
    (expDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysPassed = Math.ceil(
    (now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const expectedProgress = totalDays > 0 ? daysPassed / totalDays : 0;
  const actualProgress = cpeEarned / cpeRequired;

  if (daysLeft < 90 && actualProgress < 0.5) {
    return { label: "Urgent", emoji: "🔴" };
  }
  if (actualProgress >= expectedProgress) {
    return { label: "On Track", emoji: "🟢" };
  }
  return { label: "Needs Attention", emoji: "🟡" };
}

function sortCerts(certs: Certification[], mode: SortMode): Certification[] {
  if (mode === "alphabetical") {
    return [...certs].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  }
  return [...certs].sort((a, b) => {
    const aExpired = getActiveStatus(a) === "Expired";
    const bExpired = getActiveStatus(b) === "Expired";
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    if (aExpired && bExpired) {
      return (b.expiration_date ?? "").localeCompare(a.expiration_date ?? "");
    }
    const aP = SMART_PRIORITY[getSmartStatus(a)?.label ?? ""] ?? 4;
    const bP = SMART_PRIORITY[getSmartStatus(b)?.label ?? ""] ?? 4;
    if (aP !== bP) return aP - bP;
    const aDays = getDaysLeft(a.expiration_date) ?? Infinity;
    const bDays = getDaysLeft(b.expiration_date) ?? Infinity;
    return aDays - bDays;
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatCycleFull(months: number | null): string | null {
  if (!months) return null;
  if (months % 12 === 0) {
    const yrs = months / 12;
    return `${months} months (${yrs} ${yrs === 1 ? "year" : "years"})`;
  }
  return `${months} months`;
}

function certToFormFields(cert: Certification): CertFormFields {
  return {
    name: cert.name,
    organization: cert.organization,
    organization_url: cert.organization_url ?? "",
    issue_date: cert.issue_date,
    expiration_date: cert.expiration_date ?? "",
    cpe_required: cert.cpe_required != null ? String(cert.cpe_required) : "",
    cpe_cycle_length:
      cert.cpe_cycle_length != null ? String(cert.cpe_cycle_length) : "",
    annual_minimum_cpe:
      cert.annual_minimum_cpe != null ? String(cert.annual_minimum_cpe) : "",
    digital_certificate_url: cert.digital_certificate_url ?? "",
  };
}

// ── CertCard ──────────────────────────────────────────────────────────────────

function CertCard({
  cert,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  cert: Certification;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (cert: Certification) => void;
  onDelete: (id: string) => void;
}) {
  const activeStatus = getActiveStatus(cert);
  const smartStatus = getSmartStatus(cert);
  const daysLeft = getDaysLeft(cert.expiration_date);
  const cpeEarned = cert.cpe_earned ?? 0;

  const overallPercent =
    cert.cpe_required && cert.cpe_required > 0
      ? Math.min(100, Math.round((cpeEarned / cert.cpe_required) * 100))
      : 0;

  const monthsRemaining =
    daysLeft !== null && daysLeft > 0 ? daysLeft / 30.44 : 0;
  const cpeRemaining =
    cert.cpe_required != null ? Math.max(0, cert.cpe_required - cpeEarned) : 0;
  const cpePerMonth =
    monthsRemaining > 0 && cpeRemaining > 0
      ? (cpeRemaining / monthsRemaining).toFixed(1)
      : null;

  const lbl =
    "text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500";

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
      {/* Clickable header — expands/collapses the card */}
      <button
        onClick={onToggle}
        className="w-full px-5 pt-4 pb-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-inset"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
              {cert.name}
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-[11px] shrink-0 select-none">
              {isExpanded ? "▲" : "▼"}
            </span>
          </div>
          <span
            className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
              activeStatus === "Active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {activeStatus}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1 gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {cert.organization}
          </span>
          {smartStatus && (
            <span className="text-xs text-gray-600 dark:text-gray-400 shrink-0">
              {smartStatus.emoji} {smartStatus.label}
            </span>
          )}
        </div>
      </button>

      {/* Always-visible summary */}
      <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
        {/* Expiration + days remaining on one line */}
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {cert.expiration_date ? (
            <>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Expires:
              </span>{" "}
              {formatDate(cert.expiration_date)}
              {daysLeft !== null && daysLeft >= 0 && (
                <span className="text-gray-500 dark:text-gray-500">
                  {" "}•{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {daysLeft} days remaining
                  </span>
                </span>
              )}
              {daysLeft !== null && daysLeft < 0 && (
                <span className="text-gray-500 dark:text-gray-500">
                  {" "}•{" "}expired {Math.abs(daysLeft)} days ago
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">No expiration date</span>
          )}
        </p>

        {/* CPE progress bar */}
        {cert.cpe_required != null && (
          <div>
            <p className={`${lbl} mb-1.5`}>CPE Progress</p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  overallPercent >= 67
                    ? "bg-green-500 dark:bg-green-500"
                    : overallPercent >= 33
                      ? "bg-yellow-500 dark:bg-yellow-400"
                      : "bg-red-500 dark:bg-red-500"
                }`}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {overallPercent}%{" "}
              <span className="text-gray-400 dark:text-gray-500">
                ({cpeEarned} of {cert.cpe_required} hrs)
              </span>
            </p>
          </div>
        )}

        {/* Annual minimum */}
        {cert.annual_minimum_cpe != null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Annual Minimum:
            </span>{" "}
            0 of {cert.annual_minimum_cpe} hrs
          </p>
        )}
      </div>

      {/* Expandable section — slides open/closed */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[2000px]" : "max-h-0"
        }`}
      >
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 space-y-4">
          {/* Overall progress */}
          {cert.cpe_required != null && (
            <div>
              <p className={`${lbl} mb-2`}>Overall Progress</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-900 dark:bg-blue-500 h-1.5 rounded-full"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {overallPercent}% complete ({cpeEarned}/{cert.cpe_required} hrs)
              </p>
            </div>
          )}

          {/* Annual progress — placeholder until CPE activity logging is built */}
          {cert.annual_minimum_cpe != null && (
            <div>
              <p className={`${lbl} mb-2`}>Annual Progress (Current Year)</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div className="bg-blue-900 dark:bg-blue-500 h-1.5 rounded-full w-0" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                0% complete (0/{cert.annual_minimum_cpe} hrs)
              </p>
            </div>
          )}

          {/* Pace indicator */}
          {cert.cpe_required != null &&
            activeStatus === "Active" &&
            daysLeft !== null &&
            daysLeft > 0 &&
            cpeEarned < cert.cpe_required && (
              <div>
                <p className={`${lbl} mb-1`}>Pace Indicator</p>
                {cpePerMonth !== null && (
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    Need {cpePerMonth} CPE/month to stay on track
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {cpeRemaining} hrs remaining in {daysLeft} days
                </p>
              </div>
            )}

          {/* CPE cycle */}
          {cert.cpe_cycle_length != null && (
            <div>
              <p className={`${lbl} mb-1`}>CPE Cycle</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {formatCycleFull(cert.cpe_cycle_length)}
              </p>
            </div>
          )}

          {/* CPE Activities — placeholder for future feature */}
          <div>
            <p className={`${lbl} mb-2`}>CPE Activities</p>
            <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Will show logged CPE events here
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">
                Feature coming soon
              </p>
            </div>
          </div>

          {/* Digital certificate link */}
          {cert.digital_certificate_url && (
            <div>
              <p className={`${lbl} mb-1`}>Digital Certificate</p>
              <a
                href={cert.digital_certificate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline"
              >
                🔗 View Certificate
              </a>
            </div>
          )}

          {/* Organization link */}
          {cert.organization_url && (
            <div>
              <p className={`${lbl} mb-1`}>Organization</p>
              <a
                href={cert.organization_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline"
              >
                🔗 Visit {cert.organization} Website
              </a>
            </div>
          )}

          {/* Edit / Delete */}
          <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => onEdit(cert)}
              className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Edit Certification
            </button>
            <button
              onClick={() => onDelete(cert.id)}
              className="flex-1 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete Certification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CertificationsPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Card interaction
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority");

  // Add / edit form
  const [showForm, setShowForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [form, setForm] = useState<CertFormFields>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fieldWarnings, setFieldWarnings] = useState<FieldWarnings>({});
  const [hasAttempted, setHasAttempted] = useState(false);

  // ── Load sort preference from localStorage ──────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(SORT_PREF_KEY);
    if (saved === "alphabetical" || saved === "priority") setSortMode(saved);
  }, []);

  // ── Input helpers ───────────────────────────────────────────────────────────
  const labelClass =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

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

  // ── Data fetching ───────────────────────────────────────────────────────────
  async function fetchCerts() {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("certifications")
      .select("*")
      .eq("user_id", user.id);
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

  // ── Sort ────────────────────────────────────────────────────────────────────
  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    localStorage.setItem(SORT_PREF_KEY, mode);
  }

  // ── Form helpers ────────────────────────────────────────────────────────────
  function field(key: keyof CertFormFields, value: string) {
    const newForm = { ...form, [key]: value };
    setForm(newForm);
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
    setEditingCert(null);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(cert: Certification) {
    setEditingCert(cert);
    setForm(certToFormFields(cert));
    setFieldErrors({});
    setFieldWarnings({});
    setFormError(null);
    setHasAttempted(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  // ── Submit (add) ────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHasAttempted(true);
    setFormError(null);

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
        setFieldErrors(body.errors as FieldErrors);
      } else {
        setFormError(body.error ?? "Failed to save certification.");
      }
      setSaving(false);
      return;
    }

    closeForm();
    await fetchCerts();
    setSaving(false);
  }

  // ── Update (edit) ───────────────────────────────────────────────────────────
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCert) return;
    setHasAttempted(true);
    setFormError(null);

    const { errors, warnings, valid } = validateCertForm(form);
    setFieldErrors(errors);
    setFieldWarnings(warnings);
    if (!valid) return;

    setSaving(true);

    const sanitized = sanitizeCertForm(form);
    const { error: updateError } = await supabase
      .from("certifications")
      .update(sanitized)
      .eq("id", editingCert.id);

    if (updateError) {
      setFormError("Failed to update certification. Please try again.");
      setSaving(false);
      return;
    }

    closeForm();
    await fetchCerts();
    setSaving(false);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(certId: string) {
    if (!window.confirm("Delete this certification? This cannot be undone."))
      return;
    const { error: delError } = await supabase
      .from("certifications")
      .delete()
      .eq("id", certId);
    if (delError) {
      alert("Failed to delete certification. Please try again.");
      return;
    }
    if (expandedId === certId) setExpandedId(null);
    await fetchCerts();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const sortedCerts = sortCerts(certs, sortMode);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Certifications
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your professional certifications and CPE requirements.
          </p>
        </div>
        <button
          onClick={showForm ? closeForm : openAddForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 dark:bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm"
        >
          {showForm ? (
            <>
              <span className="text-lg leading-none">×</span> Cancel
            </>
          ) : (
            <>
              <span className="text-lg leading-none">+</span> Add Certification
            </>
          )}
        </button>
      </div>

      {/* Sort controls — only shown when there are certs to sort */}
      {!loading && !error && certs.length > 1 && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Sort by:
          </span>
          <div className="flex gap-1">
            {(["priority", "alphabetical"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSortChange(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  sortMode === mode
                    ? "bg-blue-900 dark:bg-blue-700 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {mode === "priority" ? "Priority" : "Alphabetical"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">
            {editingCert ? "Edit Certification" : "New Certification"}
          </h2>

          <form
            onSubmit={editingCert ? handleUpdate : handleSubmit}
            autoComplete="off"
            noValidate
            className="space-y-4"
          >
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
                      name: t.name,
                      organization: t.organization,
                      organization_url: t.organization_url,
                      cpe_required: String(t.cpe_required),
                      cpe_cycle_length: String(t.cpe_cycle_length),
                      annual_minimum_cpe:
                        t.annual_minimum_cpe != null
                          ? String(t.annual_minimum_cpe)
                          : "",
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
                  onChange={(e) =>
                    field("digital_certificate_url", e.target.value)
                  }
                  placeholder="https://..."
                  aria-invalid={!!fieldErrors.digital_certificate_url}
                  className={inputCls("digital_certificate_url")}
                />
                <FieldError name="digital_certificate_url" />
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"
              >
                {formError}
              </p>
            )}

            {hasAttempted && Object.keys(fieldErrors).length > 0 && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                Please fix the errors above before saving.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving
                  ? editingCert
                    ? "Updating…"
                    : "Saving…"
                  : editingCert
                    ? "Update Certification"
                    : "Save Certification"}
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
        <div className="flex flex-col gap-3">
          {sortedCerts.map((cert) => (
            <CertCard
              key={cert.id}
              cert={cert}
              isExpanded={expandedId === cert.id}
              onToggle={() =>
                setExpandedId(expandedId === cert.id ? null : cert.id)
              }
              onEdit={openEditForm}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </main>
  );
}
