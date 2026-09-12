/* An example plan. Copy to ../data/retirement_plan.js and edit.

   This is one of two documents; retirement_setup.example.js configures the tool.
   That one is set once. This one changes, on cadences from monthly (balances, the
   exchange rate, spending) through annual (a pension statement) to statutory (the
   compulsory-distribution rules, the capital-gains rate).

   Every figure below is invented and rounded. It is a plausible plan for someone
   turning 40, a US citizen living in Japan, with assets on both sides: a couple of
   hundred thousand dollars accumulated before the move, a smaller amount in yen
   since, a mortgage half-paid, and twenty-five more working years. Nothing here is
   advice about any of those numbers — they are here so the page has something
   coherent to draw, and so each field has a value you can recognise as wrong for
   you and replace.

   Three kinds of value are mixed together and it is worth knowing which is which.
   Balances and ages are yours. Expected returns, volatility and the correlations
   are assumptions — arguable, and the sensitivity grid exists because they are.
   And a few are statute rather than choice: the capital-gains rate and the two
   `compulsory` blocks. Those are copied from the real rules as of 2026 and are
   the only figures here you should not treat as examples.

   Grouped by currency. `primary` is the currency you live and spend in; `secondary`
   is the foreign one you hold assets in. Each side carries the same things: a
   taxable brokerage account, a pre-tax retirement account, an expected return, and
   a public pension. `plan` is you. `fx` and `correlations` join the two sides, and
   the rate is quoted primary per secondary.

   This is also the shape "Save plan" writes, so a file saved out of the page can be
   dropped in here to become the starting state. Everything except the two
   `pensionOptions` lists and the two `compulsory` blocks is a field in the page, and
   is the fallback for a loaded file that omits it or a box left empty. */
window.RETIREMENT_PLAN = {
   /* ------------------------------------------------------------------ */
   /* The currency you live in                                           */
   /* ------------------------------------------------------------------ */
   /* `brokerageGainPct` is how much of that balance is gain rather than what you
      paid. Only the gain is taxed when you sell, so it drives the tax on every
      withdrawal.

      `retirementAccountGrowthPct`: a number means the account earns exactly that
      every year with no volatility, which is how a Japanese DC or iDeCo holding a
      stable-value fund behaves. null means it has no rate of its own and rides this
      currency's market return, volatility and all, like a brokerage-held IRA.

      `pensionOptions` is the only place the benefit figure lives — the claim-age
      dropdown is built from it, and the amount is looked up from the age chosen.
      Each entry is a matched pair to be read off a benefit statement, not one
      figure actuarially adjusted. An empty list means this side has no public
      pension: the field disappears and it never pays out. Replace these with your
      own Nenkin Net projection; the spread here is roughly what deferral is worth —
      standard at 65, about +42% at 70, +84% at 75.

      `compulsory` is whatever the country holding this retirement account forces out
      of it, and each currency configures its own. Two kinds exist. `"kind": "payout"`
      names a deadline to begin by and a number of years to spread the whole balance
      over, so the account is empty at the end of them — this is the Japanese shape,
      and the `"rmd"` one is described on the other side. Omit the object, or set the
      kind to `"none"`, and nothing is forced out of this account.

      Statute, not an example: a Japanese defined-contribution plan must begin paying
      out by 75, and the balance is spread over a period the plan's 規約 fixes within
      the five-to-twenty years the pension law allows. Miss the deadline and the
      instalment right is lost and the whole balance is paid as one lump sum —
      `overYears` of 1 models that. */
   "primary": {
         "brokerage": 20000000,
         "brokerageGainPct": 30,
         "retirementAccount": 5000000,
         "retirementAccountTaxPct": 20,
         "retirementAccountAccessAge": 60,
         "retirementAccountGrowthPct": 2,
         "returnMeanPct": 6,
         "returnVolatilityPct": 16,
         "pensionStartAge": 65,
         "pensionOptions": [
            {
               "startAge": 65,
               "annual": 1800000
            },
            {
               "startAge": 70,
               "annual": 2550000
            },
            {
               "startAge": 75,
               "annual": 3300000
            }
         ],
         "compulsory": {
            "kind": "payout",
            "startAge": 75,
            "overYears": 20
         }
      },

   /* ------------------------------------------------------------------ */
   /* The currency you hold assets in                                    */
   /* ------------------------------------------------------------------ */
   /* Pension amounts are annual, in this currency — the monthly benefit x 12.
      Replace with your own SSA statement from ssa.gov/myaccount: $1,500, $2,200 and
      $2,700 a month here. 62 is the earliest, 67 is full retirement age for anyone
      born after 1960, and 70 pays the most.

      `scheduledRetirementDraw` is a fixed annual draw once past the access age, for
      bracket-filling or Roth conversions. In the PRIMARY currency: an amount you
      plan to spend, not a balance. 0 disables it.

      `compulsory` here is the other kind: `"kind": "rmd"` takes a fraction of the
      balance every year, set by `divisors`, which tracks life expectancy — so the
      account is drawn down but never emptied. It has no `startAge`: the first row of
      the table is where it begins, which is why the table is kept trimmed to the ages
      that apply. Statute, not an example: under SECURE 2.0 the first
      required-minimum-distribution year is age 75 for anyone born in 1960 or later,
      which is everyone with a retirement still ahead of them, so the table starts at
      75. The IRS publishes it from 72 because it serves every cohort at once; those
      rows would only be noise here, and a refresh that brings them back drops them. */
   "secondary": {
         "brokerage": 300000,
         "brokerageGainPct": 40,
         "retirementAccount": 150000,
         "retirementAccountTaxPct": 25,
         "retirementAccountAccessAge": 60,
         "retirementAccountGrowthPct": null,
         "returnMeanPct": 7,
         "returnVolatilityPct": 17,
         "pensionStartAge": 67,
         "pensionOptions": [
            {
               "startAge": 62,
               "annual": 18000
            },
            {
               "startAge": 67,
               "annual": 26400
            },
            {
               "startAge": 70,
               "annual": 32400
            }
         ],
         "scheduledRetirementDraw": 0,
         "compulsory": {
            "kind": "rmd",
            "divisors": {
               "75": 24.6,
               "76": 23.7,
               "77": 22.9,
               "78": 22,
               "79": 21.1,
               "80": 20.2,
               "81": 19.4,
               "82": 18.5,
               "83": 17.7,
               "84": 16.8,
               "85": 16,
               "86": 15.2,
               "87": 14.4,
               "88": 13.7,
               "89": 12.9,
               "90": 12.2,
               "91": 11.5,
               "92": 10.8,
               "93": 10.1,
               "94": 9.5,
               "95": 8.9,
               "96": 8.4,
               "97": 7.8,
               "98": 7.3,
               "99": 6.8,
               "100": 6.4,
               "101": 6,
               "102": 5.6,
               "103": 5.2,
               "104": 4.9,
               "105": 4.6,
               "106": 4.3,
               "107": 4.1,
               "108": 3.9,
               "109": 3.7,
               "110": 3.5,
               "111": 3.4,
               "112": 3.3,
               "113": 3.1,
               "114": 3,
               "115": 2.9,
               "116": 2.8,
               "117": 2.7,
               "118": 2.5,
               "119": 2.3,
               "120": 2
            }
         }
      },

   /* ------------------------------------------------------------------ */
   /* The join between them                                              */
   /* ------------------------------------------------------------------ */
   /* `rate` is primary per secondary — how many units of the currency you spend one
      unit of the currency you invest in is worth. There is no drift term: the rate
      wanders with the volatility below and no trend, because no honest value for
      one exists. If you think one country's prices will outrun the other's, take
      the difference off that side's mean return. */
   "fx": {
         "rate": 150,
         "volatilityPct": 10
      },
   /* How the three random draws move together, each -1 to 1. Global equities are
      moderately correlated; the FX pair less so. */
   "correlations": {
         "secondaryPrimary": 0.6,
         "secondaryFx": 0.3,
         "primaryFx": 0.4
      },

   /* ------------------------------------------------------------------ */
   /* You                                                                */
   /* ------------------------------------------------------------------ */
   /* Every amount here is in the primary currency and in today's money. The tax
      rates are on income rather than on an account, so they belong to you rather
      than to either currency: capital gains at the rate of the country you live in,
      which is assumed to bind. 20.315% is statute — 15% national + 0.315%
      reconstruction surtax + 5% local inhabitant tax, flat regardless of the gain.

      This example is someone turning 40 who expects to work to 65 on ¥12m a year,
      spends ¥7m, and has ¥200,000 a month of mortgage until it is paid off at 70.
      The horizon runs to 95 — a deliberately long life to plan for rather than an
      expected one.

      Those figures were chosen rather than picked. As set, the plan comes out around
      82%: amber rather than green, sound but with something to worry about, which is
      more use to look at than either extreme. It has the awkward parts a real plan
      has, too — income stops at 65 but the mortgage runs to 70, and the two pensions
      start two years apart. An earlier draft retired at 60 on ¥8m of spending and
      came out at 37%, with the median path broke by its late seventies; worth knowing
      that a plausible-looking set of round numbers can be that far from sound.

      Two things about this page read oddly at 40, and both are real rather than
      artefacts of the example. The year-1 figures are small, because at 40 you are
      still earning: net pay of ¥9m against ¥9.4m of costs leaves a ¥400,000
      shortfall, and that is the whole of the first year's withdrawal. Raise the
      income above the costs and those tiles go to zero altogether, correctly — the
      surplus is invested instead. And the sensitivity grid is nearly flat, because
      the lowest the portfolio ever gets is in the next year or two, set by what you
      have today rather than by any return assumption. That grid earns its keep for
      someone near or in retirement. Twenty-five years out, the survival chart and
      the spending comparison are the panels with something to say.

      `annualSpendingChangePct` at 0 keeps spending flat in real terms. A small
      negative figure models the retirement "spending smile" — travel and other
      discretionary outlays taper off with age — and is worth trying, because it
      moves the answer a lot. */
   "plan": {
         "currentAge": 40,
         "horizonEndAge": 95,
         "inflationPct": 2,
         "capitalGainsTaxPct": 20.315,
         "pensionTaxPct": 10,
         "earnedIncomeTaxPct": 25,
         "annualSpending": 7000000,
         "annualSpendingChangePct": 0,
         "mortgageAnnual": 2400000,
         "mortgagePayoffAge": 70,
         "earnedIncome": 12000000,
         "earnedIncomeEndAge": 65,
         "montecarloPaths": 10000
      },

   /* ------------------------------------------------------------------ */
   /* Where the copied figures came from, and when                       */
   /* ------------------------------------------------------------------ */
   /* Optional, and only for the values above that are neither yours nor your
      judgement: statutory rates, the divisor table, volatilities and correlations
      measured over some window, and the benefit figures off a statement. Those are
      copies of something that was true on the day it was copied, and they rot
      without looking any different — a divisor table from three tax years ago
      is indistinguishable from the current one.

      Keyed by the path it describes. The settings panel shows how long ago each
      was refreshed and marks anything older than `staleAfterMonths` in the setup
      document, or with no date at all. Editing one of these values by hand stamps
      today's date, so the record cannot go on describing a figure you changed.

      The dates below are made up, like everything else in this file. */
   "sources": {
      "plan.capitalGainsTaxPct": { "url": "https://www.nta.go.jp/english/taxes/individual/12011.htm", "asOf": "2026-04-02" },
      "secondary.compulsory": { "url": "https://www.irs.gov/publications/p590b", "asOf": "2026-02-14" },
      "primary.compulsory": { "url": "https://www.ideco-koushiki.jp/join/benefits.html", "asOf": "2026-02-14" },
      "plan.inflationPct": { "url": "https://www.boj.or.jp/en/mopo/outlook/index.htm", "asOf": "2026-01-20" },
      "secondary.returnMeanPct": { "url": "https://www.vanguard.com/vemo", "asOf": "2026-01-20" },
      "secondary.returnVolatilityPct": { "url": "https://www.vanguard.com/vemo", "asOf": "2026-01-20" },
      "primary.returnMeanPct": { "url": "https://www.vanguard.com/vemo", "asOf": "2026-01-20" },
      "primary.returnVolatilityPct": { "url": "https://www.vanguard.com/vemo", "asOf": "2026-01-20" },
      "fx.volatilityPct": { "url": "https://fred.stlouisfed.org/series/DEXJPUS", "asOf": "2026-01-20" },
      "correlations.secondaryPrimary": { "url": "https://fred.stlouisfed.org/series/DEXJPUS", "asOf": "2026-01-20" },
      "correlations.secondaryFx": { "url": "https://fred.stlouisfed.org/series/DEXJPUS", "asOf": "2026-01-20" },
      "correlations.primaryFx": { "url": "https://fred.stlouisfed.org/series/DEXJPUS", "asOf": "2026-01-20" },
      "secondary.pensionOptions": { "url": "https://www.ssa.gov/myaccount/", "asOf": "2026-03-11" },
      "primary.pensionOptions": { "url": "https://www.nenkin.go.jp/n_net/", "asOf": "2026-03-11" }
   }
};
