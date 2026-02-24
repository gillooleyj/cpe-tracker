"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type Certification, type LinkedActivity } from "@/lib/supabase";
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

type SortBy = "urgency" | "expiration" | "name-asc" | "name-desc";
type FilterBy = "active" | "all" | "expired";

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

const CERT_SORT_KEY = "certSortPreference";
const CERT_FILTER_KEY = "certFilterPreference";
const RTS_KEY = "cpe-tracker-rts-collapsed";

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

function getUrgencyScore(cert: Certification): number {
  if (getActiveStatus(cert) === "Expired") return 4;
  const daysLeft = getDaysLeft(cert.expiration_date) ?? Infinity;
  const cpeEarned = cert.cpe_earned ?? 0;
  const cpeRequired = cert.cpe_required;
  if (!cpeRequired || cpeRequired === 0) return 3;

  const progressPct = (cpeEarned / cpeRequired) * 100;
  if (daysLeft < 90 && progressPct < 50) return 1; // Urgent

  const monthsLeft = Math.max(0.01, daysLeft / 30.44);
  const paceNeeded = Math.max(0, cpeRequired - cpeEarned) / monthsLeft;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const issueDate = new Date(cert.issue_date + "T00:00:00Z");
  const monthsElapsed = Math.max(0.01, (now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const currentPace = cpeEarned / monthsElapsed;

  if (paceNeeded > 0 && (currentPace === 0 || paceNeeded > currentPace * 1.2)) return 2; // Needs Attention
  return 3; // On Track
}

function sortCerts(certs: Certification[], mode: SortBy): Certification[] {
  const copy = [...certs];
  if (mode === "name-asc") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (mode === "name-desc") {
    return copy.sort((a, b) => b.name.localeCompare(a.name));
  }
  if (mode === "expiration") {
    return copy.sort((a, b) => {
      const aExpired = getActiveStatus(a) === "Expired";
      const bExpired = getActiveStatus(b) === "Expired";
      // Expired certs always go after active certs
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      if (!a.expiration_date) return 1;
      if (!b.expiration_date) return -1;
      // Active: soonest expiration first; Expired: most recently expired first
      return aExpired
        ? b.expiration_date.localeCompare(a.expiration_date)
        : a.expiration_date.localeCompare(b.expiration_date);
    });
  }
  // urgency (default)
  return copy.sort((a, b) => {
    const diff = getUrgencyScore(a) - getUrgencyScore(b);
    if (diff !== 0) return diff;
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

function formatHrs(h: number) {
  return h % 1 === 0 ? `${h}` : h.toFixed(2);
}

function displayFileName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+_/, "");
}

async function openAttachment(path: string) {
  const { data } = await supabase.storage
    .from("cpe-attachments")
    .createSignedUrl(path, 300);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
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
  activities,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onMarkSubmitted,
  onBulkConfirm,
}: {
  cert: Certification;
  activities: LinkedActivity[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (cert: Certification) => void;
  onDelete: (id: string) => void;
  onMarkSubmitted: (a: LinkedActivity, certName: string) => void;
  onBulkConfirm: (certId: string) => void;
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

  // Annual progress from actual logged activities in the current calendar year
  const currentYear = new Date().getFullYear();
  const annualEarned = activities
    .filter(
      (a) =>
        new Date(a.activity_date + "T00:00:00Z").getFullYear() === currentYear
    )
    .reduce((sum, a) => sum + a.hours_applied, 0);
  const annualPercent =
    cert.annual_minimum_cpe && cert.annual_minimum_cpe > 0
      ? Math.min(100, Math.round((annualEarned / cert.annual_minimum_cpe) * 100))
      : 0;

  // Submission summary
  const submittedHrs = activities.filter(a => a.submitted_to_org).reduce((s, a) => s + a.hours_applied, 0);
  const pendingHrs   = activities.filter(a => !a.submitted_to_org).reduce((s, a) => s + a.hours_applied, 0);
  const unsubmittedCount = activities.filter(a => !a.submitted_to_org).length;
  const lastSubmittedDate = activities
    .filter(a => a.submitted_to_org && a.submitted_date)
    .map(a => a.submitted_date!)
    .sort()
    .at(-1) ?? null;
  const daysSinceLastSubmission = lastSubmittedDate
    ? Math.floor((Date.now() - new Date(lastSubmittedDate + "T00:00:00Z").getTime()) / 86400000)
    : null;

  const lbl =
    "text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500";

  return (
    <div id={`cert-${cert.id}`} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
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
          <div className="flex items-center gap-2 shrink-0">
            {unsubmittedCount > 0 && !isExpanded && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {unsubmittedCount} to submit
              </span>
            )}
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeStatus === "Active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {activeStatus}
            </span>
          </div>
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
          isExpanded ? "max-h-[3000px]" : "max-h-0"
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

          {/* Annual progress — from logged activities in the current calendar year */}
          {cert.annual_minimum_cpe != null && (
            <div>
              <p className={`${lbl} mb-2`}>Annual Progress (Current Year)</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-900 dark:bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${annualPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {annualPercent}% complete ({formatHrs(annualEarned)}/{cert.annual_minimum_cpe} hrs)
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

          {/* CPE Activities */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className={lbl}>CPE Activities</p>
                {cert.organization_url && (
                  <a
                    href={cert.organization_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-900 dark:hover:text-blue-400 transition-colors"
                    title={`Submit CPE to ${cert.organization}`}
                  >
                    🔗 Submit CPE
                  </a>
                )}
              </div>
              <Link
                href={`/cpe-activities?cert=${cert.id}`}
                className="text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline"
              >
                + Log Activity
              </Link>
            </div>

            {activities.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  No CPE activities logged yet.
                </p>
                <Link
                  href={`/cpe-activities?cert=${cert.id}`}
                  className="text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline mt-1 block"
                >
                  Add your first CPE activity →
                </Link>
              </div>
            ) : (
              <>
                {/* Submission summary line */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span className="text-green-700 dark:text-green-400 font-medium">
                    {formatHrs(submittedHrs)} hrs submitted
                  </span>
                  {pendingHrs > 0 && (
                    <>
                      {" · "}
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {formatHrs(pendingHrs)} hrs pending
                      </span>
                    </>
                  )}
                </p>

                {/* Reminder banners */}
                {pendingHrs > 20 && (
                  <div className="mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                    You have {formatHrs(pendingHrs)} unsubmitted hours — consider reporting to {cert.organization}.
                  </div>
                )}
                {daysLeft !== null && daysLeft < 90 && pendingHrs > 0 && (
                  <div className="mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                    Expiry in {daysLeft} days with {formatHrs(pendingHrs)} hrs unsubmitted — submit soon!
                  </div>
                )}
                {daysSinceLastSubmission !== null && daysSinceLastSubmission > 180 && (
                  <div className="mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                    Last submission was {daysSinceLastSubmission} days ago — consider submitting recent activities.
                  </div>
                )}

                <div className="space-y-2">
                  {activities.map((a) => (
                    <div
                      key={a.junction_id}
                      className="group flex items-start justify-between gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-white dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm" title={a.submitted_to_org ? "Submitted" : "Pending submission"}>
                            {a.submitted_to_org ? "✅" : "⏳"}
                          </span>
                          <Link
                            href={`/cpe-activities?highlight=${a.activity_id}`}
                            className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:text-blue-900 dark:hover:text-blue-400 hover:underline truncate"
                          >
                            {a.title}
                          </Link>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                          {a.provider} · {formatDate(a.activity_date)}
                        </p>
                        {a.submitted_to_org && a.submitted_date && (
                          <p className="text-xs text-green-600 dark:text-green-400 ml-5 mt-0.5">
                            Submitted {formatDate(a.submitted_date)}
                            {a.submission_notes && (
                              <span className="text-gray-500 dark:text-gray-500"> · {a.submission_notes}</span>
                            )}
                          </p>
                        )}
                        {a.attachment_urls.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1 ml-5">
                            {a.attachment_urls.map((path) => (
                              <button
                                key={path}
                                onClick={() => openAttachment(path)}
                                className="text-xs text-blue-900 dark:text-blue-400 hover:underline"
                              >
                                📎 {displayFileName(path)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {formatHrs(a.hours_applied)} hrs
                        </span>
                        {!a.submitted_to_org && (
                          <button
                            onClick={() => onMarkSubmitted(a, cert.name)}
                            className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 transition-colors"
                          >
                            Mark Submitted
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bulk mark button */}
                {unsubmittedCount > 0 && (
                  <button
                    onClick={() => onBulkConfirm(cert.id)}
                    className="mt-2 w-full px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    Mark All Unsubmitted ({unsubmittedCount}) as Submitted
                  </button>
                )}
              </>
            )}
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
  const [linkedActivities, setLinkedActivities] = useState<
    Record<string, LinkedActivity[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Card interaction
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    if (typeof window === "undefined") return "urgency";
    const saved = localStorage.getItem(CERT_SORT_KEY);
    return (["urgency", "expiration", "name-asc", "name-desc"] as SortBy[]).includes(saved as SortBy)
      ? (saved as SortBy)
      : "urgency";
  });
  const [filterBy, setFilterBy] = useState<FilterBy>(() => {
    if (typeof window === "undefined") return "all";
    const saved = localStorage.getItem(CERT_FILTER_KEY);
    return (["active", "all", "expired"] as FilterBy[]).includes(saved as FilterBy)
      ? (saved as FilterBy)
      : "all";
  });

  // Add / edit form
  const [showForm, setShowForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [form, setForm] = useState<CertFormFields>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fieldWarnings, setFieldWarnings] = useState<FieldWarnings>({});
  const [hasAttempted, setHasAttempted] = useState(false);

  // Submission modal
  const [submitModal, setSubmitModal] = useState<{
    junctionId: string;
    activityDate: string;
    certName: string;
    activityTitle: string;
  } | null>(null);
  const [submitDate, setSubmitDate] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitSaving, setSubmitSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ready-to-Submit widget
  const [rtsCollapsed, setRtsCollapsed] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(RTS_KEY) !== "false" : true
  );

  // Bulk confirm
  const [bulkConfirmCertId, setBulkConfirmCertId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  // ── Persist sort + filter preferences ───────────────────────────────────────
  useEffect(() => { localStorage.setItem(CERT_SORT_KEY, sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem(CERT_FILTER_KEY, filterBy); }, [filterBy]);

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

    const { data: certsData, error: certsErr } = await supabase
      .from("certifications")
      .select("*")
      .eq("user_id", user.id);

    if (certsErr) {
      setError(certsErr.message);
      setLoading(false);
      return;
    }

    const loadedCerts = (certsData ?? []) as Certification[];
    setCerts(loadedCerts);

    // Fetch linked activities for all certs in one query
    if (loadedCerts.length > 0) {
      const { data: junctionData } = await supabase
        .from("certification_activities")
        .select(
          "id, certification_id, hours_applied, submitted_to_org, submitted_date, submission_notes, cpe_activities(id, title, provider, activity_date, attachment_urls)"
        )
        .in(
          "certification_id",
          loadedCerts.map((c) => c.id)
        );

      if (junctionData) {
        const byId: Record<string, LinkedActivity[]> = {};
        for (const row of junctionData as unknown as Array<{
          id: string;
          certification_id: string;
          hours_applied: number;
          submitted_to_org: boolean;
          submitted_date: string | null;
          submission_notes: string | null;
          cpe_activities: {
            id: string;
            title: string;
            provider: string;
            activity_date: string;
            attachment_urls: string[];
          } | null;
        }>) {
          const act = row.cpe_activities;
          if (!act) continue;
          if (!byId[row.certification_id]) byId[row.certification_id] = [];
          byId[row.certification_id].push({
            junction_id:      row.id,
            activity_id:      act.id,
            hours_applied:    Number(row.hours_applied),
            submitted_to_org: row.submitted_to_org,
            submitted_date:   row.submitted_date ?? null,
            submission_notes: row.submission_notes ?? null,
            title:            act.title,
            provider:         act.provider,
            activity_date:    act.activity_date,
            attachment_urls:  act.attachment_urls ?? [],
          });
        }
        // Sort each cert's activities by date descending
        for (const id of Object.keys(byId)) {
          byId[id].sort((a, b) => b.activity_date.localeCompare(a.activity_date));
        }
        setLinkedActivities(byId);
      }
    } else {
      setLinkedActivities({});
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchCerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  // ── Submission modal helpers ─────────────────────────────────────────────────
  function openSubmitModal(a: LinkedActivity, certName: string) {
    setSubmitModal({
      junctionId: a.junction_id,
      activityDate: a.activity_date,
      certName,
      activityTitle: a.title,
    });
    setSubmitDate(new Date().toISOString().slice(0, 10));
    setSubmitNotes("");
    setSubmitError(null);
  }

  function closeSubmitModal() {
    setSubmitModal(null);
    setSubmitDate("");
    setSubmitNotes("");
    setSubmitError(null);
  }

  async function handleMarkSubmitted() {
    if (!submitModal) return;
    setSubmitSaving(true);
    setSubmitError(null);
    const res = await fetch(`/api/cert-activity-links/${submitModal.junctionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submitted_to_org: true,
        submitted_date: submitDate || null,
        submission_notes: submitNotes.trim() || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setSubmitError(d.error ?? "Failed to save.");
      setSubmitSaving(false);
      return;
    }
    closeSubmitModal();
    await fetchCerts();
    setSubmitSaving(false);
  }

  async function handleBulkMarkSubmitted(certId: string) {
    const unsubmitted = (linkedActivities[certId] ?? []).filter(a => !a.submitted_to_org);
    setBulkSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    for (const a of unsubmitted) {
      await fetch(`/api/cert-activity-links/${a.junction_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitted_to_org: true, submitted_date: today, submission_notes: null }),
      });
    }
    setBulkConfirmCertId(null);
    setBulkSaving(false);
    await fetchCerts();
  }

  function toggleRts() {
    setRtsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(RTS_KEY, String(next));
      return next;
    });
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

  // ── Ready-to-Submit banner data (activity-grouped) ───────────────────────────
  const rtsActivities = (() => {
    const map = new Map<string, {
      activity_id: string;
      title: string;
      hours_applied: number;
      activity_date: string;
      unsubmittedCerts: { certId: string; certName: string; orgName: string }[];
    }>();
    for (const cert of certs) {
      for (const a of (linkedActivities[cert.id] ?? [])) {
        if (!a.submitted_to_org) {
          if (!map.has(a.activity_id)) {
            map.set(a.activity_id, {
              activity_id:     a.activity_id,
              title:           a.title,
              hours_applied:   a.hours_applied,
              activity_date:   a.activity_date,
              unsubmittedCerts: [],
            });
          }
          map.get(a.activity_id)!.unsubmittedCerts.push({
            certId:   cert.id,
            certName: cert.name,
            orgName:  cert.organization,
          });
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.activity_date.localeCompare(a.activity_date));
  })();

  // ── Bulk confirm cert name ──────────────────────────────────────────────────
  const bulkCert = bulkConfirmCertId ? certs.find(c => c.id === bulkConfirmCertId) : null;
  const bulkUnsubmittedCount = bulkConfirmCertId
    ? (linkedActivities[bulkConfirmCertId] ?? []).filter(a => !a.submitted_to_org).length
    : 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  const filteredCerts = filterBy === "active"
    ? certs.filter(c => getActiveStatus(c) === "Active")
    : filterBy === "expired"
    ? certs.filter(c => getActiveStatus(c) === "Expired")
    : certs;
  const sortedCerts = sortCerts(filteredCerts, sortBy);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 items-start mb-8">
        {/* Row 1 left: title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 justify-self-start">
          Certifications
        </h1>

        {/* Row 1 right: Add Certification button */}
        <button
          onClick={showForm ? closeForm : openAddForm}
          className="justify-self-end inline-flex items-center gap-2 px-4 py-1.5 bg-blue-900 dark:bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center"
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

        {/* Row 2 left: subtitle */}
        <p className="text-sm text-gray-500 dark:text-gray-400 justify-self-start">
          Manage your professional certifications and CPE requirements.
        </p>

        {/* Row 2 right: sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="justify-self-end bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] w-full md:w-auto"
        >
          <option value="urgency">Sort by: Urgency</option>
          <option value="expiration">Sort by: Expiration</option>
          <option value="name-asc">Sort by: Name (A-Z)</option>
          <option value="name-desc">Sort by: Name (Z-A)</option>
        </select>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 mb-4">
        {(["active", "all", "expired"] as FilterBy[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilterBy(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterBy === f
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {f === "active" ? "Show Active Only" : f === "expired" ? "Show Expired Only" : "Show All"}
          </button>
        ))}
      </div>

      {/* Ready-to-Submit banner */}
      {!loading && !error && rtsActivities.length > 0 && (
        <div className="mb-6 border border-amber-300 dark:border-amber-700 rounded-xl overflow-hidden">
          <button
            onClick={toggleRts}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-left"
          >
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              📤 Ready to Submit ({rtsActivities.length} {rtsActivities.length === 1 ? "activity" : "activities"})
            </span>
            <span className="text-amber-600 dark:text-amber-400 text-xs">
              {rtsCollapsed ? "▼ Show" : "▲ Hide"}
            </span>
          </button>
          {!rtsCollapsed && (
            <div className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {rtsActivities.map((act) => (
                <div key={act.activity_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {act.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatHrs(act.hours_applied)} hrs • {formatDate(act.activity_date)}
                      </p>
                      <div className="mt-1.5 space-y-0.5">
                        {act.unsubmittedCerts.map(({ certId, certName, orgName }) => (
                          <p key={certId} className="text-xs text-amber-700 dark:text-amber-400">
                            → {certName} ({orgName}) • Not Submitted
                          </p>
                        ))}
                      </div>
                    </div>
                    <Link
                      href="/cpe-activities"
                      className="shrink-0 mt-0.5 text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      View Activity →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      ) : sortedCerts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No {filterBy === "active" ? "active" : "expired"} certifications.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedCerts.map((cert) => (
            <CertCard
              key={cert.id}
              cert={cert}
              activities={linkedActivities[cert.id] ?? []}
              isExpanded={expandedId === cert.id}
              onToggle={() =>
                setExpandedId(expandedId === cert.id ? null : cert.id)
              }
              onEdit={openEditForm}
              onDelete={handleDelete}
              onMarkSubmitted={openSubmitModal}
              onBulkConfirm={setBulkConfirmCertId}
            />
          ))}
        </div>
      )}

      {/* Submission modal */}
      {submitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Mark as Submitted
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {submitModal.activityTitle} → {submitModal.certName}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Submission Date
                </label>
                <DateInput
                  value={submitDate}
                  hasError={false}
                  onChange={setSubmitDate}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={submitNotes}
                  onChange={e => setSubmitNotes(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Submitted via ISC2 CPE Portal…"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                  {submitNotes.length}/500
                </p>
              </div>

              {submitError && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeSubmitModal}
                disabled={submitSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkSubmitted}
                disabled={submitSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 disabled:opacity-60 transition-colors"
              >
                {submitSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk confirm overlay */}
      {bulkConfirmCertId && bulkCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Mark All as Submitted
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Mark {bulkUnsubmittedCount} {bulkUnsubmittedCount === 1 ? "activity" : "activities"} for <strong>{bulkCert.name}</strong> as submitted with today&apos;s date?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkConfirmCertId(null)}
                disabled={bulkSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkMarkSubmitted(bulkConfirmCertId)}
                disabled={bulkSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 disabled:opacity-60 transition-colors"
              >
                {bulkSaving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
