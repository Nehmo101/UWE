/**
 * Slug utilities for the database package.
 *
 * The implementations now live in `@uwe/shared-utils` so other packages (auth,
 * knoteforge-import, agent-jobs) can share them without depending on
 * `@uwe/database`. This module re-exports them to keep the existing
 * `./slug-utils` and `@uwe/database/server` import paths stable.
 */

export {
  slugifyDe,
  slugifyAscii,
  slugifyKey,
  pickUniqueSlug,
  normalizeLookupKey,
  type SlugifyOptions,
} from "@uwe/shared-utils";
