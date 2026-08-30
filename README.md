# FIN Control

Private personal and business financial-control system for `fin.aplusict.lk`.

## Product rules

- No financial sample data or seeded accounts.
- Accounts, opening balances, projects, tasks, categories, goals, and transactions are created through the application.
- Balance changes are transaction-driven; opening balances are stored as opening transactions.
- A record without a payment account stays in Review and does not affect account balances.
- Transfers update accounts without being counted as income or expense.

## Local setup

1. Copy `.env.example` to `.env` and enter the real database URL and app secrets.
2. `npm install`
3. `npm run db:migrate`
4. `npm run dev`

## Production deployment

Use one Node.js process behind Nginx. Keep `.env` only on the server, run `npm ci`, `npm run db:migrate`, then `npm run build`. Run the app through a systemd service bound to `127.0.0.1`; Nginx serves `fin.aplusict.lk` with HTTPS and proxies requests to that local service.

Do not run database migrations without taking a database backup first.
