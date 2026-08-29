# SpendWise

A student expense tracker designed like a bank passbook — every entry gets a ruled line, a debit or credit column, and a running balance, just like the passbook your parents probably still keep in a drawer.

![status](https://img.shields.io/badge/phase-1%20%2F%206-blue) ![stack](https://img.shields.io/badge/stack-HTML%20%2F%20CSS%20%2F%20JS-informational)

## Why a passbook?

Most expense trackers are generic dashboards — cards, gradients, a big number up top. A passbook is a format Indian students already know how to read: date, particulars, debit, credit, balance. Reusing that mental model makes the numbers easier to trust at a glance, and it gives the project a point of view instead of looking like every other tutorial finance app.

## Features (Phase 1)

**My Passbook — personal tracker**
- Log **income** (deposits) and **expenses** (withdrawals) with amount, category, note, and date
- Categorize expenses: Food, Travel, Shopping, Education, Entertainment, Other
- Running balance calculated line-by-line, exactly like a real passbook — the balance on any row never changes even if you filter the view
- Set a **monthly budget** and see a usage bar (with a warning state past 80%, and an over-budget state)
- Filter the ledger by category
- Category breakdown as a donut chart (Chart.js) plus a ranked list with mini bars

**Shared Ledgers — Splitwise-style group splitting**
- Create groups (roommates, a trip, anything) with any number of members
- Add a shared expense, choose who paid, and split it **equally**, by **exact amounts**, or by **percentage**
- Pick "You are: ⁠___" to see your own share of every expense at a glance
- Automatic **balance calculation** per member — who's owed money, who owes it
- **Debt simplification** — instead of listing every pairwise IOU, it works out the minimum number of payments needed to settle the whole group (same idea Splitwise uses under the hood)

Both live in the same app — a tab switcher under the cover flips between "My Passbook" and "Shared Ledgers." Everything persists in `localStorage`, in two separate keysets, so they never interfere with each other.

## Tech stack

- HTML, CSS, vanilla JavaScript (no build step, no framework)
- [Chart.js](https://www.chartjs.org/) via CDN for the category donut chart
- Fonts: Spectral (display), Inter (body), IBM Plex Mono (all figures — for column alignment)

## Running it locally

No install needed — it's a static site.

```bash
git clone https://github.com/<your-username>/spendwise.git
cd spendwise
open index.html        # macOS
# or just double-click index.html in your file explorer
```

For live-reload while editing, you can optionally serve it:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Project structure

```
spendwise/
├── index.html    # markup
├── style.css     # passbook-style visual design
├── app.js        # state, storage, rendering, chart
└── README.md
```

## Data model (for Phase 2)

```
Transaction    { id, type: "income"|"expense", amount, category, note, date }
Budget         { monthKey: "YYYY-MM" -> amount }

Group          { id, name, members: [string] }
GroupExpense   { id, groupId, description, amount, paidBy, date,
                 splitType: "equal"|"exact"|"percentage",
                 shares: { memberName: amount } }
```

This is deliberately close to what SQL tables will look like once there's a real backend — `groups`, `group_members`, `group_expenses`, `expense_shares` — porting the client-only version to an API in Phase 2 should mostly mean swapping `localStorage.getItem/setItem` for `fetch()` calls.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 1 | Client-only tracker (this repo) | ✅ done |
| 2 | Express + SQLite API, move storage server-side | planned |
| 3 | Auth (JWT), multi-user support | planned |
| 4 | Analytics dashboard — trends, weekday vs. weekend spend | planned |
| 5 | Stat-based insights — unusual expense flags, budget-overrun projection | planned |
| 6 | Savings goals + UI polish | planned |
| 7 | Deploy + write-up | planned |

## License

MIT — do whatever you like with it.
