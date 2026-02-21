export type CertTemplate = {
  name: string;
  organization: string;
  organization_url: string;
  cpe_required: number;
  cpe_cycle_length: number;
  annual_minimum_cpe: number | null;
};

export const CERT_TEMPLATES: CertTemplate[] = [
  // ISC2
  {
    name: "CC",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 45,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 15,
  },
  {
    name: "CISSP",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 40,
  },
  {
    name: "CCSP",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 90,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 30,
  },
  {
    name: "CGRC",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 60,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  {
    name: "CSSLP",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 90,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 30,
  },
  {
    name: "SSCP",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 60,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  {
    name: "HCISPP",
    organization: "ISC2",
    organization_url: "https://www.isc2.org",
    cpe_required: 60,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  // ISACA
  {
    name: "CISM",
    organization: "ISACA",
    organization_url: "https://www.isaca.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  {
    name: "CISA",
    organization: "ISACA",
    organization_url: "https://www.isaca.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  {
    name: "CRISC",
    organization: "ISACA",
    organization_url: "https://www.isaca.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  {
    name: "CGEIT",
    organization: "ISACA",
    organization_url: "https://www.isaca.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  {
    name: "CDPSE",
    organization: "ISACA",
    organization_url: "https://www.isaca.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: 20,
  },
  // Scrum Alliance
  {
    name: "CSM",
    organization: "Scrum Alliance",
    organization_url: "https://www.scrumalliance.org",
    cpe_required: 20,
    cpe_cycle_length: 24,
    annual_minimum_cpe: null,
  },
  {
    name: "CSPO",
    organization: "Scrum Alliance",
    organization_url: "https://www.scrumalliance.org",
    cpe_required: 20,
    cpe_cycle_length: 24,
    annual_minimum_cpe: null,
  },
  {
    name: "CSP",
    organization: "Scrum Alliance",
    organization_url: "https://www.scrumalliance.org",
    cpe_required: 40,
    cpe_cycle_length: 24,
    annual_minimum_cpe: null,
  },
  // CompTIA
  {
    name: "Security+",
    organization: "CompTIA",
    organization_url: "https://www.comptia.org",
    cpe_required: 50,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "CySA+",
    organization: "CompTIA",
    organization_url: "https://www.comptia.org",
    cpe_required: 60,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "CASP+",
    organization: "CompTIA",
    organization_url: "https://www.comptia.org",
    cpe_required: 75,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "PenTest+",
    organization: "CompTIA",
    organization_url: "https://www.comptia.org",
    cpe_required: 60,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "Network+",
    organization: "CompTIA",
    organization_url: "https://www.comptia.org",
    cpe_required: 30,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "Cloud+",
    organization: "CompTIA",
    organization_url: "https://www.comptia.org",
    cpe_required: 60,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "A+",
    organization: "CompTIA",
    organization_url: "https://www.comptia.org",
    cpe_required: 20,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  // EC-Council
  {
    name: "CEH",
    organization: "EC-Council",
    organization_url: "https://www.eccouncil.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "CHFI",
    organization: "EC-Council",
    organization_url: "https://www.eccouncil.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "CPENT",
    organization: "EC-Council",
    organization_url: "https://www.eccouncil.org",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  // GIAC
  {
    name: "GSEC",
    organization: "GIAC",
    organization_url: "https://www.giac.org",
    cpe_required: 36,
    cpe_cycle_length: 48,
    annual_minimum_cpe: null,
  },
  {
    name: "GPEN",
    organization: "GIAC",
    organization_url: "https://www.giac.org",
    cpe_required: 36,
    cpe_cycle_length: 48,
    annual_minimum_cpe: null,
  },
  {
    name: "GCIH",
    organization: "GIAC",
    organization_url: "https://www.giac.org",
    cpe_required: 36,
    cpe_cycle_length: 48,
    annual_minimum_cpe: null,
  },
  {
    name: "GWAPT",
    organization: "GIAC",
    organization_url: "https://www.giac.org",
    cpe_required: 36,
    cpe_cycle_length: 48,
    annual_minimum_cpe: null,
  },
  {
    name: "GCIA",
    organization: "GIAC",
    organization_url: "https://www.giac.org",
    cpe_required: 36,
    cpe_cycle_length: 48,
    annual_minimum_cpe: null,
  },
  // Offensive Security
  {
    name: "OSCP",
    organization: "Offensive Security",
    organization_url: "https://www.offsec.com",
    cpe_required: 0,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "OSEP",
    organization: "Offensive Security",
    organization_url: "https://www.offsec.com",
    cpe_required: 0,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  // AWS
  {
    name: "AWS Certified Cloud Practitioner",
    organization: "Amazon Web Services",
    organization_url: "https://aws.amazon.com/certification",
    cpe_required: 0,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "AWS Certified Solutions Architect – Associate",
    organization: "Amazon Web Services",
    organization_url: "https://aws.amazon.com/certification",
    cpe_required: 0,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "AWS Certified Solutions Architect – Professional",
    organization: "Amazon Web Services",
    organization_url: "https://aws.amazon.com/certification",
    cpe_required: 0,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "AWS Certified Security – Specialty",
    organization: "Amazon Web Services",
    organization_url: "https://aws.amazon.com/certification",
    cpe_required: 0,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  // Microsoft
  {
    name: "Microsoft Certified: Azure Fundamentals (AZ-900)",
    organization: "Microsoft",
    organization_url: "https://learn.microsoft.com/en-us/credentials",
    cpe_required: 0,
    cpe_cycle_length: 0,
    annual_minimum_cpe: null,
  },
  {
    name: "Microsoft Certified: Azure Administrator Associate (AZ-104)",
    organization: "Microsoft",
    organization_url: "https://learn.microsoft.com/en-us/credentials",
    cpe_required: 0,
    cpe_cycle_length: 24,
    annual_minimum_cpe: null,
  },
  {
    name: "Microsoft Certified: Security Operations Analyst Associate (SC-200)",
    organization: "Microsoft",
    organization_url: "https://learn.microsoft.com/en-us/credentials",
    cpe_required: 0,
    cpe_cycle_length: 24,
    annual_minimum_cpe: null,
  },
  // Cisco
  {
    name: "CCNA",
    organization: "Cisco",
    organization_url: "https://www.cisco.com/c/en/us/training-events/training-certifications",
    cpe_required: 30,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "CCNP Security",
    organization: "Cisco",
    organization_url: "https://www.cisco.com/c/en/us/training-events/training-certifications",
    cpe_required: 80,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
  {
    name: "CCIE Security",
    organization: "Cisco",
    organization_url: "https://www.cisco.com/c/en/us/training-events/training-certifications",
    cpe_required: 120,
    cpe_cycle_length: 36,
    annual_minimum_cpe: null,
  },
];

export function searchCertTemplates(query: string): CertTemplate[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return CERT_TEMPLATES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.organization.toLowerCase().includes(q)
  ).slice(0, 8);
}
