# Application context

## Runtime

Next App Router serves a root layout and a catch-all page. A client boundary dynamically loads the existing app with SSR disabled, preserving browser-only initialization, Wouter navigation, React Query caching, dialogs, and storage. Deep links and refreshes all enter the same client router. UI pages stay under client/pages, outside Next's pages router.

`pages/api/[...path].ts` is a Node API adapter. It leaves body parsing to Express and forwards the original IncomingMessage/ServerResponse. `server/app.ts` mounts the original router at /api. Express 5 handles async route errors. Next sets no-store on API responses. No standalone listener, Vite server, proxy, or Replit runtime is required.

The pg pool is cached on globalThis for warm requests and development reloads, limited to three connections per runtime instance, with idle and connection timeouts. Multiple deployed instances can still multiply connections; use a provider pooled connection URL. This pool change does not alter SQL, schema, or numeric handling.

## User workflows and files

| Workflow | Main files | Persistence |
|---|---|---|
| Client list, search, creation | client/pages/Home.tsx; components/client/ClientFormDialog.tsx | PostgreSQL |
| Client details, income, payment tracking, summaries | client/pages/ClientDetail.tsx; components/client/* | PostgreSQL |
| S-Corp vs Schedule C | client/pages/SCorpCalculator.tsx; client/lib/scorpCalculations.ts | Screen state |
| Tax Savings Analyzer plans and drafts | client/pages/TaxSavingsAnalyzer/* | Browser localStorage |
| PDF reports | client/lib/generatePdf.ts; generateSCorpPdf.ts; analyzer/utils/pdfExport.ts | Browser downloads |
| API hooks and models | lib/api-client-react | Same-origin /api fetches with React Query |
| Runtime API schemas | lib/api-zod | Generated Zod exports |
| Schema | lib/db/schema; database/schema.sql | PostgreSQL |

Frontend routes: `/`, `/clients`, `/clients/:id`, `/s-corp-calculator`, `/tax-savings-analyzer`, `/tax-savings-analyzer/new`, and `/tax-savings-analyzer/:id`. Unknown UI paths show the original not-found component. The dashboard has three Tax Planning Tools cards; All Clients is third and opens the separate client directory. Client creation, listing and deletion on that page reuse the original directory behavior.

## Calculation boundaries

`server/lib/taxCalculator.ts` computes federal and Illinois individual estimates, S-Corp PTE and replacement taxes, entity breakdowns, QBI behavior, withholding, prior-year safe-harbor calculations, and quarterly amounts. Route handlers serialize numeric PostgreSQL values, map input arrays and legacy scalars into the engine, ensure payment rows, and update calculated amounts.

`client/lib/scorpCalculations.ts` independently implements the 2026 S-Corp/Schedule C comparison, payroll taxes, QBI phase-in and SSTB logic, insurance and retirement deductions, and Illinois amounts. Its output is shared by the screen and PDF.

Analyzer `utils/taxCalculations.ts` contains its existing 2025 tables and helpers; `strategyDefinitions.ts` contains strategy inputs and savings functions. `types/plan.ts` contains persistent plan types, defaults, auto-itemization and AGI helpers, and storage operations. Step components also compose calculations and totals. None of these were rewritten or tax-law-updated for the migration.

## Data model and behavior

PostgreSQL tables are clients, income_sources, and estimated_payments. Income records carry tax year, legacy numeric columns, W-2 and S-Corp JSONB arrays, withholding, deductions and notes. Payments carry quarter, payment type, entity name, amount due/paid, due and paid dates, confirmation number and notes. Foreign-key cascades and numeric precision are preserved.

Dynamic arrays and scalar fallbacks, null handling, entity name matching, and payment record creation are compatibility requirements. Client-detail GET requests can write payment records. Concurrent read/write races in the original ensure-payment flow have not been redesigned. No login accounts, tenant isolation, authorization, or server-side sessions are implemented in the supplied source.

Analyzer storage keys: `shaqildi_tax_plans` and `shaqildi_tax_plan_draft`. Display-gate session key: `shaqildi_access_granted`. Changing scheme, host, port, or browser profile changes the storage origin. Backups are local JSON downloads, not database backups. Reusing the current PostgreSQL URL leaves both old and migrated apps connected to the same live records.

## API

See openapi.yaml and server/routes/clients.ts. Routes include GET /api/healthz; GET/POST /api/clients; GET/PUT/DELETE /api/clients/:clientId; GET/POST income; GET payments; PUT payments/:paymentId; and GET tax-summary. Existing status codes, request body handling and serialization are retained. Generated schemas are not blanket request validation: many handlers directly consume req.body.
