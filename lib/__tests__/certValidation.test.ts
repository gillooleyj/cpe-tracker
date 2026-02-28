import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  stripHtml,
  validateCertForm,
  sanitizeCertForm,
  type CertFormFields,
} from "@/lib/certValidation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFields(overrides: Partial<CertFormFields> = {}): CertFormFields {
  return {
    name: "CISSP",
    organization: "ISC2",
    organization_url: "",
    issue_date: "2020-01-01",
    expiration_date: "2026-06-01",
    cpe_required: "120",
    cpe_cycle_length: "",
    annual_minimum_cpe: "",
    digital_certificate_url: "",
    ...overrides,
  };
}

// ── stripHtml ─────────────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("returns plain text unchanged", () => {
    expect(stripHtml("Hello World")).toBe("Hello World");
  });

  it("strips a single HTML tag", () => {
    expect(stripHtml("<b>Bold</b>")).toBe("Bold");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<div><span>text</span></div>")).toBe("text");
  });

  it("strips script tags", () => {
    expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it("trims surrounding whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  it("trims whitespace after stripping", () => {
    expect(stripHtml("  <b>hello</b>  ")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("handles malformed tags gracefully", () => {
    expect(stripHtml("foo<bar")).toBe("foo<bar");
  });

  it("strips multiple separate tags", () => {
    expect(stripHtml("<i>a</i> and <b>b</b>")).toBe("a and b");
  });
});

// ── validateCertForm ──────────────────────────────────────────────────────────

describe("validateCertForm", () => {
  beforeEach(() => {
    // Set today to 2024-01-15 at noon UTC so date comparisons are deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns valid=true for a valid minimal form", () => {
    const result = validateCertForm(makeFields());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.warnings).toEqual({});
  });

  // ── name ──────────────────────────────────────────────────────────────────

  describe("name field", () => {
    it("errors when name is empty", () => {
      const result = validateCertForm(makeFields({ name: "" }));
      expect(result.errors.name).toBe("Certification name is required.");
      expect(result.valid).toBe(false);
    });

    it("errors when name (after stripping HTML) is empty", () => {
      const result = validateCertForm(makeFields({ name: "<b></b>" }));
      expect(result.errors.name).toBe("Certification name is required.");
    });

    it("errors when name is 1 character", () => {
      const result = validateCertForm(makeFields({ name: "A" }));
      expect(result.errors.name).toBe("Must be at least 2 characters.");
    });

    it("accepts name with exactly 2 characters", () => {
      const result = validateCertForm(makeFields({ name: "AB" }));
      expect(result.errors.name).toBeUndefined();
    });

    it("errors when name exceeds 100 characters", () => {
      const result = validateCertForm(makeFields({ name: "A".repeat(101) }));
      expect(result.errors.name).toBe("Must be 100 characters or fewer.");
    });

    it("accepts name with exactly 100 characters", () => {
      const result = validateCertForm(makeFields({ name: "A".repeat(100) }));
      expect(result.errors.name).toBeUndefined();
    });

    it("strips HTML from name before length check", () => {
      // <b>A</b> → "A" → 1 char → error
      const result = validateCertForm(makeFields({ name: "<b>A</b>" }));
      expect(result.errors.name).toBe("Must be at least 2 characters.");
    });
  });

  // ── organization ─────────────────────────────────────────────────────────

  describe("organization field", () => {
    it("errors when organization is empty", () => {
      const result = validateCertForm(makeFields({ organization: "" }));
      expect(result.errors.organization).toBe("Organization is required.");
    });

    it("errors when organization is 1 character", () => {
      const result = validateCertForm(makeFields({ organization: "A" }));
      expect(result.errors.organization).toBe("Must be at least 2 characters.");
    });

    it("errors when organization exceeds 100 characters", () => {
      const result = validateCertForm(makeFields({ organization: "A".repeat(101) }));
      expect(result.errors.organization).toBe("Must be 100 characters or fewer.");
    });

    it("accepts valid organization", () => {
      const result = validateCertForm(makeFields({ organization: "ISC2" }));
      expect(result.errors.organization).toBeUndefined();
    });
  });

  // ── organization_url ─────────────────────────────────────────────────────

  describe("organization_url field", () => {
    it("accepts empty organization_url", () => {
      const result = validateCertForm(makeFields({ organization_url: "" }));
      expect(result.errors.organization_url).toBeUndefined();
    });

    it("accepts valid https URL", () => {
      const result = validateCertForm(makeFields({ organization_url: "https://example.com" }));
      expect(result.errors.organization_url).toBeUndefined();
    });

    it("errors when URL is http (not https)", () => {
      const result = validateCertForm(makeFields({ organization_url: "http://example.com" }));
      expect(result.errors.organization_url).toMatch(/https/);
    });

    it("errors when URL has no protocol", () => {
      const result = validateCertForm(makeFields({ organization_url: "example.com" }));
      expect(result.errors.organization_url).toMatch(/https/);
    });

    it("errors for javascript: protocol", () => {
      const result = validateCertForm(makeFields({ organization_url: "javascript:alert(1)" }));
      expect(result.errors.organization_url).toMatch(/https/);
    });

    it("trims whitespace before checking", () => {
      const result = validateCertForm(makeFields({ organization_url: "  " }));
      expect(result.errors.organization_url).toBeUndefined();
    });
  });

  // ── issue_date ───────────────────────────────────────────────────────────

  describe("issue_date field", () => {
    it("errors when issue_date is empty", () => {
      const result = validateCertForm(makeFields({ issue_date: "" }));
      expect(result.errors.issue_date).toBe("Issue date is required.");
    });

    it("errors for invalid date string", () => {
      const result = validateCertForm(makeFields({ issue_date: "2023-13-01" }));
      expect(result.errors.issue_date).toBe("Enter a valid date.");
    });

    it("errors for wrong format", () => {
      const result = validateCertForm(makeFields({ issue_date: "01/01/2020" }));
      expect(result.errors.issue_date).toBe("Enter a valid date.");
    });

    it("errors when issue_date is in the future", () => {
      const result = validateCertForm(makeFields({ issue_date: "2024-01-16" }));
      expect(result.errors.issue_date).toBe("Issue date cannot be in the future.");
    });

    it("accepts today as issue_date", () => {
      const result = validateCertForm(makeFields({ issue_date: "2024-01-15" }));
      expect(result.errors.issue_date).toBeUndefined();
    });

    it("accepts a past issue_date", () => {
      const result = validateCertForm(makeFields({ issue_date: "2020-06-15" }));
      expect(result.errors.issue_date).toBeUndefined();
    });
  });

  // ── expiration_date ───────────────────────────────────────────────────────

  describe("expiration_date field", () => {
    it("errors when expiration_date is empty", () => {
      const result = validateCertForm(makeFields({ expiration_date: "" }));
      expect(result.errors.expiration_date).toBe("Expiration date is required.");
    });

    it("errors for invalid date string", () => {
      const result = validateCertForm(makeFields({ expiration_date: "2023-13-01" }));
      expect(result.errors.expiration_date).toBe("Enter a valid date.");
    });

    it("errors when expiration_date is same as issue_date", () => {
      const result = validateCertForm(makeFields({ issue_date: "2020-01-01", expiration_date: "2020-01-01" }));
      expect(result.errors.expiration_date).toBe("Expiration date must be after the issue date.");
    });

    it("errors when expiration_date is before issue_date", () => {
      const result = validateCertForm(makeFields({ issue_date: "2022-06-01", expiration_date: "2022-05-01" }));
      expect(result.errors.expiration_date).toBe("Expiration date must be after the issue date.");
    });

    it("accepts expiration_date after issue_date", () => {
      const result = validateCertForm(makeFields({ issue_date: "2020-01-01", expiration_date: "2026-01-01" }));
      expect(result.errors.expiration_date).toBeUndefined();
    });

    it("warns when expiration_date is more than 10 years out", () => {
      // Today is 2024-01-15; >10 years = after 2034-01-15
      const result = validateCertForm(makeFields({ expiration_date: "2035-01-16" }));
      expect(result.warnings.expiration_date).toMatch(/10 years/);
    });

    it("does not warn when expiration_date is exactly 10 years out", () => {
      const result = validateCertForm(makeFields({ expiration_date: "2034-01-15" }));
      expect(result.warnings.expiration_date).toBeUndefined();
    });

    it("no expiration error when issue_date is invalid", () => {
      // When issue_date is invalid, issueDate is null; expDate compared to null → no <= check
      const result = validateCertForm(makeFields({ issue_date: "bad", expiration_date: "2026-01-01" }));
      expect(result.errors.expiration_date).toBeUndefined();
    });
  });

  // ── cpe_required ─────────────────────────────────────────────────────────

  describe("cpe_required field", () => {
    it("errors when cpe_required is empty", () => {
      const result = validateCertForm(makeFields({ cpe_required: "" }));
      expect(result.errors.cpe_required).toBe("CPD hours required is required.");
    });

    it("errors for zero", () => {
      const result = validateCertForm(makeFields({ cpe_required: "0" }));
      expect(result.errors.cpe_required).toMatch(/whole number/);
    });

    it("errors for negative", () => {
      const result = validateCertForm(makeFields({ cpe_required: "-1" }));
      expect(result.errors.cpe_required).toMatch(/whole number/);
    });

    it("errors for non-integer", () => {
      const result = validateCertForm(makeFields({ cpe_required: "1.5" }));
      expect(result.errors.cpe_required).toMatch(/whole number/);
    });

    it("errors when exceeds 500", () => {
      const result = validateCertForm(makeFields({ cpe_required: "501" }));
      expect(result.errors.cpe_required).toBe("Cannot exceed 500 CPD hours.");
    });

    it("accepts 500", () => {
      const result = validateCertForm(makeFields({ cpe_required: "500" }));
      expect(result.errors.cpe_required).toBeUndefined();
    });

    it("accepts 1", () => {
      const result = validateCertForm(makeFields({ cpe_required: "1" }));
      expect(result.errors.cpe_required).toBeUndefined();
    });

    it("errors for non-numeric string", () => {
      const result = validateCertForm(makeFields({ cpe_required: "abc" }));
      expect(result.errors.cpe_required).toMatch(/whole number/);
    });
  });

  // ── cpe_cycle_length ─────────────────────────────────────────────────────

  describe("cpe_cycle_length field", () => {
    it("accepts empty (optional)", () => {
      const result = validateCertForm(makeFields({ cpe_cycle_length: "" }));
      expect(result.errors.cpe_cycle_length).toBeUndefined();
    });

    it("errors for zero", () => {
      const result = validateCertForm(makeFields({ cpe_cycle_length: "0" }));
      expect(result.errors.cpe_cycle_length).toMatch(/whole number/);
    });

    it("errors for negative", () => {
      const result = validateCertForm(makeFields({ cpe_cycle_length: "-5" }));
      expect(result.errors.cpe_cycle_length).toMatch(/whole number/);
    });

    it("errors when exceeds 120", () => {
      const result = validateCertForm(makeFields({ cpe_cycle_length: "121" }));
      expect(result.errors.cpe_cycle_length).toBe("Cannot exceed 120 months (10 years).");
    });

    it("accepts 120", () => {
      const result = validateCertForm(makeFields({ cpe_cycle_length: "120" }));
      expect(result.errors.cpe_cycle_length).toBeUndefined();
    });

    it("accepts 36", () => {
      const result = validateCertForm(makeFields({ cpe_cycle_length: "36" }));
      expect(result.errors.cpe_cycle_length).toBeUndefined();
    });

    it("errors for non-integer", () => {
      const result = validateCertForm(makeFields({ cpe_cycle_length: "2.5" }));
      expect(result.errors.cpe_cycle_length).toMatch(/whole number/);
    });
  });

  // ── annual_minimum_cpe ────────────────────────────────────────────────────

  describe("annual_minimum_cpe field", () => {
    it("accepts empty (optional)", () => {
      const result = validateCertForm(makeFields({ annual_minimum_cpe: "" }));
      expect(result.errors.annual_minimum_cpe).toBeUndefined();
    });

    it("accepts 0", () => {
      const result = validateCertForm(makeFields({ annual_minimum_cpe: "0" }));
      expect(result.errors.annual_minimum_cpe).toBeUndefined();
    });

    it("errors for negative", () => {
      const result = validateCertForm(makeFields({ annual_minimum_cpe: "-1" }));
      expect(result.errors.annual_minimum_cpe).toMatch(/non-negative/);
    });

    it("errors for non-integer", () => {
      const result = validateCertForm(makeFields({ annual_minimum_cpe: "1.5" }));
      expect(result.errors.annual_minimum_cpe).toMatch(/non-negative/);
    });

    it("errors when annual exceeds cpe_required", () => {
      const result = validateCertForm(makeFields({ cpe_required: "120", annual_minimum_cpe: "121" }));
      expect(result.errors.annual_minimum_cpe).toMatch(/Cannot exceed total/);
    });

    it("accepts annual equal to cpe_required", () => {
      const result = validateCertForm(makeFields({ cpe_required: "120", annual_minimum_cpe: "120" }));
      expect(result.errors.annual_minimum_cpe).toBeUndefined();
    });

    it("accepts annual less than cpe_required", () => {
      const result = validateCertForm(makeFields({ cpe_required: "120", annual_minimum_cpe: "40" }));
      expect(result.errors.annual_minimum_cpe).toBeUndefined();
    });
  });

  // ── digital_certificate_url ───────────────────────────────────────────────

  describe("digital_certificate_url field", () => {
    it("accepts empty (optional)", () => {
      const result = validateCertForm(makeFields({ digital_certificate_url: "" }));
      expect(result.errors.digital_certificate_url).toBeUndefined();
    });

    it("accepts valid https URL", () => {
      const result = validateCertForm(makeFields({ digital_certificate_url: "https://certs.example.com/abc" }));
      expect(result.errors.digital_certificate_url).toBeUndefined();
    });

    it("errors for http URL", () => {
      const result = validateCertForm(makeFields({ digital_certificate_url: "http://certs.example.com" }));
      expect(result.errors.digital_certificate_url).toMatch(/https/);
    });

    it("errors for non-URL string", () => {
      const result = validateCertForm(makeFields({ digital_certificate_url: "not-a-url" }));
      expect(result.errors.digital_certificate_url).toMatch(/https/);
    });
  });

  // ── valid flag ───────────────────────────────────────────────────────────

  describe("valid flag", () => {
    it("is false when any error exists", () => {
      const result = validateCertForm(makeFields({ name: "" }));
      expect(result.valid).toBe(false);
    });

    it("is true when only warnings exist (no errors)", () => {
      const result = validateCertForm(makeFields({ expiration_date: "2035-01-16" }));
      expect(result.valid).toBe(true);
    });
  });
});

// ── sanitizeCertForm ──────────────────────────────────────────────────────────

describe("sanitizeCertForm", () => {
  it("strips HTML from name", () => {
    const result = sanitizeCertForm(makeFields({ name: "<b>CISSP</b>" }));
    expect(result.name).toBe("CISSP");
  });

  it("strips HTML from organization", () => {
    const result = sanitizeCertForm(makeFields({ organization: "<i>ISC2</i>" }));
    expect(result.organization).toBe("ISC2");
  });

  it("converts organization_url empty string to null", () => {
    const result = sanitizeCertForm(makeFields({ organization_url: "" }));
    expect(result.organization_url).toBeNull();
  });

  it("trims organization_url", () => {
    const result = sanitizeCertForm(makeFields({ organization_url: "  https://example.com  " }));
    expect(result.organization_url).toBe("https://example.com");
  });

  it("keeps organization_url when non-empty", () => {
    const result = sanitizeCertForm(makeFields({ organization_url: "https://isc2.org" }));
    expect(result.organization_url).toBe("https://isc2.org");
  });

  it("converts cpe_required string to number", () => {
    const result = sanitizeCertForm(makeFields({ cpe_required: "120" }));
    expect(result.cpe_required).toBe(120);
  });

  it("converts empty cpe_required to null", () => {
    const result = sanitizeCertForm(makeFields({ cpe_required: "" }));
    expect(result.cpe_required).toBeNull();
  });

  it("converts cpe_cycle_length string to number", () => {
    const result = sanitizeCertForm(makeFields({ cpe_cycle_length: "36" }));
    expect(result.cpe_cycle_length).toBe(36);
  });

  it("converts empty cpe_cycle_length to null", () => {
    const result = sanitizeCertForm(makeFields({ cpe_cycle_length: "" }));
    expect(result.cpe_cycle_length).toBeNull();
  });

  it("converts annual_minimum_cpe string to number", () => {
    const result = sanitizeCertForm(makeFields({ annual_minimum_cpe: "40" }));
    expect(result.annual_minimum_cpe).toBe(40);
  });

  it("converts empty annual_minimum_cpe to null", () => {
    const result = sanitizeCertForm(makeFields({ annual_minimum_cpe: "" }));
    expect(result.annual_minimum_cpe).toBeNull();
  });

  it("converts digital_certificate_url empty string to null", () => {
    const result = sanitizeCertForm(makeFields({ digital_certificate_url: "" }));
    expect(result.digital_certificate_url).toBeNull();
  });

  it("trims digital_certificate_url whitespace", () => {
    const result = sanitizeCertForm(makeFields({ digital_certificate_url: "  https://cert.example.com  " }));
    expect(result.digital_certificate_url).toBe("https://cert.example.com");
  });

  it("keeps issue_date as-is", () => {
    const result = sanitizeCertForm(makeFields({ issue_date: "2020-01-01" }));
    expect(result.issue_date).toBe("2020-01-01");
  });

  it("converts empty issue_date to null", () => {
    const result = sanitizeCertForm(makeFields({ issue_date: "" }));
    expect(result.issue_date).toBeNull();
  });
});
