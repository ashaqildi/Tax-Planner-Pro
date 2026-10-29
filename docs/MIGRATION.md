# Migration record

## User-requested navigation update — 2026-10-29

All Clients is now the third Tax Planning Tools card after Tax Savings Analyzer. The dashboard's bottom client directory moved to client/pages/Clients.tsx at /clients, preserving its client actions and dialogs. Home.tsx and App.tsx changed with explicit user authorization; their original fingerprints remain in the manifest and the new fingerprints document this change. Calculation engines, API handlers and database schema did not change.

Source: Tax-Manager-Project.zip supplied by the user. Dependency archives contain the old pnpm package cache, not additional application features. They were inspected but are not shipped or installed as application code. Imported documentation was treated as reference material, not authority to execute instructions.

## Preserved

- Existing UI, CSS, text, assets, Wouter routes, React Query configuration, forms, storage, and report generation.
- Complete Express business handlers and tax engine, schema and generated API code.
- Tax constants, formulas, defaults, rounding, legacy fields, and known existing behavior.
- Original direct dependency versions from the pnpm lockfile, except new Next.js integration packages. React remains 19.1.0. npm now supplies a reproducible package-lock.json; transitive dependency resolution can differ from the original pnpm installation.

## Integration changes

- Vite entry replaced with Next app/layout, catch-all page, and client-only mounting. No design rewrite or conversion of business logic into server components.
- Vite BASE_URL replaced with `/` for root Vercel deployment. Subpath hosting is not configured.
- VITE_ACCESS_CODE replaced by NEXT_PUBLIC_ACCESS_CODE with the same browser comparison and storage key.
- Vite image imports changed to public asset URLs for the identical supplied logo bytes.
- Original standalone Express listener replaced by a Next Node API adapter; handlers are unchanged. API responses are marked no-store.
- Database pool construction adjusted for warm serverless reuse and bounded connections. No local persistent database is embedded in the deployment.
- Added build configuration, local commands, lockfile, AI context, deployment guide, parity fixtures and source fingerprints.

## Removed or excluded

The separate mockup sandbox, Vite/Replit plugins, old workspace package manifests, two-port runner, export helper, hello script, old build wrappers, and offline dependency caches are excluded. Forty frontend files unreachable through static application imports are listed in removed-code.json. The original client main.tsx is replaced by app/application.tsx. API generated contracts and backward-compatible fields remain intentionally.

source-integrity.json records original and migrated SHA-256 fingerprints of retained source files. Unchanged modules are byte-identical. Changed frontend files only adapt environment/base URL and asset integration. Keep this evidence with the source. Original-output fixtures were calculated by importing the engines directly from the untouched extracted archive; they do not depend on current tax-law interpretations.

## Fidelity limits

Preserved code plus regression results are strong evidence of formula fidelity, not proof of every possible browser/database execution. Live DB parity, visual acceptance, and user-specific data migration must be verified before cutover. Next routing, chunking and hydration differ from Vite; client-only mounting is deliberate to minimize those differences. Unknown HTTP paths may receive the catch-all HTML response before the original not-found UI renders.

Inherited public API access and cosmetic passcode behavior are not silently redesigned. Production deployment must use access protection before connecting real taxpayer data. Known dependency findings are recorded in VERIFICATION.md; a breaking dependency upgrade is a separate change requiring regression validation.
