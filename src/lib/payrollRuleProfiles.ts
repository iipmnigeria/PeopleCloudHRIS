export type TaxBand = {
  limit: number;
  rate: number;
};

export type PayrollRuleProfile = {
  countryCode: string;
  country: string;
  region: string;
  currency: string;
  taxLabel: string;
  employeeSocialRate: number;
  employerSocialRate: number;
  healthHousingRate: number;
  reliefRate: number;
  fixedAnnualRelief: number;
  taxBands: TaxBand[];
  complianceRules: string[];
};

export const defaultPayrollRuleProfiles: PayrollRuleProfile[] = [
  { countryCode: 'NG', country: 'Nigeria', region: 'Africa', currency: 'NGN', taxLabel: 'PAYE', employeeSocialRate: 0.08, employerSocialRate: 0.1, healthHousingRate: 0.025, reliefRate: 0.2, fixedAnnualRelief: 200000, complianceRules: ['PAYE', 'Pension', 'NHF', 'NHIS/NHIA', 'NSITF', 'ITF'], taxBands: [{ limit: 300000, rate: 0.07 }, { limit: 300000, rate: 0.11 }, { limit: 500000, rate: 0.15 }, { limit: 500000, rate: 0.19 }, { limit: 1600000, rate: 0.21 }, { limit: 0, rate: 0.24 }] },
  { countryCode: 'GH', country: 'Ghana', region: 'Africa', currency: 'GHS', taxLabel: 'PAYE', employeeSocialRate: 0.055, employerSocialRate: 0.13, healthHousingRate: 0, reliefRate: 0, fixedAnnualRelief: 0, complianceRules: ['PAYE', 'SSNIT', 'Tier 2 Pension', 'Tier 3 Pension'], taxBands: [{ limit: 490, rate: 0 }, { limit: 110, rate: 0.05 }, { limit: 130, rate: 0.1 }, { limit: 3166, rate: 0.175 }, { limit: 16000, rate: 0.25 }, { limit: 0, rate: 0.3 }] },
  { countryCode: 'KE', country: 'Kenya', region: 'Africa', currency: 'KES', taxLabel: 'PAYE', employeeSocialRate: 0.06, employerSocialRate: 0.06, healthHousingRate: 0.015, reliefRate: 0, fixedAnnualRelief: 0, complianceRules: ['PAYE', 'NSSF', 'SHIF/NHIF', 'Housing Levy'], taxBands: [{ limit: 24000, rate: 0.1 }, { limit: 8333, rate: 0.25 }, { limit: 467667, rate: 0.3 }, { limit: 300000, rate: 0.325 }, { limit: 0, rate: 0.35 }] },
  { countryCode: 'ZA', country: 'South Africa', region: 'Africa', currency: 'ZAR', taxLabel: 'PAYE', employeeSocialRate: 0.01, employerSocialRate: 0.01, healthHousingRate: 0.01, reliefRate: 0, fixedAnnualRelief: 0, complianceRules: ['PAYE', 'UIF', 'SDL', 'COIDA'], taxBands: [{ limit: 237100, rate: 0.18 }, { limit: 133400, rate: 0.26 }, { limit: 142800, rate: 0.31 }, { limit: 160800, rate: 0.36 }, { limit: 183000, rate: 0.39 }, { limit: 960000, rate: 0.41 }, { limit: 0, rate: 0.45 }] },
  { countryCode: 'UK', country: 'United Kingdom', region: 'Europe', currency: 'GBP', taxLabel: 'PAYE', employeeSocialRate: 0.08, employerSocialRate: 0.138, healthHousingRate: 0, reliefRate: 0, fixedAnnualRelief: 0, complianceRules: ['PAYE', 'National Insurance', 'Pension Auto-Enrolment'], taxBands: [{ limit: 12570, rate: 0 }, { limit: 37700, rate: 0.2 }, { limit: 87440, rate: 0.4 }, { limit: 0, rate: 0.45 }] },
  { countryCode: 'US', country: 'United States', region: 'North America', currency: 'USD', taxLabel: 'Federal/State Tax', employeeSocialRate: 0.0765, employerSocialRate: 0.0765, healthHousingRate: 0, reliefRate: 0, fixedAnnualRelief: 0, complianceRules: ['Federal Tax', 'State Tax', 'Social Security', 'Medicare'], taxBands: [{ limit: 11600, rate: 0.1 }, { limit: 35550, rate: 0.12 }, { limit: 53375, rate: 0.22 }, { limit: 100525, rate: 0.24 }, { limit: 91425, rate: 0.32 }, { limit: 365625, rate: 0.35 }, { limit: 0, rate: 0.37 }] },
  { countryCode: 'AE', country: 'United Arab Emirates', region: 'Middle East', currency: 'AED', taxLabel: 'Income Tax', employeeSocialRate: 0, employerSocialRate: 0, healthHousingRate: 0, reliefRate: 0, fixedAnnualRelief: 0, complianceRules: ['WPS', 'End-of-Service Gratuity', 'Health Insurance'], taxBands: [{ limit: 0, rate: 0 }] },
  { countryCode: 'GLOBAL', country: 'Generic Global', region: 'Global', currency: 'USD', taxLabel: 'Income Tax', employeeSocialRate: 0, employerSocialRate: 0, healthHousingRate: 0, reliefRate: 0, fixedAnnualRelief: 0, complianceRules: ['Custom Tax', 'Custom Social Security', 'Custom Pension', 'Custom Health Insurance'], taxBands: [{ limit: 0, rate: 0.1 }] },
];

export function getDefaultRuleProfile(countryCode: string) {
  return defaultPayrollRuleProfiles.find((profile) => profile.countryCode === countryCode) || defaultPayrollRuleProfiles[0];
}

export function calculateProgressiveTax(monthlyGross: number, profile: PayrollRuleProfile) {
  const annualGross = monthlyGross * 12;
  const relief = annualGross * Number(profile.reliefRate || 0) + Number(profile.fixedAnnualRelief || 0);
  let taxable = Math.max(0, annualGross - relief);
  let tax = 0;
  for (const band of profile.taxBands) {
    const bandLimit = Number(band.limit || 0) <= 0 ? taxable : Number(band.limit || 0);
    const amount = Math.min(taxable, bandLimit);
    if (amount <= 0) break;
    tax += amount * Number(band.rate || 0);
    taxable -= amount;
  }
  return Math.round(tax / 12);
}
