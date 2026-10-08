/**
 * What money buys in each country, against what a dollar buys in the United
 * States: the World Bank's purchasing power parity conversion factor (GDP,
 * local currency per international dollar, indicator PA.NUS.PPP) divided by
 * the official exchange rate (local currency per US dollar, indicator
 * PA.NUS.FCRF), both for 2024, rounded to two places. 0.24 means a price
 * level about a quarter of the US one.
 *
 * Read on 8 October 2026: the conversion factors from the World Bank series
 * as published in github.com/datasets/ppp (data/ppp-gdp.csv), and the
 * exchange rates from api.worldbank.org. A country missing either number for
 * 2024 is not here, and so is never given a lower price.
 *
 * Generated; the rules that turn these into a percentage off are in
 * lib/fair-price.ts.
 */
export const PRICE_LEVELS: Readonly<Record<string, number>> = {
  AD: 0.66, AE: 0.63, AG: 0.71, AL: 0.43, AM: 0.37, AO: 0.31, AR: 0.46, AT: 0.77,
  AU: 0.9, AW: 0.78, AZ: 0.29, BA: 0.37, BB: 1.07, BD: 0.26, BE: 0.76, BF: 0.34,
  BG: 0.42, BH: 0.44, BI: 0.3, BJ: 0.33, BM: 1.15, BN: 0.37, BO: 0.34, BR: 0.46,
  BS: 0.96, BW: 0.37, BY: 0.25, CA: 0.84, CF: 0.41, CG: 0.35, CH: 1.08, CI: 0.36,
  CM: 0.33, CN: 0.49, CO: 0.35, CR: 0.6, CV: 0.46, CW: 0.7, CY: 0.61, CZ: 0.55,
  DE: 0.76, DJ: 0.45, DK: 0.88, DM: 0.49, DO: 0.39, DZ: 0.33, EC: 0.43, EE: 0.62,
  EG: 0.14, ES: 0.61, ET: 0.33, FI: 0.82, FJ: 0.42, FM: 0.96, FO: 0.9, FR: 0.74,
  GA: 0.38, GB: 0.85, GD: 0.58, GE: 0.33, GH: 0.3, GM: 0.25, GQ: 0.38, GR: 0.56,
  GT: 0.43, GW: 0.32, GY: 0.37, HN: 0.46, HR: 0.49, HT: 0.67, HU: 0.48, ID: 0.3,
  IE: 0.8, IL: 0.95, IN: 0.24, IQ: 0.42, IS: 1.03, IT: 0.65, JM: 0.6, JO: 0.43,
  JP: 0.62, KE: 0.32, KG: 0.3, KH: 0.33, KI: 0.62, KM: 0.42, KN: 0.69, KR: 0.59,
  KW: 0.62, KZ: 0.35, LA: 0.22, LC: 0.51, LR: 0, LS: 0.32, LT: 0.53, LU: 0.88,
  LV: 0.54, LY: 0.46, MA: 0.4, MD: 0.41, ME: 0.39, MG: 0.29, MH: 0.94, MK: 0.34,
  ML: 0.33, MN: 0.35, MO: 0.57, MT: 0.63, MU: 0.38, MV: 0.51, MX: 0.54, MY: 0.31,
  MZ: 0.39, NA: 0.38, NE: 0.36, NG: 0.12, NI: 0.33, NL: 0.79, NO: 0.85, NP: 0.25,
  NR: 0.97, NZ: 0.89, OM: 0.49, PA: 0.46, PE: 0.47, PG: 0.62, PH: 0.34, PK: 0.24,
  PL: 0.49, PR: 0.78, PT: 0.56, PY: 0.35, QA: 0.61, RO: 0.41, RS: 0.42, RU: 0.31,
  RW: 0.27, SA: 0.49, SB: 0.72, SC: 0.54, SE: 0.8, SG: 0.6, SI: 0.6, SN: 0.35,
  SR: 0.32, ST: 0.56, SV: 0.42, SX: 0.77, SZ: 0.33, TC: 0.99, TD: 0.35, TG: 0.33,
  TH: 0.3, TJ: 0.25, TL: 0.3, TN: 0.29, TR: 0.35, TT: 0.52, TV: 1.04, TZ: 0.28,
  UA: 0.29, UG: 0.33, US: 1, UY: 0.66, UZ: 0.27, VC: 0.54, VN: 0.29, VU: 0.95,
  WS: 0.62, XK: 0.39, ZA: 0.41, ZM: 0.28, ZW: 0,
};
