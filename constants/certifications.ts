// ── Types ──────────────────────────────────────────────────────────────────────

export type CreditType = "CPD" | "CEU" | "PDU" | "PDC" | "RCH" | "ECE" | "CE";

export type OrgInfo = {
  name: string;
  url: string;
  creditType: CreditType;
  cycleMonths: number;
};

export type CertTemplate = {
  name: string;
  organization: string;
  organization_url: string;
  cpe_required: number;
  cpe_cycle_length: number; // months
  annual_minimum_cpe: number | null;
  credit_type: CreditType;
};

// ── Organizations ──────────────────────────────────────────────────────────────

export const ORGANIZATIONS: OrgInfo[] = [
  { name: "ISC2",       url: "https://www.isc2.org",                                                       creditType: "CPD", cycleMonths: 36 },
  { name: "ISACA",      url: "https://www.isaca.org",                                                      creditType: "CPD", cycleMonths: 36 },
  { name: "GIAC",       url: "https://www.giac.org",                                                       creditType: "CPD", cycleMonths: 48 },
  { name: "EC-Council", url: "https://www.eccouncil.org",                                                  creditType: "ECE", cycleMonths: 36 },
  { name: "CompTIA",    url: "https://www.comptia.org",                                                    creditType: "CEU", cycleMonths: 36 },
  { name: "PMI",        url: "https://www.pmi.org",                                                        creditType: "PDU", cycleMonths: 36 },
  { name: "SHRM",       url: "https://www.shrm.org",                                                       creditType: "PDC", cycleMonths: 36 },
  { name: "HRCI",       url: "https://www.hrci.org",                                                       creditType: "RCH", cycleMonths: 36 },
  { name: "Cisco",      url: "https://www.cisco.com/c/en/us/training-events/training-certifications",      creditType: "CE",  cycleMonths: 36 },
];

// ── Builder helper ─────────────────────────────────────────────────────────────

function makeCerts(
  org: OrgInfo,
  list: [name: string, required: number, annual: number | null][]
): CertTemplate[] {
  return list.map(([name, required, annual]) => ({
    name,
    organization:      org.name,
    organization_url:  org.url,
    cpe_required:      required,
    cpe_cycle_length:  org.cycleMonths,
    annual_minimum_cpe: annual,
    credit_type:       org.creditType,
  }));
}

const [ISC2, ISACA, GIAC, EC_COUNCIL, COMPTIA, PMI, SHRM, HRCI, CISCO] =
  ORGANIZATIONS;

// ── Certification templates ────────────────────────────────────────────────────

export const CERT_TEMPLATES: CertTemplate[] = [
  // ISC2 — 3-year / CPD
  ...makeCerts(ISC2, [
    ["CC",    45,  15],
    ["SSCP",  60,  20],
    ["CGRC",  60,  20],
    ["CSSLP", 90,  30],
    ["CCSP",  90,  30],
    ["CISSP", 120, 40],
    ["ISSAP", 120, 40],
    ["ISSEP", 120, 40],
    ["ISSMP", 120, 40],
  ]),

  // ISACA — 3-year / CPD
  ...makeCerts(ISACA, [
    ["CISA",  120, 20],
    ["CISM",  120, 20],
    ["CRISC", 120, 20],
    ["CGEIT", 120, 20],
    ["CDPSE", 120, 20],
    ["CCOA",  120, 20],
  ]),

  // GIAC — 4-year / CPD, no annual minimum
  ...makeCerts(GIAC, [
    ["GSEC",  36, null],
    ["GCIH",  36, null],
    ["GPEN",  36, null],
    ["GWAPT", 36, null],
    ["GREM",  36, null],
    ["GCFE",  36, null],
    ["GCFA",  36, null],
    ["GCIA",  36, null],
    ["GNFA",  36, null],
    ["GCTI",  36, null],
    ["GRID",  36, null],
    ["GDAT",  36, null],
    ["GFACT", 36, null],
  ]),

  // EC-Council — 3-year / ECE
  ...makeCerts(EC_COUNCIL, [
    ["CEH",   120, 20],
    ["CHFI",  120, 20],
    ["CCISO", 120, 20],
    ["CND",   120, 20],
    ["ECIH",  120, 20],
    ["ECSA",  120, 20],
    ["LPT",   120, 20],
    ["CPENT", 120, 20],
    ["CTIA",  120, 20],
    ["ECES",  120, 20],
    ["CAST",  120, 20],
  ]),

  // CompTIA — 3-year / CEU, no annual minimum
  ...makeCerts(COMPTIA, [
    ["A+",       20, null],
    ["Network+", 30, null],
    ["Linux+",   30, null],
    ["Server+",  30, null],
    ["Cloud+",   30, null],
    ["Security+",50, null],
    ["CySA+",    60, null],
    ["PenTest+", 60, null],
    ["SecurityX",75, null],
  ]),

  // PMI — 3-year / PDU
  ...makeCerts(PMI, [
    ["CAPM",      15, null],
    ["PMI-ACP",   30, null],
    ["PMI-RMP",   30, null],
    ["PMI-SP",    30, null],
    ["PMI-CP",    30, null],
    ["PMI-CPMAI", 30, null],
    ["PMI-PMOCP", 30, null],
    ["PMP",       60, null],
    ["PgMP",      60, null],
    ["PfMP",      60, null],
    ["PMI-PBA",   60, null],
  ]),

  // SHRM — 3-year / PDC
  ...makeCerts(SHRM, [
    ["SHRM-CP",  60, null],
    ["SHRM-SCP", 60, null],
  ]),

  // HRCI — 3-year / RCH
  ...makeCerts(HRCI, [
    ["aPHR",   45, null],
    ["aPHRi",  45, null],
    ["PHR",    60, null],
    ["PHRca",  60, null],
    ["PHRi",   60, null],
    ["SPHR",   60, null],
    ["SPHRi",  60, null],
    ["GPHR",   60, null],
  ]),

  // Cisco — 3-year / CE
  ...makeCerts(CISCO, [
    ["CCNA",                      30,  null],
    ["CCNP Enterprise",           80,  null],
    ["CCNP Security",             80,  null],
    ["CCNP Data Center",          80,  null],
    ["CCNP Service Provider",     80,  null],
    ["CCNP Collaboration",        80,  null],
    ["CCNP DevNet",               80,  null],
    ["CCIE Enterprise Infrastructure", 120, null],
    ["CCIE Enterprise Wireless",  120, null],
    ["CCIE Security",             120, null],
    ["CCIE Data Center",          120, null],
    ["CCIE Service Provider",     120, null],
    ["CCIE Collaboration",        120, null],
    ["CCIE DevNet",               120, null],
    ["CCDE",                      120, null],
  ]),
];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function getOrgInfo(orgName: string): OrgInfo | undefined {
  return ORGANIZATIONS.find((o) => o.name === orgName);
}

export function getCertsForOrg(orgName: string): CertTemplate[] {
  return CERT_TEMPLATES.filter((c) => c.organization === orgName);
}

export function searchCertTemplates(
  query: string,
  orgFilter?: string
): CertTemplate[] {
  const pool = orgFilter ? getCertsForOrg(orgFilter) : CERT_TEMPLATES;
  const q = query.toLowerCase().trim();
  if (!q) return pool.slice(0, 20);
  return pool
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.organization.toLowerCase().includes(q)
    )
    .slice(0, 20);
}
