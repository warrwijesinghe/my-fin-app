# FIN Control

Private personal and business financial-control system for `fin.aplusict.lk`.

## Product rules

- No financial sample data or seeded accounts.
- Accounts, opening balances, projects, tasks, categories, goals, and transactions are created through the application.
- Balance changes are transaction-driven; opening balances are stored as opening transactions.
- A record without a payment account stays in Review and does not affect account balances.
- Transfers update accounts without being counted as income or expense.
- Transactions have independent actual (`scope`) and tax (`taxScope`) Business/Personal labels. Dashboards, analytics and ordinary income statements use the actual label.
- Income tax reports at `/reports/tax` use only the tax label for classification, with inclusive date filters, category totals, transaction detail and CSV downloads. Existing posted income/expense tax labels can be changed there, with an audit record, without changing actual labels or account entries.
- Tax reports include posted income, expenses and pay-later bills when recorded; they exclude transfers, debt payments, opening balances, adjustments, pending and void records. They do not calculate tax or determine deductibility.
- The tax-label migration copies each existing actual label into its tax label. New income/expense records save the selected tax label, defaulting to actual when omitted. A null tax label on legacy/imported records falls back to actual; it is never treated as automatically Personal.

## Household and item tracking

- Create **Wife Cash** in Master Data → Accounts, with owner **Wife**. The form uses Personal/Cash and does not require an opening balance or income. Ownership is fixed at creation to avoid silently reassigning financial history. Wife accounts are spending logs: they do not hold ledger balances or accept income/transfers.
- Household → **Add my expense / Add wife's expense** opens item entry with Household selected. Your household expenses still count in your own expenses. Wife transactions and balances are excluded from your dashboard, analytics, account portfolio and tax reports.
- Expense entry starts with item lines. Pick an expense category and an existing item, or type a new name to create it atomically with the transaction. Quantity is optional; if supplied it needs a unit. The sum of line amounts becomes the transaction total. Removing all item lines retains the legacy amount-only entry option.
- Income and expense categories have separate lists. The migration marks income-only categories as Income. Categories used for both retain their expense ID and receive a separate income copy, updating historical income references. Unused existing categories remain Expense until reviewed. Used categories cannot switch type; deactivate unused records instead of deleting history.
- Item Master supports name, category, default unit and active status. Existing line categories, units, quantities and amounts are preserved when defaults change. Matching trims spaces and ignores case within a category. Items referenced by history remain stored.
- Household reports show paid expenses, payer shares, six-month trends, category increases, item quantities and weighted unit costs. Pending, void, transfers and debt payments are excluded. Grams normalize to kg and ml to litres; packs and each stay separate. Missing quantities contribute spending but not unit costs or quantity estimates.
- Select next month in Household to see its shopping estimate from the preceding three full calendar months. Zero-purchase months are included. Stock-on-hand adjustments are temporary page state; export the shopping CSV to keep the adjusted list. These are purchase estimates, not inventory or consumption measurements.
- Optional overall and category budgets are saved per month. Budgets always use the full selected month and both payers; the transaction filters do not alter their spending totals. Outstanding pay-later bills are shown separately across all dates and excluded from paid-spending and purchase-quantity totals.
- Use **Manage household labels** to include or exclude older expenses, with an audit record. All existing transactions default to owner Me and Household off; actual and tax labels are preserved.

### Validation and rollout

Run `npm run lint`, `npm run build`, and the scripts `test-household.cjs`, `test-tax-reports.cjs`, `test-analytics.cjs`, `test-account-center.cjs`, and `test-redirects.cjs` under `scripts` with Node. Route checks use mocked database connections; they never seed the application database.

Back up the database before `npm run db:migrate`. Both the tax-label migration and household/item migration must be applied before serving this version. The migration adds the `IncomeExpenseActivity` view so category reports use item-line amounts without also summing the parent transaction amount. Build and restart through the normal deployment process afterward.

## Local setup commands

1. Copy `.env.example` to `.env` and enter the real database URL and app secrets.
2. `npm install`
3. `npm run db:migrate`
4. `npm run dev`

## Production deployment

Use one Node.js process behind Nginx. Keep `.env` only on the server, run `npm ci`, `npm run db:migrate`, then `npm run build`. Run the app through a systemd service bound to `127.0.0.1`; Nginx serves `fin.aplusict.lk` with HTTPS and proxies requests to that local service.

Do not run database migrations without taking a database backup first.
