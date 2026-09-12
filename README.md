# Expatirement

**Retirement Simulator for Dual Currencies**

> **This project was vibe coded with Claude.** All of the code was written by Claude, Anthropic's
> AI model, from conversation. None of it was written by hand. Read it, and check the figures it
> gives you, with that in mind.

A Monte Carlo retirement planner for someone who lives and spends in one currency while holding
assets in another. The example configuration is a US citizen retiring in Japan with dollar and yen
accounts, but the page itself names no country: which two currencies and countries it plans for is
set in a config file.

It is one HTML page, a stylesheet and a handful of plain script files. There is no build step, no
server and nothing to install — open it from disk and it runs.

## What it does

- **Simulates thousands of market paths.** Returns for the two equity sleeves are drawn from
  correlated normal distributions, and the exchange rate follows a random walk with the volatility
  you set. The run is seeded, so the same inputs always give the same answer.
- **Models the plan year by year.** A taxable brokerage account and a retirement account in each
  currency; earned income until an age you choose; two public pensions, each picked from the
  claim-age options on your benefit statement; a mortgage until it is paid off; and a withdrawal
  order that draws on income, then taxable accounts, then retirement accounts.
- **Handles tax and inflation plainly.** Taxes are effective rates — capital gains on the gain
  portion of a sale, and separate rates for pensions, earned income and retirement-account
  withdrawals. Everything you enter is in today's money, and every figure shown is converted back
  to today's money.
- **Enforces compulsory distributions per currency.** A US Required Minimum Distribution from the
  IRS Uniform Lifetime Table, a Japanese defined-contribution payout that must begin by an age and
  run over a set number of years, or none.

The page shows:

- **Portfolio path** — percentile bands and the median over your horizon, with spending as a share
  of the portfolio on a second axis and a readout for any year you hover.
- **Monte Carlo** — the probability the plan stays funded to the end, an outcome table (what the
  paths that last are left with, and when the ones that fail run out), and a survival chart. The
  chart compares your plan with spending set lower and higher, or splits the same paths by how the
  early years went, to show how much of the outcome is luck.
- **Sensitivity** — the lowest the portfolio gets across a grid of return and exchange-rate
  assumptions, centred on your inputs.
- **Notes & assumptions** — what the model does and does not account for.

It is in English and Japanese, switched with a button in the header.

**All settings** opens a sheet with every input and an explanation beside each. Figures copied from
somewhere else — statutory rates, volatilities, benefit amounts — can carry their source and the
date they were checked, and the sheet says when one has gone stale. It also offers three
ready-written prompts for asking an AI to check the statutory figures, re-measure volatilities and
correlations, or survey published return assumptions; paste the reply back and apply the figures it
names. A pasted reply is run as JavaScript, so apply only a reply you have read.

## Getting started

The page reads its configuration from a `data` directory **beside** the repository, so your own
figures never sit inside a git checkout:

```txt
anywhere/
├── simulator/                  this repository
└── data/                       yours, never committed
    ├── retirement_setup.js
    └── retirement_plan.js
```

```sh
git clone <repository-url> simulator
mkdir data
cp simulator/retirement_setup.example.js data/retirement_setup.js
cp simulator/retirement_plan.example.js  data/retirement_plan.js
open simulator/retirement_simulator.html     # or open it in any browser
```

The two files do different jobs:

- **`retirement_setup.js`** configures the tool: the two currencies and countries, and how the
  analysis panels are drawn. You set it once.
- **`retirement_plan.js`** is the plan: balances, ages, spending, rates, pension options and the
  compulsory-distribution rules. It changes as your situation does.

Every figure in the examples is invented. Replace them with your own, either by editing the files or
in the page. **Save plan** downloads a `retirement_plan_<date>.js`; rename it to
`retirement_plan.js` and put it in `data/` to make it the starting state. **Save setup** does the
same for the setup file. Both files are run as JavaScript — from `data/`, and a plan also when it is
opened with **Load plan** — so load only files you have read.

The configuration is loaded with `<script src>` rather than fetched, because that is the only way a
page opened from `file://` can read a sibling file. Anything missing or unusable stops the page with
a banner that names it.

## Tests

```sh
node tests/run.mjs
```

These are browser integration tests: each suite launches headless Chrome, loads the real page
against the configuration in `../data`, and asserts against it. Set that directory up first, as
[Getting started](#getting-started) describes — without it the page stops with its configuration
banner and the suites fail. Nothing is installed — the harness drives Chrome over the DevTools
Protocol with what Node already ships, so you need Node.js 22 or later and a Chrome or Chromium. See
[`tests/README.md`](tests/README.md).

## Caveats

This is not financial advice. The treatment of pensions, retirement accounts and cross-border tax is
simplified; confirm anything specific to you with a professional who knows both countries.

## License

MIT — see [`LICENSE`](LICENSE).
