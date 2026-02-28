/**
 * Shared certification form validation.
 * This module is intentionally free of browser/Node-specific APIs so it runs
 * identically in client components and server-side Route Handlers.
 */

export type CertFormFields = {
  name: string;
  organization: string;
  organization_url: string;
  issue_date: string;
  expiration_date: string;
  cpe_required: string;
  cpe_cycle_length: string;
  annual_minimum_cpe: string;
  digital_certificate_url: string;
};

export type FieldErrors   = Partial<Record<keyof CertFormFields, string>>;
export type FieldWarnings = Partial<Record<keyof CertFormFields, string>>;

export interface ValidationResult {
  errors:   FieldErrors;
  warnings: FieldWarnings;
  /** True only when errors is empty. */
  valid: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip HTML tags to prevent stored XSS. Works via regex in all envs. */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

/** Only allow https:// URLs (blocks javascript: and other schemes). */
function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Parse YYYY-MM-DD → Date at UTC midnight, or null if the string is invalid. */
function parseISODate(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

/** Today at UTC midnight — used as the reference point for "future" checks. */
function utcToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── Main validator ────────────────────────────────────────────────────────────

export function validateCertForm(raw: CertFormFields): ValidationResult {
  const errors:   FieldErrors   = {};
  const warnings: FieldWarnings = {};

  // ── name ──────────────────────────────────────────────────────────────────
  const name = stripHtml(raw.name);
  if (!name) {
    errors.name = "Certification name is required.";
  } else if (name.length < 2) {
    errors.name = "Must be at least 2 characters.";
  } else if (name.length > 100) {
    errors.name = "Must be 100 characters or fewer.";
  }

  // ── organization ──────────────────────────────────────────────────────────
  const org = stripHtml(raw.organization);
  if (!org) {
    errors.organization = "Organization is required.";
  } else if (org.length < 2) {
    errors.organization = "Must be at least 2 characters.";
  } else if (org.length > 100) {
    errors.organization = "Must be 100 characters or fewer.";
  }

  // ── organization_url ──────────────────────────────────────────────────────
  const orgUrl = raw.organization_url.trim();
  if (orgUrl && !isValidHttpsUrl(orgUrl)) {
    errors.organization_url =
      "Must be a valid https:// URL (e.g. https://example.com).";
  }

  // ── issue_date ────────────────────────────────────────────────────────────
  const today = utcToday();
  let issueDate: Date | null = null;

  if (!raw.issue_date) {
    errors.issue_date = "Issue date is required.";
  } else {
    issueDate = parseISODate(raw.issue_date);
    if (!issueDate) {
      errors.issue_date = "Enter a valid date.";
    } else if (issueDate > today) {
      errors.issue_date = "Issue date cannot be in the future.";
    }
  }

  // ── expiration_date ───────────────────────────────────────────────────────
  let expDate: Date | null = null;

  if (!raw.expiration_date) {
    errors.expiration_date = "Expiration date is required.";
  } else {
    expDate = parseISODate(raw.expiration_date);
    if (!expDate) {
      errors.expiration_date = "Enter a valid date.";
    } else if (issueDate && expDate <= issueDate) {
      errors.expiration_date =
        "Expiration date must be after the issue date.";
    } else {
      const tenYearsOut = new Date(today);
      tenYearsOut.setFullYear(tenYearsOut.getFullYear() + 10);
      if (expDate > tenYearsOut) {
        warnings.expiration_date =
          "This date is more than 10 years away — please verify.";
      }
    }
  }

  // ── cpe_required ──────────────────────────────────────────────────────────
  const cpeStr = raw.cpe_required.trim();
  let cpeNum = NaN;

  if (!cpeStr) {
    errors.cpe_required = "CPD hours required is required.";
  } else {
    cpeNum = Number(cpeStr);
    if (!Number.isInteger(cpeNum) || cpeNum < 1) {
      errors.cpe_required = "Enter a whole number of at least 1.";
    } else if (cpeNum > 500) {
      errors.cpe_required = "Cannot exceed 500 CPD hours.";
    }
  }

  // ── cpe_cycle_length ──────────────────────────────────────────────────────
  const cycleStr = raw.cpe_cycle_length.trim();
  if (cycleStr) {
    const n = Number(cycleStr);
    if (!Number.isInteger(n) || n < 1) {
      errors.cpe_cycle_length = "Enter a whole number of at least 1.";
    } else if (n > 120) {
      errors.cpe_cycle_length = "Cannot exceed 120 months (10 years).";
    }
  }

  // ── annual_minimum_cpe ────────────────────────────────────────────────────
  const annualStr = raw.annual_minimum_cpe.trim();
  if (annualStr) {
    const n = Number(annualStr);
    if (!Number.isInteger(n) || n < 0) {
      errors.annual_minimum_cpe = "Enter a non-negative whole number.";
    } else if (!isNaN(cpeNum) && n > cpeNum) {
      errors.annual_minimum_cpe =
        `Cannot exceed total CPD hours required (${cpeNum}).`;
    }
  }

  // ── digital_certificate_url ───────────────────────────────────────────────
  const certUrl = raw.digital_certificate_url.trim();
  if (certUrl && !isValidHttpsUrl(certUrl)) {
    errors.digital_certificate_url =
      "Must be a valid https:// URL (e.g. https://example.com).";
  }

  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}

// ── Sanitizer ─────────────────────────────────────────────────────────────────

/** Return clean values ready for database insertion. */
export function sanitizeCertForm(raw: CertFormFields) {
  return {
    name:                    stripHtml(raw.name),
    organization:            stripHtml(raw.organization),
    organization_url:        raw.organization_url.trim()        || null,
    issue_date:              raw.issue_date                     || null,
    expiration_date:         raw.expiration_date                || null,
    cpe_required:            raw.cpe_required    ? Number(raw.cpe_required)    : null,
    cpe_cycle_length:        raw.cpe_cycle_length ? Number(raw.cpe_cycle_length) : null,
    annual_minimum_cpe:      raw.annual_minimum_cpe ? Number(raw.annual_minimum_cpe) : null,
    digital_certificate_url: raw.digital_certificate_url.trim() || null,
  };
}
