# SpendWise

A modern student expense tracker with personal budgeting, shared expense splitting, and an AI Money Coach.

## Features

- Personal income and expense tracking
- Monthly budgets with usage warnings
- Running balance
- Category breakdown and Chart.js donut chart
- Shared ledgers for roommates and trips
- Equal, exact, and percentage expense splitting
- Automatic balances and debt simplification
- AI Money Coach with server-side API key protection
- Responsive modern fintech/SaaS interface
- Light and dark themes
- Data persistence through browser localStorage

## Tech stack

- HTML
- CSS
- Vanilla JavaScript
- Chart.js via CDN
- Node.js + Express
- OpenAI API for the AI Money Coach

## Run locally

```bash
npm install
cp .env.example .env
```

Add your OpenAI API key to `.env`:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
PORT=3000
```

Then:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Project structure

```text
spendwise/
├── index.html
├── style.css
├── app.js
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

## Important

Never commit `.env` or `node_modules/` to GitHub.

The AI Money Coach is educational guidance and does not provide regulated financial advice or guarantee investment returns.

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


## Real AI Money Coach (Phase 2)

The AI chat uses a small Express backend so the OpenAI API key is never exposed in browser JavaScript. The browser sends the user's current-month SpendWise snapshot and recent chat history to `/api/ai-coach`; the server calls the OpenAI Responses API and returns the assistant's answer.

### Run it

```bash
npm install
cp .env.example .env
# Put your OpenAI API key in .env
npm start
```

Then open `http://localhost:3000`. Do not put the API key directly in `app.js` or `index.html`, and do not commit `.env` to Git.

The current implementation uses `gpt-5.6-luna` by default; change `OPENAI_MODEL` in `.env` if needed.
