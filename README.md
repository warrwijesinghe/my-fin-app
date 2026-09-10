# FIN Control

Private personal and business financial-control system for `fin.aplusict.lk`.

## Product rules

- No financial sample data. The family-login migration creates only the two requested shared cash accounts, both starting at zero.
- Accounts, opening balances, projects, tasks, categories, goals, and transactions are created through the application.
- Balance changes are transaction-driven; opening balances are stored as opening transactions.
- Dashboard Expense / Income quick entries need only amount and description. They are saved to Review without ledger entries; regular Transactions require complete posting details.
- Transfers update accounts without being counted as income or expense.
- Transactions have independent actual (`scope`) and tax (`taxScope`) Business/Personal labels. Dashboards, analytics and ordinary income statements use the actual label.
- Income tax reports at `/reports/tax` use only the tax label for classification, with inclusive date filters, category totals, transaction detail and CSV downloads. Existing posted income/expense tax labels can be changed there, with an audit record, without changing actual labels or account entries.
- Tax reports include posted income, expenses and pay-later bills when recorded; they exclude transfers, debt payments, opening balances, adjustments, pending and void records. They do not calculate tax or determine deductibility.
- The tax-label migration copies each existing actual label into its tax label. New income/expense records save the selected tax label, defaulting to actual when omitted. A null tax label on legacy/imported records falls back to actual; it is never treated as automatically Personal.

## Household and item tracking

- Each login creates its own cash, bank, savings, card and loan accounts in Master Data. Both owners have full ledger balances. Shared cash accounts are managed under **Shared cash**.
- Household combines both people’s marked household expenses. Each expense records the owner of the money separately from the person who spent it. Each personal dashboard and report includes only the signed-in owner’s finances.
- Expense entry starts with item lines. Pick an expense category and an existing item, or type a new name to create it atomically with the transaction. Quantity is optional; if supplied it needs a unit. The sum of line amounts becomes the transaction total. Removing all item lines retains the legacy amount-only entry option.
- Income and expense categories have separate lists. The migration marks income-only categories as Income. Categories used for both retain their expense ID and receive a separate income copy, updating historical income references. Unused existing categories remain Expense until reviewed. Used categories cannot switch type; deactivate unused records instead of deleting history.
- Item Master supports name, category, default unit and active status. Existing line categories, units, quantities and amounts are preserved when defaults change. Matching trims spaces and ignores case within a category. Items referenced by history remain stored.
- Household reports show paid expenses, payer shares, six-month trends, category increases, item quantities and weighted unit costs. Pending, void, transfers and debt payments are excluded. Grams normalize to kg and ml to litres; packs and each stay separate. Missing quantities contribute spending but not unit costs or quantity estimates.
- Select next month in Household to see its shopping estimate from the preceding three full calendar months. Zero-purchase months are included. Stock-on-hand adjustments are temporary page state; export the shopping CSV to keep the adjusted list. These are purchase estimates, not inventory or consumption measurements.
- Optional overall and category budgets are saved per month. Budgets always use the full selected month and both payers; the transaction filters do not alter their spending totals. Outstanding pay-later bills are shown separately across all dates and excluded from paid-spending and purchase-quantity totals.
- Use **Manage household labels** to include or exclude older expenses, with an audit record. All existing transactions default to owner Me and Household off; actual and tax labels are preserved.

### Validation and rollout

Run `npm run lint`, `npm test`, and `npm run build`. The test suite includes `test-drafts-parties.cjs` plus the scripts `test-household.cjs`, `test-tax-reports.cjs`, `test-analytics.cjs`, `test-account-center.cjs`, and `test-redirects.cjs` under `scripts` with Node. Route checks use mocked database connections; they never seed the application database.

Back up the database before `npm run db:migrate`. Both the tax-label migration and household/item migration must be applied before serving this version. The migration adds the `IncomeExpenseActivity` view so category reports use item-line amounts without also summing the parent transaction amount. Build and restart through the normal deployment process afterward.

## Local setup commands

1. Copy `.env.example` to `.env` and enter the real database URL and app secrets.
2. `npm install`
3. `npm run db:migrate`
4. `npm run dev`

## Production deployment

Use one Node.js process behind Nginx. Keep `.env` only on the server, run `npm ci`, `npm run db:migrate`, then `npm run build`. Run the app through a systemd service bound to `127.0.0.1`; Nginx serves `fin.aplusict.lk` with HTTPS and proxies requests to that local service.

Do not run database migrations without taking a database backup first.

## Transactions, quick capture, and customer/supplier ledgers

- The former Quick entry screen is now **Transactions**. Business project is optional: choose **General business / no project** for electricity, cleaning, and other overhead. Projects remain available for project-specific activity.
- Dashboard **Expense** and **Income** buttons capture amount and description only. The date defaults to today in Asia/Colombo. Draft classification defaults can be changed during review. Pending drafts never enter account or customer/supplier balances, analytics, or tax reports.
- In **Review**, open one draft, add account, labels, customer/supplier, category, and optional items. **Save progress in Review** supports partial itemization and does not post. Each saved item needs a name, category, and amount; quantity is optional and requires a unit when supplied. The original bill amount is preserved. If items are present, their sum must equal that amount before **Post reviewed transaction** becomes available. Posting locks the draft so duplicate confirmations cannot create duplicate entries.
- Example: capture LKR 12,000 / Food City bill. Save sugar 2 kg / LKR 500 and tea 200 g / LKR 750 in Review; LKR 10,750 remains to itemize. Add the remaining lines, select the account and post. You can also post an amount-only record by removing all item lines.
- **Master data → Customers & suppliers** stores name, type, contact number, cash-only status, and active status. Records can be edited/deactivated; their type and cash-only status are fixed after use. No customer/supplier records are seeded. Create Cash Supplier and Cash Customer yourself if wanted, with the generic cash checkbox selected. Specific cash-party names can go in the transaction description. Existing free-text counterparties remain intact; no historical identity is guessed or automatically linked.
- In Transactions or Review, choose **On credit — settle later** and a named, non-cash customer/supplier. Credit expenses record a pay-later bill; credit income records income and a receivable. Neither moves cash when posted. Supplier payables and customer receivables remain separated by owner. Cash transactions can select a master record but do not create outstanding credit.
- Open **View ledger** on a master record to see posted transactions, running credit balance, and outstanding bills/sales. Record partial or full payments against a specific invoice using a cash, bank, or savings account belonging to the same owner. Settlements update cash and outstanding balances without counting income/expense again. Repeated submission of the same settlement form is idempotent. Both owners’ settlements update their account balances.
- Dashboard financial position and Analytics net worth include outstanding customer receivables. Supplier obligations continue through the existing unpaid-bills total, avoiding double counting. Household paid-item reports retain their existing paid-expense basis; bill settlements are shown in the party/account ledger and update the Household outstanding-bill figure, not paid-item purchase quantities.

### Rollout for this change

Back up the database, then apply the new `20260909000000_drafts_parties` migration with `npm run db:migrate` before starting this code. It adds Party, PartyEntry, CreditOutstanding, and transaction party/payment/due-date fields. It does not seed data or convert historical counterparties. Existing unlinked pay-later bills are preserved and are not automatically assigned to a supplier ledger. Build and restart afterward. The implementation was tested with mocked connections; applying migrations and verifying the live database are deployment steps.

## Business dashboard and mobile navigation

- **Business** (`/business`) uses posted transactions with actual Business scope and the signed-in owner. Tax classification does not change management profit. Personal, the other owner’s, pending, void, transfers, principal payments and customer/supplier settlements are excluded from profit. Credit income and pay-later expenses count when recorded; item amounts are counted once through IncomeExpenseActivity.
- Select a reporting month. The current month shows month-to-date results compared with the same days of the previous month (capped at its month end); historical months compare full months. Future months are rejected. Six-month trends include zero-activity months.
- Net profit = recorded income less every recorded expense. Classify expense categories under **Cost control** as direct costs, operating overhead, finance costs or tax expense. Categories start unclassified; gross and operating profit stay unavailable until the period's costs are classified. Classification affects Business reporting across all periods, not transactions or account balances. These are management results based on recorded expenses, with no automatic inventory costing, depreciation, interest or tax calculations.
- Project results subtract costs assigned to each project. General business / no project remains separate; shared overhead is not arbitrarily allocated to projects.
- Trading cash movement is shown separately using cash/bank/savings entries for Business income, expenses and party settlements. Unpaid sales, unpaid bills, card purchases, account transfers and card/loan principal payments are excluded from this trading cash measure.
- Monthly revenue/profit targets and an expense ceiling are optional; blank clears a target while zero remains a valid target. Targets use the full month and actual results use the selected reporting period. Cost classifications and targets are saved in AppSetting; no additional migration beyond the earlier draft/party migration is required.
- Customer/supplier balances show the latest recorded all-date Business position, independently of the month filter; overdue buckets use today's Colombo date. Unlinked legacy supplier bills remain visible. CSV exports contain selected-period profit, cost and project results.
- Mobile navigation keeps **Home, Transactions, Review, More**. More contains Accounts, Business, Household, Analytics, Master data, customer/supplier records and Reports. The full desktop navigation includes Business.
- Business calculation, settings, rendered page and mobile-navigation checks are included in `npm test` via `scripts/test-business.cjs`. Browser layout checks use generated test-data previews, never records inserted into the configured database.

## Paying pay-later bills

Open **Pay bills** from the dashboard liabilities card, **Pay-later bills** from Transactions or mobile More, or **Pay bill** beside a bill in Recent transactions, Household or Business. Select the bill, enter a partial/full amount, payment date and payment account, then **Record bill payment**. Paid bills remain available with payment history.

Both named-supplier bills and older bills without any supplier record can be paid. Existing paid amounts are preserved. Cash/bank/savings payments reduce those balances; credit-card payments increase card debt. Both owners’ payments update account balances. Payments reduce the existing payable and do not duplicate the original expense. Repeated submissions are idempotent, and invoice locks prevent concurrent overpayment.

Apply `20260910000000_bill_payments` after the earlier migrations, following the database-backup requirement. It adds the transaction-to-invoice payment link and backfills links for existing party settlements, so legacy bills can retain payment history without inventing a supplier. No remote migration or deployment was performed during implementation.

## Family logins and shared cash

- The login picker has **Ayya** (the existing password) and **JAD Buddhika · Sudu Manike**. Sessions are signed for one owner. Older shared sessions expire on rollout. The wife password is stored as a salted scrypt hash in `FIN_WIFE_PASSWORD_HASH`; set it interactively with `node scripts/set-wife-password.mjs` in the server checkout and restart. No real credential belongs in Git.
- Dashboard, business, analytics, reports, accounts, projects, drafts and settings are private to the signed-in owner. Database reads and transactional reads are scoped centrally in `src/lib/access.ts` and `src/lib/db.ts`; write routes must authorize existing targets through scoped reads before mutating them. Owner values supplied by forms cannot select a different login.
- Categories, items, tasks, customers and suppliers are shared and editable by both people. Customer/supplier transactions and balances stay private. Shared tasks hide private project associations from the partner, and only the task creator can change that association. Shared master records cannot be deleted or have their kind changed after either person uses them. Household and Shared cash deliberately use wider financial read scopes. Private bank details and projects are hidden from the partner. Shared household labels and budgets can be changed by either person.
- Your **Cash at Sudu Manike** is **Ayya Cash** in her login. Her **Cash at Ayya** is **Sudu Manike Cash** in yours. Each pair refers to one underlying account with one balance. Only its money owner can fund it, using Transfer from their own account. Both can record expenses against either shared cash account. Negative balances are allowed. Money held for the partner is excluded from your own assets.
- Expenses record `owner` (whose money), `spentBy` (who spent it), and `recordedBy` (who entered it). Household counts a purchase once. Transfers never count as income or expense.
- Both can edit the amount, date, description, spender and existing item amounts, or delete a shared entry. Edits keep both transfer legs consistent. Deleting a shared bill reverses linked payments as well. Posted records are voided with an audit event; stale editors are rejected using a revision number.
- Existing wife spending logs retain their history and zero ledger balances. Historical cash movements are not invented; add an appropriate opening adjustment separately if required.

### Rollout and verification

Back up the production database, set the wife password with the setup script, then apply `20260911000000_family_logins` through `npm run db:migrate`, build and restart together. The migration preserves existing owner assignments and creates the two requested zero-balance cash accounts. Do not serve the new code against the old schema. No production migration or deployment was performed during this implementation.

Run `npm run lint`, `npm test` and `npm run build`. `scripts/test-family.cjs` checks signed login identities and private/shared read boundaries. For real database integration, set `FAMILY_TEST_DATABASE_URL` to a disposable **local** MySQL/MariaDB database named `fin_family_test_*`, then run `npm run test:family-db`. The script refuses non-local hosts, never loads `.env`, creates a new schema, applies all migrations and tests isolation, two-way transfers, spending, negative balances, shared edits/deletes and stale submissions. Test records never enter the application database.
