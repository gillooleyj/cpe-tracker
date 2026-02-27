import { describe, it, expect } from "vitest";
import {
  CERT_TEMPLATES,
  ORGANIZATIONS,
  searchCertTemplates,
  getCertsForOrg,
  getOrgInfo,
  type CertTemplate,
  type OrgInfo,
} from "@/constants/certifications";

// ── Data integrity ────────────────────────────────────────────────────────────

describe("ORGANIZATIONS", () => {
  it("contains 9 organizations", () => {
    expect(ORGANIZATIONS).toHaveLength(9);
  });

  it("each org has required fields", () => {
    for (const org of ORGANIZATIONS) {
      expect(typeof org.name).toBe("string");
      expect(org.name.length).toBeGreaterThan(0);
      expect(typeof org.url).toBe("string");
      expect(org.url).toMatch(/^https:\/\//);
      expect(["CPE", "CEU", "PDU", "PDC", "RCH", "ECE", "CE"]).toContain(org.creditType);
      expect(typeof org.cycleMonths).toBe("number");
      expect(org.cycleMonths).toBeGreaterThan(0);
    }
  });

  it("includes ISC2 with CPE credit type", () => {
    const isc2 = ORGANIZATIONS.find((o) => o.name === "ISC2");
    expect(isc2).toBeDefined();
    expect(isc2!.creditType).toBe("CPE");
    expect(isc2!.cycleMonths).toBe(36);
  });

  it("includes GIAC with 48-month cycle", () => {
    const giac = ORGANIZATIONS.find((o) => o.name === "GIAC");
    expect(giac).toBeDefined();
    expect(giac!.cycleMonths).toBe(48);
  });
});

describe("CERT_TEMPLATES", () => {
  it("has more than 50 templates", () => {
    expect(CERT_TEMPLATES.length).toBeGreaterThan(50);
  });

  it("each template has required fields", () => {
    for (const cert of CERT_TEMPLATES) {
      expect(typeof cert.name).toBe("string");
      expect(cert.name.length).toBeGreaterThan(0);
      expect(typeof cert.organization).toBe("string");
      expect(cert.organization_url).toMatch(/^https:\/\//);
      expect(typeof cert.cpe_required).toBe("number");
      expect(cert.cpe_required).toBeGreaterThan(0);
      expect(typeof cert.cpe_cycle_length).toBe("number");
      expect(cert.cpe_cycle_length).toBeGreaterThan(0);
      // annual_minimum_cpe is number or null
      expect(
        cert.annual_minimum_cpe === null || typeof cert.annual_minimum_cpe === "number"
      ).toBe(true);
    }
  });

  it("contains CISSP from ISC2", () => {
    const cissp = CERT_TEMPLATES.find((c) => c.name === "CISSP");
    expect(cissp).toBeDefined();
    expect(cissp!.organization).toBe("ISC2");
    expect(cissp!.cpe_required).toBe(120);
    expect(cissp!.annual_minimum_cpe).toBe(40);
    expect(cissp!.credit_type).toBe("CPE");
  });

  it("contains GSEC from GIAC with null annual_minimum_cpe", () => {
    const gsec = CERT_TEMPLATES.find((c) => c.name === "GSEC");
    expect(gsec).toBeDefined();
    expect(gsec!.organization).toBe("GIAC");
    expect(gsec!.annual_minimum_cpe).toBeNull();
  });

  it("contains PMP from PMI", () => {
    const pmp = CERT_TEMPLATES.find((c) => c.name === "PMP");
    expect(pmp).toBeDefined();
    expect(pmp!.organization).toBe("PMI");
    expect(pmp!.credit_type).toBe("PDU");
  });

  it("all templates have organization matching an ORGANIZATIONS entry", () => {
    const orgNames = new Set(ORGANIZATIONS.map((o) => o.name));
    for (const cert of CERT_TEMPLATES) {
      expect(orgNames.has(cert.organization)).toBe(true);
    }
  });
});

// ── getOrgInfo ────────────────────────────────────────────────────────────────

describe("getOrgInfo", () => {
  it("returns org info for a valid org name", () => {
    const info = getOrgInfo("ISC2");
    expect(info).toBeDefined();
    expect(info!.name).toBe("ISC2");
    expect(info!.url).toBe("https://www.isc2.org");
  });

  it("returns undefined for unknown org", () => {
    const info = getOrgInfo("UnknownOrg");
    expect(info).toBeUndefined();
  });

  it("is case sensitive", () => {
    const info = getOrgInfo("isc2");
    expect(info).toBeUndefined();
  });

  it("returns GIAC with 48-month cycle", () => {
    const info = getOrgInfo("GIAC");
    expect(info!.cycleMonths).toBe(48);
  });

  it("returns CompTIA with CEU credit type", () => {
    const info = getOrgInfo("CompTIA");
    expect(info!.creditType).toBe("CEU");
  });
});

// ── getCertsForOrg ────────────────────────────────────────────────────────────

describe("getCertsForOrg", () => {
  it("returns all ISC2 certifications", () => {
    const certs = getCertsForOrg("ISC2");
    expect(certs.length).toBeGreaterThan(0);
    for (const c of certs) {
      expect(c.organization).toBe("ISC2");
    }
  });

  it("returns empty array for unknown org", () => {
    const certs = getCertsForOrg("UnknownOrg");
    expect(certs).toEqual([]);
  });

  it("returns correct count for GIAC", () => {
    const certs = getCertsForOrg("GIAC");
    // GIAC has 13 certs in the template list
    expect(certs.length).toBe(13);
  });

  it("returns only certs for the specified org", () => {
    const certs = getCertsForOrg("ISACA");
    for (const c of certs) {
      expect(c.organization).toBe("ISACA");
    }
    expect(certs.length).toBeGreaterThan(0);
  });

  it("does not mix orgs", () => {
    const isc2 = getCertsForOrg("ISC2");
    const isaca = getCertsForOrg("ISACA");
    const isc2Names = new Set(isc2.map((c) => c.name));
    const isacaNames = new Set(isaca.map((c) => c.name));
    // No name overlap expected
    for (const n of isacaNames) {
      expect(isc2Names.has(n)).toBe(false);
    }
  });
});

// ── searchCertTemplates ───────────────────────────────────────────────────────

describe("searchCertTemplates", () => {
  it("returns up to 20 results for empty query", () => {
    const results = searchCertTemplates("");
    expect(results.length).toBeLessThanOrEqual(20);
    expect(results.length).toBeGreaterThan(0);
  });

  it("finds CISSP by exact name", () => {
    const results = searchCertTemplates("CISSP");
    expect(results.some((c) => c.name === "CISSP")).toBe(true);
  });

  it("finds certs by partial name (case-insensitive)", () => {
    const results = searchCertTemplates("cis");
    expect(results.some((c) => c.name.toLowerCase().includes("cis"))).toBe(true);
  });

  it("finds certs by organization name", () => {
    const results = searchCertTemplates("isaca");
    expect(results.every((c) => c.organization === "ISACA")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array for query with no matches", () => {
    const results = searchCertTemplates("xyznotexist");
    expect(results).toEqual([]);
  });

  it("respects orgFilter to narrow results", () => {
    const results = searchCertTemplates("", "ISC2");
    for (const c of results) {
      expect(c.organization).toBe("ISC2");
    }
  });

  it("respects orgFilter with query", () => {
    const results = searchCertTemplates("c", "ISC2");
    for (const c of results) {
      expect(c.organization).toBe("ISC2");
    }
  });

  it("returns empty array when orgFilter org has no match", () => {
    const results = searchCertTemplates("xyznotexist", "ISC2");
    expect(results).toEqual([]);
  });

  it("caps results at 20 even if more match", () => {
    // No filter, broad query 'c' will match many
    const results = searchCertTemplates("c");
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("finds PMI certifications by org name search", () => {
    const results = searchCertTemplates("PMI");
    expect(results.length).toBeGreaterThan(0);
  });

  it("empty query with orgFilter returns up to 20 certs of that org", () => {
    const results = searchCertTemplates("", "GIAC");
    expect(results.length).toBeLessThanOrEqual(20);
    for (const c of results) {
      expect(c.organization).toBe("GIAC");
    }
  });

  it("search is trimmed before matching", () => {
    const resultsWithSpaces = searchCertTemplates("  CISSP  ");
    expect(resultsWithSpaces.some((c) => c.name === "CISSP")).toBe(true);
  });
});
