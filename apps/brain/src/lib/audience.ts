import { APP_AUDIENCE, getDomainAccess, type DataDomain } from "@uwe/product-contracts";

/** This app's product audience (the canonical value from @uwe/product-contracts). */
export const BRAIN_AUDIENCE = APP_AUDIENCE.brain;

/**
 * Whether the Brain audience may touch a given data domain, per the shared
 * access matrix (deny-by-default). Brain may only reach `personal_brain` and
 * `admin_life`; everything else — D&D, portal, assets — resolves to `none`.
 */
export function brainCanAccess(domain: DataDomain): boolean {
  return getDomainAccess(BRAIN_AUDIENCE, domain) !== "none";
}
