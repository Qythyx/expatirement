/* How the simulator itself is set up — an example. Copy to
   ../data/setup.js and edit.

   This is one of two documents. The other, plan.example.js, is the
   plan: balances, ages, rates, pensions. The split is by how often a thing
   changes. Nothing in this file changes once you have decided it; everything in
   that one does, on cadences from monthly to statutory.

   Neither file is in git in real use — the plan holds account balances. These two
   examples are what a fresh checkout works from, and what documents the shape.

   Loaded via <script src>, because a file:// page cannot fetch a sibling file and
   that is the only route that works from disk. Anything missing or unusable stops
   the page with a banner naming it: leaving a key out is an error, not a way to
   accept a built-in default. */
window.RETIREMENT_SETUP = {
   /* The two currencies, and everything the page needs to name them. `primary` is
      where you live and spend — the retirement currency, and the one every figure
      on screen is reported in. `secondary` is the foreign one you hold assets in.
      Which two countries this is a plan for is settled here and nowhere else; the
      page names neither.

      Four naming keys per side, because they are not interchangeable in either
      language. A correlation label wants the code — corr(USD, JPY). Its Japanese
      half wants the name — 連動性：ドル資産と円資産. A field label wants the
      adjective — "US brokerage". A jurisdiction wants the country —
      "Capital-gains rate (Japan)".

      `country` holds "US", not "the US", so that a label can put it in brackets
      without reading badly; prose that needs the article writes it.

      `symbol` is not derived from `code`. Intl can do it, but in Japanese it
      returns the full-width ￥ rather than the ¥ set everywhere else — a different
      glyph, at a different width, in a monospace column, appearing the moment you
      switch language. Several currencies (CHF, SGD) have no symbol in Intl at all
      and come back as the code.

      `bigUnit` is the scale headline figures are read at: 億, a hundred million,
      for yen; millions for dollars. Nothing on screen is in the secondary currency
      today, so its bigUnit goes unused — it is here so that swapping which side is
      primary needs no other edit. */
   /* How many months a figure copied from somewhere else may go unchecked before
      the settings panel marks it. It applies to the statutory rates, the RMD
      table, the market assumptions and the benefit statements — values that are
      copies rather than yours, and that rot without looking any different.
      Twelve, because tax law and published market assumptions both move on
      roughly annual cycles. */
   "staleAfterMonths": 12,

   "currencies": {
         "primary": {
            "code": "JPY",
            "symbol": "¥",
            "name": {
               "en": "yen",
               "ja": "円"
            },
            "country": {
               "en": "Japan",
               "ja": "日本"
            },
            "adjective": {
               "en": "Japanese",
               "ja": "日本の"
            },
            "bigUnit": {
               "factor": 100000000,
               "label": {
                  "en": "億",
                  "ja": "億"
               },
               "decimals": 2
            }
         },
         "secondary": {
            "code": "USD",
            "symbol": "$",
            "name": {
               "en": "dollars",
               "ja": "ドル"
            },
            "country": {
               "en": "US",
               "ja": "米国"
            },
            "adjective": {
               "en": "US",
               "ja": "米国の"
            },
            "bigUnit": {
               "factor": 1000000,
               "label": {
                  "en": "M",
                  "ja": "百万"
               },
               "decimals": 2
            }
         }
      },

   /* The two spending curves drawn either side of the plan on the survival chart,
      and the window used to sort paths by how their early years went. */
   "comparison": {
         "spendStepPct": 20,
         "sequenceYears": 10
      },

   /* Sensitivity grid axes, as steps away from whatever is in the plan. Returns
      are percentage points off the secondary mean, FX is a percentage of the
      starting rate. Both lists must contain 0 — that cell is the plan as
      configured. */
   "sensitivity": {
         "returnStepsPct": [
            -2,
            -1,
            0,
            1,
            2
         ],
         "fxStepsPct": [
            -30,
            -20,
            -10,
            0,
            10,
            20,
            30
         ]
      },

   /* Where the headline success figure changes colour: green at or above `good`,
      amber down to `fair`, red below it. */
   "successThresholdsPct": {
         "good": 90,
         "fair": 75
      },

   /* The simulation is seeded so the same inputs always give the same answer, and
      so the comparison curves draw from the same market paths. Change the seed to
      resample; `minPaths` is the floor the path-count field is clamped to. */
   "simulation": {
         "seed": 49734321,
         "minPaths": 200
      }
};
