"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  supabase,
  type Certification,
  type ActivityWithCerts,
  type ActivityCertLink,
} from "@/lib/supabase";
import { useAuth } from "../../AuthProvider";
import DateInput from "../certifications/DateInput";

// ── Types ─────────────────────────────────────────────────────────────────────

type CertSelection = { certId: string; hoursApplied: string };

type FormData = {
  title: string;
  provider: string;
  activity_date: string;
  total_hours: string;
  category: string;
  description: string;
};

type FieldErrors = Record<string, string>;

type SubmitFilter = "all" | "submitted" | "unsubmitted";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormData = {
  title: "",
  provider: "",
  activity_date: "",
  total_hours: "",
  category: "",
  description: "",
};

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.gif,.webp";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "gif", "webp"]);

const CATEGORY_OPTIONS = [
  "Technical/Cybersecurity Training",
  "Security Awareness Training",
  "Leadership & Management",
  "Governance & Compliance",
  "Risk Management",
  "Incident Response & Forensics",
  "Cloud Security",
  "Network & Infrastructure Security",
  "Application Security",
  "Privacy & Data Protection",
  "Audit & Assessment",
  "Business & Soft Skills",
  "Teaching/Instruction",
  "Authoring/Publishing",
  "Conference/Event Attendance",
  "Volunteer/Committee Work",
  "Other",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sanitize a filename for safe Supabase Storage paths.
 *  Returns: {timestamp}_{safe_base}{ext}
 *  e.g. "4-up on 6-23-24 at 1.37PM.jpg" → "1708628421_4-up-on-6-23-24-at-1-37PM.jpg"
 */
function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const ext  = lastDot !== -1 ? name.slice(lastDot).toLowerCase() : "";
  const base = lastDot !== -1 ? name.slice(0, lastDot) : name;
  const safeBase = base
    .replace(/\s+/g, "-")              // spaces → hyphens
    .replace(/[^a-zA-Z0-9\-_.]/g, "") // strip everything else
    .replace(/-{2,}/g, "-")            // collapse consecutive hyphens
    .replace(/^-+|-+$/g, "")           // trim leading/trailing hyphens
    || "file";                          // fallback if name becomes empty
  return `${Date.now()}_${safeBase}${ext}`;
}

/** Strip the leading timestamp prefix added by sanitizeFilename for display. */
function displayFileName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+_/, "");
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatHours(h: number) {
  return h % 1 === 0 ? `${h}` : h.toFixed(2);
}

/** Returns the set of cert IDs that are blocked because another cert from the
 *  same organization is already selected. */
function disabledCertIds(
  selections: CertSelection[],
  certs: Certification[]
): Set<string> {
  const selectedIds = new Set(selections.map((s) => s.certId));
  const selectedOrgs = new Set(
    certs.filter((c) => selectedIds.has(String(c.id))).map((c) => c.organization)
  );
  const out = new Set<string>();
  for (const c of certs) {
    if (!selectedIds.has(String(c.id)) && selectedOrgs.has(c.organization)) {
      out.add(String(c.id));
    }
  }
  return out;
}

// ── Attachment link (generates signed URL on click) ───────────────────────────

function AttachmentButton({ path }: { path: string }) {
  async function open() {
    const { data } = await supabase.storage
      .from("cpe-attachments")
      .createSignedUrl(path, 300); // 5-minute URL
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }
  return (
    <button
      onClick={open}
      className="inline-flex items-center gap-1 text-xs text-blue-900 dark:text-blue-400 hover:underline"
    >
      📎 {displayFileName(path)}
    </button>
  );
}

// ── Main inner component ──────────────────────────────────────────────────────

function CpeActivitiesInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCertId = searchParams?.get("cert") ?? null;
  const highlightId   = searchParams?.get("highlight") ?? null;

  const [activities, setActivities] = useState<ActivityWithCerts[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filter
  const [filterCertId, setFilterCertId] = useState("");
  const [filterSubmit, setFilterSubmit] = useState<SubmitFilter>("all");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [certSelections, setCertSelections] = useState<CertSelection[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingPaths, setExistingPaths] = useState<string[]>([]); // paths kept on edit
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isDragging, setIsDragging] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightScrolledRef = useRef(false);
  const prefillHandledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission modal
  const [submitModal, setSubmitModal] = useState<{
    junctionId: string;
    activityDate: string;
    activityTitle: string;
    certName: string;
  } | null>(null);
  const [submitDate, setSubmitDate] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitSaving, setSubmitSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  async function fetchAll() {
    if (!user) return;
    setLoading(true);
    setPageError(null);

    const [{ data: certsData, error: certsErr }, { data: actsData, error: actsErr }] =
      await Promise.all([
        supabase
          .from("certifications")
          .select("*")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("cpe_activities")
          .select(`
            *,
            certification_activities(
              id,
              certification_id,
              hours_applied,
              submitted_to_org,
              submitted_date,
              submission_notes,
              certifications(name, organization, organization_url)
            )
          `)
          .eq("user_id", user.id)
          .order("activity_date", { ascending: false }),
      ]);

    if (certsErr) setPageError(certsErr.message);
    else setCerts((certsData as Certification[]) ?? []);

    if (actsErr) setPageError((prev) => prev ?? actsErr.message);
    else setActivities((actsData as ActivityWithCerts[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pre-select cert from URL param and open form
  useEffect(() => {
    if (!prefillCertId || prefillHandledRef.current || certs.length === 0) return;
    const match = certs.find((c) => String(c.id) === prefillCertId);
    if (match) {
      prefillHandledRef.current = true;
      setForm(EMPTY_FORM);
      setCertSelections([{ certId: String(match.id), hoursApplied: "" }]);
      setEditingId(null);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Clean the URL so refreshing doesn't re-open the form
      router.replace("/cpe-activities", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCertId, certs]);

  // Scroll to and flash highlighted activity once after initial load
  useEffect(() => {
    if (loading || !highlightId || highlightScrolledRef.current) return;
    highlightScrolledRef.current = true;
    const el = document.getElementById(`activity-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(highlightId);
      setTimeout(() => setHighlightedId(null), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, highlightId]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCertSelections([]);
    setPendingFiles([]);
    setExistingPaths([]);
    setFieldErrors({});
    setFormError(null);
    setUploadWarning(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEditForm(act: ActivityWithCerts) {
    setEditingId(act.id);
    setForm({
      title:         act.title,
      provider:      act.provider,
      activity_date: act.activity_date,
      total_hours:   String(act.total_hours),
      category:      act.category ?? "",
      description:   act.description ?? "",
    });
    setCertSelections(
      act.certification_activities.map((ca) => ({
        certId:       String(ca.certification_id),
        hoursApplied: String(ca.hours_applied),
      }))
    );
    setPendingFiles([]);
    setExistingPaths(act.attachment_urls ?? []);
    setFieldErrors({});
    setFormError(null);
    setUploadWarning(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCertSelections([]);
    setPendingFiles([]);
    setExistingPaths([]);
    setFieldErrors({});
    setFormError(null);
    // uploadWarning intentionally NOT cleared here — it survives form close
    // so the user sees it after the activity is saved
  }

  // ── Cert selection ───────────────────────────────────────────────────────────

  function toggleCert(certId: string) {
    setCertSelections((prev) => {
      const exists = prev.find((s) => s.certId === certId);
      if (exists) return prev.filter((s) => s.certId !== certId);
      return [...prev, { certId, hoursApplied: form.total_hours || "" }];
    });
    setFieldErrors((e) => ({ ...e, certifications: "" }));
  }

  function setHours(certId: string, value: string) {
    setCertSelections((prev) =>
      prev.map((s) => (s.certId === certId ? { ...s, hoursApplied: value } : s))
    );
  }

  // Sync default hours when total_hours field changes
  function handleTotalHoursChange(value: string) {
    setForm((f) => ({ ...f, total_hours: value }));
    // Update any selections that still have the old default (empty or matching old total)
    setCertSelections((prev) =>
      prev.map((s) =>
        s.hoursApplied === "" || s.hoursApplied === form.total_hours
          ? { ...s, hoursApplied: value }
          : s
      )
    );
  }

  // ── File handling ────────────────────────────────────────────────────────────

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const valid = arr.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED_EXTENSIONS.has(ext)) {
        alert(`"${f.name}" is not an allowed file type (PDF, JPG, PNG, GIF, WEBP only).`);
        return false;
      }
      if (f.size > MAX_FILE_BYTES) {
        alert(`"${f.name}" exceeds 5 MB and was skipped.`);
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function removeExistingPath(path: string) {
    await supabase.storage.from("cpe-attachments").remove([path]);
    setExistingPaths((prev) => prev.filter((p) => p !== path));
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: FieldErrors = {};
    if (!form.title.trim()) errs.title = "Activity title is required.";
    if (!form.provider.trim()) errs.provider = "Provider is required.";
    if (!form.activity_date) {
      errs.activity_date = "Date is required.";
    } else {
      const d = new Date(form.activity_date + "T00:00:00Z");
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (d > today) errs.activity_date = "Date cannot be in the future.";
    }
    const h = Number(form.total_hours);
    if (!form.total_hours) errs.total_hours = "Total hours is required.";
    else if (isNaN(h) || h <= 0) errs.total_hours = "Hours must be greater than 0.";
    else if (h > 500) errs.total_hours = "Hours cannot exceed 500.";
    if (certSelections.length === 0)
      errs.certifications = "Select at least one certification.";
    else {
      for (const s of certSelections) {
        const sh = Number(s.hoursApplied);
        if (!s.hoursApplied || isNaN(sh) || sh <= 0) {
          errs.certifications = "Enter hours applied for each selected certification.";
          break;
        }
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate() || !user) return;

    setSaving(true);

    // Generate ID on the frontend so storage paths and DB record align
    const activityId = editingId ?? crypto.randomUUID();

    // Upload new files to storage
    const uploadedPaths: string[] = [];
    const failedNames: string[] = [];
    for (const file of pendingFiles) {
      const safeName = sanitizeFilename(file.name);
      const path = `${user.id}/${activityId}/${safeName}`;
      try {
        const { error: uploadErr } = await supabase.storage
          .from("cpe-attachments")
          .upload(path, file, { upsert: true });
        if (uploadErr) {
          console.error("Upload error:", uploadErr);
          failedNames.push(file.name);
        } else {
          uploadedPaths.push(path);
        }
      } catch (err) {
        console.error("Upload exception:", err);
        failedNames.push(file.name);
      }
    }

    const allPaths = [...existingPaths, ...uploadedPaths];

    const body = {
      id:              editingId ? undefined : activityId,
      title:           form.title,
      provider:        form.provider,
      activity_date:   form.activity_date,
      total_hours:     form.total_hours,
      category:        form.category,
      description:     form.description,
      attachment_urls: allPaths,
      certifications:  certSelections.map((s) => ({
        id:            s.certId,
        hours_applied: s.hoursApplied,
      })),
    };

    const url    = editingId ? `/api/cpe-activities/${editingId}` : "/api/cpe-activities";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      if (data.errors) {
        setFieldErrors(data.errors);
      } else {
        setFormError(data.error ?? "Failed to save activity.");
      }
      setSaving(false);
      return;
    }

    closeForm();
    await fetchAll();
    setSaving(false);

    // Set warning AFTER closeForm so it isn't cleared
    if (failedNames.length > 0) {
      setUploadWarning(
        `Activity saved. ${failedNames.length === 1 ? "1 file" : `${failedNames.length} files`} failed to upload: ${failedNames.join(", ")}. You can add ${failedNames.length === 1 ? "it" : "them"} later by editing the activity.`
      );
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(act: ActivityWithCerts) {
    if (!window.confirm(`Delete "${act.title}"? This cannot be undone.`)) return;

    // Remove storage files
    if (act.attachment_urls.length > 0) {
      await supabase.storage.from("cpe-attachments").remove(act.attachment_urls);
    }

    const res = await fetch(`/api/cpe-activities/${act.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete activity. Please try again.");
      return;
    }
    await fetchAll();
  }

  // ── Submission modal helpers ──────────────────────────────────────────────────

  function openSubmitModal(ca: ActivityCertLink, activityDate: string, activityTitle: string) {
    setSubmitModal({
      junctionId: ca.id,
      activityDate,
      activityTitle,
      certName: ca.certifications?.name ?? String(ca.certification_id),
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
    await fetchAll();
    setSubmitSaving(false);
  }

  async function handleRecall(junctionId: string) {
    const res = await fetch(`/api/cert-activity-links/${junctionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submitted_to_org: false,
        submitted_date: null,
        submission_notes: null,
      }),
    });
    if (!res.ok) {
      alert("Failed to recall submission. Please try again.");
    } else {
      await fetchAll();
    }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────────

  const disabled = disabledCertIds(certSelections, certs);
  const byCert = filterCertId
    ? activities.filter((a) =>
        a.certification_activities.some(
          (ca) => String(ca.certification_id) === filterCertId
        )
      )
    : activities;

  const filtered =
    filterSubmit === "all"
      ? byCert
      : filterSubmit === "submitted"
        ? byCert.filter((a) => a.certification_activities.some((ca) => ca.submitted_to_org))
        : byCert.filter((a) => a.certification_activities.some((ca) => !ca.submitted_to_org));

  // ── Shared style helpers ──────────────────────────────────────────────────────

  const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const inp =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm " +
    "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 " +
    "placeholder-gray-400 dark:placeholder-gray-500 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent";
  const inpErr =
    "w-full px-3 py-2 border border-red-400 dark:border-red-500 rounded-lg text-sm " +
    "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 " +
    "focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";

  function inputCls(field: keyof FormData) {
    return fieldErrors[field] ? inpErr : inp;
  }

  function ErrMsg({ field }: { field: string }) {
    const msg = fieldErrors[field];
    if (!msg) return null;
    return (
      <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
        {msg}
      </p>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            CPD Activities
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Log and track your continuing professional development activities.
          </p>
        </div>
        <button
          onClick={showForm ? closeForm : openAddForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 dark:bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 dark:hover:bg-blue-600 transition-colors shadow-sm"
        >
          {showForm ? (
            <><span className="text-lg leading-none">×</span> Cancel</>
          ) : (
            <><span className="text-lg leading-none">+</span> Log Activity</>
          )}
        </button>
      </div>

      {/* Upload warning banner — shown after save if any files failed */}
      {uploadWarning && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <p className="flex-1">{uploadWarning}</p>
          <button
            onClick={() => setUploadWarning(null)}
            className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Add / Edit form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">
            {editingId ? "Edit Activity" : "Log New Activity"}
          </h2>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Row 1: title + provider */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>
                  Activity Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Cloud Security Fundamentals"
                  className={inputCls("title")}
                />
                <ErrMsg field="title" />
              </div>
              <div>
                <label className={lbl}>
                  Provider / Source <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.provider}
                  onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                  placeholder="e.g. SANS Institute, Coursera"
                  className={inputCls("provider")}
                />
                <ErrMsg field="provider" />
              </div>
            </div>

            {/* Row 2: date + hours + category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>
                  Date Completed <span className="text-red-500">*</span>
                </label>
                <DateInput
                  value={form.activity_date}
                  hasError={!!fieldErrors.activity_date}
                  onChange={(v) => setForm((f) => ({ ...f, activity_date: v }))}
                />
                <ErrMsg field="activity_date" />
              </div>
              <div>
                <label className={lbl}>
                  Total Hours <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  max="500"
                  value={form.total_hours}
                  onChange={(e) => handleTotalHoursChange(e.target.value)}
                  placeholder="e.g. 8"
                  className={inputCls("total_hours")}
                />
                <ErrMsg field="total_hours" />
              </div>
              <div>
                <label className={lbl}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className={inp}
                >
                  <option value="">Select a category…</option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Select the category that best matches this activity
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={lbl}>Description / Notes</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes about this activity…"
                className={`${inp} resize-none`}
              />
            </div>

            {/* File upload */}
            <div>
              <label className={lbl}>Attachments</label>

              {/* Existing files (edit mode) */}
              {existingPaths.length > 0 && (
                <div className="mb-2 space-y-1">
                  {existingPaths.map((path) => (
                    <div
                      key={path}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <AttachmentButton path={path} />
                      <button
                        type="button"
                        onClick={() => removeExistingPath(path)}
                        className="text-xs text-red-500 hover:text-red-700 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New file drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Drop files here or{" "}
                  <span className="text-blue-900 dark:text-blue-400 font-medium">
                    click to select
                  </span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  PDF, JPG, PNG, GIF • Max 5 MB each
                </p>
              </div>

              {/* Pending new files */}
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                    >
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                        📄 {f.name}{" "}
                        <span className="text-gray-600 dark:text-gray-400">
                          ({(f.size / 1024).toFixed(0)} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="text-xs text-red-500 hover:text-red-700 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certification multi-select */}
            <div>
              <label className={`${lbl} mb-2`}>
                Apply to Certifications <span className="text-red-500">*</span>
              </label>

              {certs.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No certifications found.{" "}
                  <a href="/certifications" className="text-blue-900 dark:text-blue-400 hover:underline">
                    Add one first.
                  </a>
                </p>
              ) : (
                <div className="space-y-2">
                  {certs.map((cert) => {
                    const isSelected  = certSelections.some((s) => s.certId === String(cert.id));
                    const isDisabled  = !isSelected && disabled.has(String(cert.id));
                    const selection   = certSelections.find((s) => s.certId === String(cert.id));
                    const blockingOrg = isDisabled
                      ? certs.find(
                          (c) =>
                            certSelections.some((s) => s.certId === String(c.id)) &&
                            c.organization === cert.organization
                        )
                      : null;

                    return (
                      <div
                        key={cert.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                          isSelected
                            ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
                            : isDisabled
                              ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => toggleCert(String(cert.id))}
                          className="w-4 h-4 rounded accent-blue-900 dark:accent-blue-400 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {cert.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {cert.organization}
                          </p>
                          {isDisabled && blockingOrg && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              Already selected another {cert.organization} certification
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              hrs:
                            </label>
                            <input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={selection?.hoursApplied ?? ""}
                              onChange={(e) => setHours(String(cert.id), e.target.value)}
                              className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-900"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <ErrMsg field="certifications" />
            </div>

            {/* Form-level error */}
            {formError && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"
              >
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
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
                  ? editingId ? "Updating…" : "Saving…"
                  : editingId ? "Update Activity" : "Save Activity"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      {!loading && activities.length > 0 && (
        <div className="space-y-2 mb-4">
          {/* Cert filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
              Filter:
            </label>
            <select
              value={filterCertId}
              onChange={(e) => setFilterCertId(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="">All certifications</option>
              {certs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {filterCertId && (
              <button
                onClick={() => setFilterCertId("")}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Submission status tabs */}
          <div className="flex items-center gap-1">
            {(["all", "submitted", "unsubmitted"] as SubmitFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterSubmit(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  filterSubmit === f
                    ? "bg-blue-900 dark:bg-blue-700 text-white"
                    : "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {f === "all" ? "All" : f === "submitted" ? "Submitted" : "Not Submitted"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content area ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-600 dark:text-gray-400 text-sm">
          Loading activities…
        </div>
      ) : pageError ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400 text-sm">
          <strong>Error:</strong> {pageError}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">📚</div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            No activities logged yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click &ldquo;Log Activity&rdquo; to record your first CPD activity.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No activities match the current filter.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((act) => (
            <div
              key={act.id}
              id={`activity-${act.id}`}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border transition-colors duration-700 ${
                highlightedId === act.id
                  ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {/* Activity header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                    {act.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {act.provider}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatHours(act.total_hours)} hrs
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {formatDate(act.activity_date)}
                  </p>
                </div>
              </div>

              {/* Category */}
              {act.category && (
                <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                  {act.category}
                </span>
              )}

              {/* Description */}
              {act.description && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {act.description}
                </p>
              )}

              {/* Applied-to certs with submission status */}
              {act.certification_activities.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">
                    Applied to
                  </p>
                  <div className="space-y-1.5">
                    {act.certification_activities.map((ca) => (
                      <div
                        key={ca.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="text-xs text-blue-900 dark:text-blue-400 truncate">
                            {ca.certifications?.name ?? ca.certification_id}
                          </span>
                          <span className="text-xs text-blue-600 dark:text-blue-500 font-medium shrink-0">
                            · {formatHours(ca.hours_applied)} hrs
                          </span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              ca.submitted_to_org
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            }`}
                          >
                            {ca.submitted_to_org ? "Submitted" : "Not Submitted"}
                          </span>
                          {ca.submitted_to_org && ca.submitted_date && (
                            <span className="text-xs text-green-600 dark:text-green-400 shrink-0">
                              · {formatDate(ca.submitted_date)}
                            </span>
                          )}
                          {ca.certifications?.organization_url && (
                            <a
                              href={ca.certifications.organization_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-900 dark:hover:text-blue-400 transition-colors"
                              title={`Submit CPD to ${ca.certifications.organization}`}
                            >
                              · {ca.certifications.organization} portal
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ca.submitted_to_org ? (
                            <button
                              onClick={() => handleRecall(ca.id)}
                              className="shrink-0 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 transition-colors"
                            >
                              Recall
                            </button>
                          ) : (
                            <button
                              onClick={() => openSubmitModal(ca, act.activity_date, act.title)}
                              className="shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 transition-colors"
                            >
                              Mark Submitted
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {act.attachment_urls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">
                    Attachments
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {act.attachment_urls.map((path) => (
                      <AttachmentButton key={path} path={path} />
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                <button
                  onClick={() => openEditForm(act)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(act)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
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
                  Notes <span className="text-gray-600 dark:text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={submitNotes}
                  onChange={e => setSubmitNotes(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Submitted via ISC2 CPD Portal…"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-right">
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
    </main>
  );
}

// ── Page export with Suspense (required by Next.js for useSearchParams) ────────

export default function CpeActivitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-gray-600 dark:text-gray-400 text-sm">
          Loading…
        </div>
      }
    >
      <CpeActivitiesInner />
    </Suspense>
  );
}
