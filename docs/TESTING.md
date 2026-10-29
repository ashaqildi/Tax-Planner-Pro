# Validation and acceptance

## Automated code checks

`npm test` verifies 375 frozen original-engine results and byte integrity for unchanged retained modules. Cases cover four estimated-payment filing statuses, three tax years, PTE toggles, empty and legacy income, multiple W-2/S-Corp arrays, per-entity PTE overrides, single/MFJ S-Corp comparisons, SSTB and material-participation combinations, income ranges, deductions and retirement caps, analyzer brackets, age boundaries, retirement plans, and each strategy's representative inputs. These tests establish compatibility with the supplied source, not independent tax-law correctness or exhaustive numeric proof.

`npm run typecheck` checks the full TypeScript project. `npm run build` checks the production frontend and API bundles. Build requires no database credentials.

Fixtures came from the untouched source archive. Do not regenerate expected results from migrated code. source-integrity.json documents the integration exceptions; hashes protect unchanged modules, including the engines, handlers, schema, strategy definitions and UI components.

## Local acceptance with a copied database

1. Set up .env.local and run npm run db:check. Confirm schema and row counts against the source. Keep original and test databases separate because GET client detail recalculates persisted payments.
2. Open localhost:3000, test wrong and correct cosmetic codes and refresh persistence. Compare the original and migrated screens at matching viewport sizes.
3. Compare client list/search, create/edit/delete, filing status, PTE toggle, tax year, W-2 additions/removals, S-Corp ownership and per-entity PTE, legacy scalar income, deductions/QBI, notes, and all quarterly due amounts. Record representative before/after JSON responses and displayed totals. Use disposable records for deletes.
4. Verify all payment types, multiple entity names, paid amount, paid date, notes, confirmation numbers, over/underpayments and year switching. Confirm income/payment decimal values survive save/reload unchanged. Exercise missing client and malformed request behavior against the original; document inherited bugs separately.
5. Compare S-Corp outputs with zero, moderate and high income, single/MFJ, SSTB toggles, participation toggles, salary limits, insurance and retirement deductions. Export its PDF and compare every reported amount and logo.
6. Export analyzer backup from the original origin, restore into localhost, compare saved plans and draft, create/edit/delete a disposable plan, review all four steps, custom strategies and totals, then verify backup restore. Back up the target first because restore replaces all plans. Compare PDF/CSV reports and browser downloads.
7. Directly load and refresh each deep route. Test navigation, narrow/mobile layout, dialogs, keyboard focus, network errors, missing assets, browser console errors and PDF logos.
8. Run a production build and npm start; repeat core workflows. Test on Vercel preview with a copied database, then verify production access protection and final-domain browser backup restore before cutover.

Without an external PostgreSQL URL and source data, live CRUD, data completeness, connection security and end-to-end financial persistence remain unverified. Do not mark those checks complete from UI or build success alone.
