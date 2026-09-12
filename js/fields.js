'use strict';

/* ------------------------------------------------------------------ */
/* Field configuration (drives the form, the engine inputs, and persistence) */
/* ------------------------------------------------------------------ */
/* Labels and tooltips name no country or currency of their own: they carry
   {secondary.country} style tokens, filled at render time. The Japanese tooltips
   assume no finance background, so they are not translations of the English. */

/* One description per paired setting, shown once under both currencies' boxes in
   the settings sheet — so it names a jurisdiction only as an example ("a US
   Traditional IRA"), never as its subject. */
const PAIRED_TIPS = {
	brokerage: {
		en: 'From your broker’s statement or account summary, as the current market value. Add up every taxable brokerage account you hold in this currency and enter one total. Taxable means gains are taxed when you sell, unlike a tax-sheltered account such as Japan’s NISA or a US Roth.',
		ja: '出どころは証券会社の残高報告書や口座画面で、今の評価額を使います。この通貨で持っている「課税される」証券口座をすべて合計して、ひとつの金額で入れてください。課税される、というのは売って利益が出ればその都度税金がかかるという意味で、日本のNISAや米国のロスのような非課税の口座とは違います。',
	},
	brokerageGainPct: {
		en: 'Your broker shows this as cost basis (or acquisition cost) against market value; across several accounts, estimate an average. It is how much of the balance above is unrealized capital gain — gain ÷ market value. Unrealized means the holding has risen since you bought it but you have not sold, so the profit is on paper and untaxed. Selling taxes only this share, which is why the split matters.',
		ja: '証券会社の画面で「取得価額」と「評価額」を見比べれば分かります。口座がいくつかあるときは、全体をならした平均で構いません。上の残高のうち何％が「含み益」かを入れてください（含み益 ÷ 評価額）。含み益とは、買ったときより値上がりしているけれど、まだ売っていないので手にしていない利益のことです。売ったときに税金がかかるのはこの部分だけなので、この割合が税額を左右します。',
	},
	retirementAccount: {
		en: 'From the provider’s statement, as the current value, with every pre-tax retirement account you hold in this currency added into one total. Pre-tax means the money went in untaxed and is taxed as ordinary income on the way out: a Traditional Individual Retirement Account (IRA) in the US, an iDeCo or company defined-contribution (DC) plan in Japan.',
		ja: '出どころは運営会社の残高通知で、今の残高を使います。この通貨で持っている「税引き前」の退職・年金口座をすべて合計して入れてください。税引き前とは、預けたときに所得税を引かれていないという意味で、そのぶん引き出すときに給与と同じ扱いで課税されます。米国のトラディショナルIRA（個人退職口座）、日本のiDeCoや企業型DC（確定拠出年金）がこれにあたります。',
	},
	retirementAccountTaxPct: {
		en: 'Estimate it from how the country holding the account treats a withdrawal. A US Individual Retirement Account (IRA) withdrawal is ordinary income, so use your expected combined federal and state rate. A Japanese lump sum or annuity gets large retirement-income or pension deductions, so the real burden sits well below the headline rate — work it out from the deduction your plan qualifies for rather than the rate table.',
		ja: 'その口座がある国で、引き出しがどう課税されるかから見積もります。米国のIRA（個人退職口座）からの引き出しは給与と同じ扱いなので、連邦税と州税を合わせた見込みの率を使ってください。日本の一時金には退職所得控除、年金形式には公的年金等控除という大きな控除があるので、実際の負担は税率表の数字よりかなり低くなります。税率表ではなく、自分が受けられる控除から計算してください。',
	},
	retirementAccountAccessAge: {
		en: 'Set by law, and stated by the tax authority — for a US Traditional Individual Retirement Account (IRA), 59½; for a Japanese iDeCo or company defined-contribution (DC) plan, typically 60, or later if you were enrolled for fewer than ten years, which your provider will confirm. In the simulation it is a gate rather than a penalty: before this age the account is left untouched, so spending has to come from the brokerage accounts instead, and a plan that cannot cover the early years fails there. Give it the age drawing becomes sensible rather than merely legal — a US withdrawal before 59½ is allowed, but it costs 10% on top of income tax, which this page does not model.',
		ja: '法律で決まっていて、税務当局が示している年齢です。米国のトラディショナルIRA（個人退職口座）は59歳半、日本のiDeCoや企業型DC（確定拠出年金）はふつう60歳で、加入期間が10年に満たない場合はもっと遅くなります。自分の年齢は運営会社に確認できます。シミュレーションの中では、これは罰金ではなく「関門」です。この年齢より前はこの口座に手を付けないので、生活費は証券口座から出すことになり、そこで足りなければその時点で資金が尽きたことになります。「法律上引き出せる年齢」ではなく「引き出すのが妥当な年齢」を入れてください。米国では59歳半より前でも引き出せますが、所得税に加えて10％の追加課税がかかります。この追加課税はこのページでは計算していません。',
	},
	retirementAccountGrowthPct: {
		en: 'Only fill this in if the account does not track the market — a stable-value or principal-guaranteed holding, whose rate the provider states. It then grows by exactly that rate every year, with no ups and downs. Leave it empty for anything invested in the market, such as a brokerage-held Individual Retirement Account (IRA) or an iDeCo in an index fund, and it earns that currency’s mean return above instead, volatility included.',
		ja: 'この口座が市場に連動しない場合だけ入れてください。元本確保型のように利率が決まっているもので、その利率は運営会社が示しています。入れた場合は、値動きのぶれなしに毎年きっちりその率で増えます。市場で運用しているもの（証券会社で運用するIRA、投資信託で運用するiDeCoなど）は空のままにしてください。空にすると、上のこの通貨の平均利回りで、値動きのぶれも込みで増えていきます。',
	},
	returnMeanPct: {
		en: 'A choice between houses that disagree, not a lookup — take it from a published set of long-run capital-market assumptions, or use the prompt below to gather a few and see the spread. Around 6–7% is common for US equities. It is the arithmetic mean: with volatility, a typical path compounds at roughly this figure minus half the variance. It also carries the inflation gap between the two countries, because the exchange rate is given no trend — if you think one country’s prices will outrun the other’s, take the difference off here rather than looking for it in the foreign-exchange (FX) fields.',
		ja: 'これは調べれば答えが決まる値ではなく、機関によって見解が分かれるものから選ぶ値です。長期の市場前提を公表しているものから取るか、下のプロンプトでいくつか集めて幅を見てください。米国株なら6〜7％あたりがよく使われます。これは単純平均で、値動きのぶれがあるぶん、実際に積み上がる利回りはこれより「ばらつきの半分」ほど低くなります。なお為替には方向の想定を置いていないので、二国間の物価上昇率の差もこの欄が兼ねています。片方の国の物価がもう片方より速く上がると思うなら、その差は為替の欄ではなくここで引いてください。',
	},
	returnVolatilityPct: {
		en: 'Measured from market history rather than chosen, so it has a right answer — but only against a stated window, which the prompt below asks for. It is the annual standard deviation of those returns: how far a single year typically lands from the average above. Broad equity markets run around 15–18%, US and Japanese alike. Bigger numbers widen the fan of outcomes without moving its centre.',
		ja: 'これは選ぶ値ではなく、相場の記録から測る値なので、正しい答えがあります。ただし「いつからいつまでを測ったか」が示されて初めて意味を持つので、下のプロンプトではそれも書いてもらいます。1年ごとの利回りが、上の平均からふつうどれくらい離れるか（標準偏差）です。米国株も日本株も、幅広い株式指数はおおむね15〜18％です。この値を大きくすると、真ん中は動かないまま、起こりうる結果の幅だけが広がります。',
	},
	pensionStartAge: {
		en: 'Which age you intend to claim at. The ages on offer are exactly the ones in the list below, so they come from your own benefit projection rather than from anything written into this page — claiming later always pays more, and how much more is the scheme’s to say, not ours. The benefit is held flat in real terms: right for a scheme with a cost-of-living adjustment, as US Social Security has, and mildly optimistic for Japan, whose macro-slide indexation is designed to lag prices. Deferring is usually the largest single improvement available to a plan.',
		ja: 'この年金を何歳から受け取るつもりかを選びます。選べる年齢は下の一覧にあるものだけで、その一覧はあなた自身の見込額から写したものです。このページに年齢が書き込まれているわけではありません。遅らせるほど額は増えますが、どれだけ増えるかを決めるのは制度であって、このページではありません。金額は実質で一定、つまり物価に合わせて増える前提で計算します。米国のソーシャルセキュリティのように物価スライドのある制度なら妥当ですが、日本はマクロ経済スライドという仕組みで物価の伸びよりやや低く抑えられるため、少し楽観的な置き方です。繰り下げは、たいてい計画を最も大きく改善できる一手です。',
	},
	pensionOptions: {
		en: 'One line per claim age: the age, then the annual benefit in that currency. Copy each pair straight off your projection — ssa.gov/myaccount for a US Social Security Administration (SSA) estimate, Nenkin Net for a Japanese one — rather than adjusting a figure yourself, and convert a monthly benefit to annual by multiplying by twelve. This is the only place the amounts live, and the dropdown above is built from these lines, so an age missing here cannot be chosen. An empty list means this side has no public pension: the age above disappears and it never pays.',
		ja: '1行につき「受給開始年齢」と「その年齢での年額（この通貨建て）」です。見込額の通知に出ている組み合わせをそのまま写してください（米国のソーシャルセキュリティなら ssa.gov/myaccount、日本の公的年金なら「ねんきんネット」）。自分で増減させた数字は使わないでください。月額で書かれている場合は12倍して年額にします。金額が書かれているのはここだけで、上の選択肢はこの表から作られるので、ここにない年齢は選べません。空にすると、この側には公的年金がないものとして扱われ、上の項目は消えて一度も支払われません。',
	},
};

const FIELDS = [
	{
		title: { en: 'Balances, gains & FX', ja: '残高・含み益・為替レート' },
		fields: [
			{
				id: 'secondary.brokerage',
				label: { en: '{secondary.adjective} brokerage', ja: '{secondary.adjective}証券口座' },
				unit: 'secondary',
				tip: PAIRED_TIPS.brokerage,
			},
			{
				id: 'secondary.brokerageGainPct',
				label: { en: '{secondary.adjective} brokerage gain ratio', ja: '{secondary.adjective}証券口座の含み益の割合' },
				unit: 'pct',
				tip: PAIRED_TIPS.brokerageGainPct,
			},
			{
				id: 'secondary.retirementAccount',
				label: { en: '{secondary.adjective} retirement', ja: '{secondary.adjective}退職・年金口座' },
				unit: 'secondary',
				tip: PAIRED_TIPS.retirementAccount,
			},
			{
				id: 'primary.brokerage',
				label: { en: '{primary.adjective} brokerage', ja: '{primary.adjective}証券口座' },
				unit: 'primary',
				tip: PAIRED_TIPS.brokerage,
			},
			{
				id: 'primary.brokerageGainPct',
				label: { en: '{primary.adjective} brokerage gain ratio', ja: '{primary.adjective}証券口座の含み益の割合' },
				unit: 'pct',
				tip: PAIRED_TIPS.brokerageGainPct,
			},
			{
				id: 'primary.retirementAccount',
				label: { en: '{primary.adjective} retirement', ja: '{primary.adjective}退職・年金口座' },
				unit: 'primary',
				tip: PAIRED_TIPS.retirementAccount,
			},
			{
				id: 'fx.rate',
				label: { en: 'FX ({primary.code} per {secondary.code})', ja: '為替レート（1{secondary.name}＝何{primary.name}）' },
				unit: 'primary',
				tip: {
					en: 'Today’s foreign-exchange (FX) spot rate, from any financial site or a search for “{secondary.code} {primary.code}”. It is where the simulation starts: how many {primary.name} one {secondary.code} buys, used to convert {secondary.code} assets and income into {primary.name}.',
					ja: '出どころは為替のニュースや検索で、今のレート（FX＝外国為替の相場）をそのまま入れます。1{secondary.name}が何{primary.name}かという値で、計算の出発点になります。{secondary.name}建ての資産と収入を{primary.name}に直すのに使います。',
				},
			},
		],
	},
	{
		title: { en: 'Embedded gains & tax rates', ja: '含み益と税率' },
		fields: [
			{
				id: 'plan.capitalGainsTaxPct',
				label: { en: 'Capital-gains rate ({primary.country})', ja: '株の譲渡益税率（{primary.country}）' },
				unit: 'pct',
				tip: {
					en: 'From the tax authority of the country you live in — for Japan, the National Tax Agency (NTA). It is the flat rate on gains from listed securities: 20.315%, being 15% national income tax plus a 0.315% reconstruction surtax plus 5% local inhabitant tax. Flat, so it does not depend on how large the gain is.',
					ja: '出どころは住んでいる国の税務当局で、日本なら国税庁です。上場株式等を売って出た利益にかかる税率で、20.315％＝所得税15％＋復興特別所得税0.315％＋住民税5％です。利益の大きさによらず一定です。',
				},
			},
			{
				id: 'secondary.retirementAccountTaxPct',
				label: { en: '{secondary.adjective} retirement effective rate', ja: '{secondary.adjective}退職・年金口座の実効税率' },
				unit: 'pct',
				tip: PAIRED_TIPS.retirementAccountTaxPct,
			},
			{
				id: 'primary.retirementAccountTaxPct',
				label: { en: '{primary.adjective} retirement effective rate', ja: '{primary.adjective}退職・年金口座の実効税率' },
				unit: 'pct',
				tip: PAIRED_TIPS.retirementAccountTaxPct,
			},
			{
				id: 'plan.pensionTaxPct',
				label: { en: 'Pension effective rate', ja: '年金収入の実効税率' },
				unit: 'pct',
				tip: {
					en: 'One rate covering both public pensions together. Estimate it from your expected bracket once retired, and check the tax treaty between the two countries — which one may tax a cross-border pension is settled there, and getting it wrong can double-count.',
					ja: '2つの公的年金を合わせた収入にかかる、ひとつの実効税率です。リタイア後の見込みの税率区分から見積もってください。あわせて二国間の租税条約も確認してください。国をまたぐ年金をどちらの国が課税できるかはそこで決まっており、読み違えると二重に数えてしまいます。',
				},
			},
			{
				id: 'plan.earnedIncomeTaxPct',
				label: { en: 'Earned income effective rate', ja: '勤労収入の実効税率' },
				unit: 'pct',
				tip: {
					en: 'From your most recent payslip or tax return: total deductions ÷ gross pay. Employment income is taxed as ordinary income — national and local inhabitant tax, plus social insurance where it applies — so this normally sits well above the pension rate.',
					ja: '出どころは直近の給与明細か確定申告で、「引かれた合計 ÷ 額面」で求められます。給与は通常の所得として、所得税と住民税がかかり、さらに社会保険料も引かれます。そのため、ふつうは年金収入の税率よりかなり高くなります。',
				},
			},
		],
	},
	{
		title: { en: 'Spending & mortgage', ja: '生活費と住宅ローン' },
		fields: [
			{
				id: 'plan.annualSpending',
				label: { en: 'Base annual spending', ja: '年間の基本生活費' },
				unit: 'primary',
				tip: {
					en: 'Add up a year of your own spending and take out the mortgage, which has its own field below. In today’s {primary.name}. The simulation carries it forward at the inflation rate, then applies the real change below.',
					ja: '1年ぶんの自分の支出を合計し、住宅ローンを除いた額です（ローンは下の欄で別に入れます）。今の物価での金額で入れてください。計算の中では毎年インフレ率のぶんだけ増やし、さらに下の「生活費の年変化」を反映させます。',
				},
			},
			{
				id: 'plan.annualSpendingChangePct',
				label: { en: 'Annual spending change', ja: '生活費の年変化' },
				unit: 'pct',
				tip: {
					en: 'A judgement, not a figure to look up. It is the yearly change in spending on top of inflation: a small negative value models the retirement “spending smile”, where travel and other discretionary outlays taper off with age. Leave it at 0 if you would rather assume nothing.',
					ja: '調べて写す値ではなく、自分で決める見込みです。インフレとは別に、生活費が毎年どれくらい増えるか減るかを表します。小さめのマイナスにすると、年をとるにつれて旅行や外食などの出費が自然に減っていく傾向（リタイア後の支出の「スマイルカーブ」）を表せます。何も想定したくなければ0のままで構いません。',
				},
			},
			{
				id: 'plan.mortgageAnnual',
				label: { en: 'Mortgage annual amount', ja: '住宅ローンの年間返済額' },
				unit: 'primary',
				tip: {
					en: 'From your loan statement or repayment schedule: twelve monthly payments, or whatever a year comes to. Added to spending each year until the payoff age below. This is the one figure not in today’s money — a mortgage is a fixed contract, so it is held flat in nominal {primary.name} and inflation erodes it in real terms.',
					ja: '出どころはローンの返済予定表や明細で、毎月の返済額を12か月ぶん合計した額です（{primary.name}）。下の完済年齢まで、毎年の生活費に上乗せされます。この欄だけは「今の物価に直した金額」ではありません。返済額は契約で決まっていて増えないので、金額はそのままにし、物価が上がるほど実質的な負担が軽くなる形で計算します。',
				},
			},
			{
				id: 'plan.mortgagePayoffAge',
				label: { en: 'Mortgage payoff age', ja: '住宅ローンの完済年齢' },
				unit: 'age',
				tip: {
					en: 'Your age in the year the last payment falls due — the repayment schedule gives the date, and your current age below turns it into an age. Payments stop from here.',
					ja: '最後の返済がある年に自分が何歳かを入れます。返済予定表に完済の時期が書かれているので、下の「現在の年齢」と突き合わせれば年齢に直せます。この年齢から返済はなくなります。',
				},
			},
		],
	},
	{
		title: { en: 'Income & pensions', ja: '収入と年金' },
		fields: [
			{
				id: 'plan.earnedIncome',
				label: { en: 'Earned income (annual)', ja: '勤労収入（年間）' },
				unit: 'primary',
				tip: {
					en: 'What you expect to keep earning, before tax — from a payslip or a contract if you have one, otherwise your own estimate. In today’s {primary.name}, applied from your current age until the end age below, and held flat in real terms so it keeps pace with inflation. Taxed at the earned-income rate above; anything left over after spending is invested in the {primary.adjective} brokerage. Set it to 0 if you are fully retired.',
					ja: 'これから稼ぎ続ける見込みの年収（税引き前）です。給与明細や契約書があればそこから、なければ自分の見積もりで構いません。今の物価での金額で入れてください。現在の年齢から、下の終了年齢の前の年まで続くものとして計算します。実質で一定、つまり物価に合わせて上がっていく前提です。上の勤労収入の税率で課税し、生活費を払って余った分は{primary.adjective}証券口座に積み立てます。完全にリタイアしているなら0。',
				},
			},
			{
				id: 'plan.earnedIncomeEndAge',
				label: { en: 'Earned income end age', ja: '勤労収入の終了年齢' },
				unit: 'age',
				tip: {
					en: 'The age you plan to stop working — your own decision. Income applies from your current age up to, but not including, this age.',
					ja: '働くのをやめるつもりの年齢で、自分で決める値です。収入は現在の年齢から、この年齢の前の年までとして計算されます（この年齢の年にはもう収入はありません）。',
				},
			},
			{
				id: 'secondary.pensionStartAge',
				label: { en: '{secondary.adjective} pension start', ja: '{secondary.adjective}公的年金の受給開始' },
				unit: 'claim',
				tip: PAIRED_TIPS.pensionStartAge,
				claim: { list: 'secondary.pensionOptions', role: 'secondary', period: 'month' },
			},
			{
				id: 'primary.pensionStartAge',
				label: { en: '{primary.adjective} pension start', ja: '{primary.adjective}公的年金の受給開始' },
				unit: 'claim',
				tip: PAIRED_TIPS.pensionStartAge,
				claim: { list: 'primary.pensionOptions', role: 'primary', period: 'year' },
			},
		],
	},
	{
		title: { en: 'Ages & strategy', ja: '年齢と引き出し方針' },
		fields: [
			{
				id: 'plan.currentAge',
				label: { en: 'Current age', ja: '現在の年齢' },
				unit: 'age',
				tip: {
					en: 'Your age today. Every other age on this page is read against it, so it is what turns a date on a statement into a year of the simulation.',
					ja: '今のあなたの年齢です。このページの他の年齢はすべてこれを基準に読まれるので、明細に書かれた日付を「何年目か」に直す起点になります。',
				},
			},
			{
				id: 'plan.horizonEndAge',
				label: { en: 'Horizon end age', ja: '計算する最終年齢' },
				unit: 'age',
				tip: {
					en: 'A planning choice rather than a prediction: the age the simulation runs through. Taking it into the 90s is the conservative reading, because outliving the plan is the risk that cannot be undone.',
					ja: '予想ではなく計画の置き方です。何歳までを計算するかを決めます。90代まで取っておくのが慎重な見方です。長生きして資金が尽きることだけは、あとから取り返しがつかないからです。',
				},
			},
			{
				id: 'secondary.retirementAccountAccessAge',
				label: { en: '{secondary.adjective} retirement access age', ja: '{secondary.adjective}退職・年金口座を受け取れる年齢' },
				unit: 'age',
				tip: PAIRED_TIPS.retirementAccountAccessAge,
			},
			{
				id: 'primary.retirementAccountAccessAge',
				label: { en: '{primary.adjective} retirement access age', ja: '{primary.adjective}退職・年金口座を受け取れる年齢' },
				unit: 'age',
				tip: PAIRED_TIPS.retirementAccountAccessAge,
			},
			{
				id: 'secondary.scheduledRetirementDraw',
				label: { en: 'Scheduled {secondary.adjective} retirement draw', ja: '{secondary.adjective}退職・年金口座の計画的な引き出し額' },
				unit: 'primary',
				tip: {
					en: 'Your own strategy, not a figure to look up: a fixed amount drawn from the {secondary.country} retirement account each year once past the access age above, whether or not spending needs it. People use it to fill a low tax bracket, or to move money into a Roth. In {primary.name}, because it is an amount you plan to spend rather than a balance. 0 disables it.',
					ja: '調べて写す値ではなく、自分で決める引き出し方針です。上の「受け取れる年齢」を過ぎたあと、生活費に必要かどうかに関わらず、毎年決まった額を{secondary.country}の退職・年金口座から引き出します（{primary.name}）。低い税率の枠を使い切っておく、あるいはRoth（ロス）口座へ移し替えるといった目的で使います。使わないなら0。',
				},
			},
		],
	},
	{
		title: { en: 'Expected returns & volatility', ja: '想定利回りと変動の大きさ' },
		fields: [
			{
				id: 'plan.inflationPct',
				label: { en: 'Inflation ({primary.country})', ja: 'インフレ率（{primary.country}）' },
				unit: 'pct',
				tip: {
					en: 'The long-run consumer inflation you expect where you live — a central bank’s target, or a published long-run forecast, rather than the last twelve months. Every amount you enter is in today’s money and is carried forward at this rate internally, so the returns below stay nominal and capital-gains tax lands on the nominal gain. The mortgage is the one exception: a fixed contract, so inflation erodes it. All results are converted back to today’s {primary.name}.',
					ja: '住んでいる国の、長い目で見た物価上昇率の見込みです。直近1年の実績ではなく、中央銀行の目標や、公表されている長期の見通しを使ってください。入力する金額はすべて今の物価に直した値で、計算の中ではこの率で将来の金額に直しています。そのため利回りは名目のまま扱われ、株の譲渡益税も名目の利益にかかります。例外は住宅ローンで、契約で固定されているぶん物価が上がると実質的に軽くなります。結果はすべて今の{primary.name}に戻して表示します。',
				},
			},
			{
				id: 'secondary.returnMeanPct',
				label: { en: '{secondary.code} assets — mean return', ja: '{secondary.name}資産 — 平均利回り' },
				unit: 'pct',
				tip: PAIRED_TIPS.returnMeanPct,
			},
			{
				id: 'secondary.returnVolatilityPct',
				label: { en: '{secondary.code} assets — volatility', ja: '{secondary.name}資産 — 変動の大きさ' },
				unit: 'pct',
				tip: PAIRED_TIPS.returnVolatilityPct,
			},
			{
				id: 'secondary.retirementAccountGrowthPct',
				label: { en: '{secondary.adjective} retirement — growth', ja: '{secondary.adjective}退職・年金口座 — 利回り' },
				unit: 'pct',
				tip: PAIRED_TIPS.retirementAccountGrowthPct,
			},
			{
				id: 'primary.returnMeanPct',
				label: { en: '{primary.code} assets — mean return', ja: '{primary.name}資産 — 平均利回り' },
				unit: 'pct',
				tip: PAIRED_TIPS.returnMeanPct,
			},
			{
				id: 'primary.returnVolatilityPct',
				label: { en: '{primary.code} assets — volatility', ja: '{primary.name}資産 — 変動の大きさ' },
				unit: 'pct',
				tip: PAIRED_TIPS.returnVolatilityPct,
			},
			{
				id: 'primary.retirementAccountGrowthPct',
				label: { en: '{primary.adjective} retirement — growth', ja: '{primary.adjective}退職・年金口座 — 利回り' },
				unit: 'pct',
				tip: PAIRED_TIPS.retirementAccountGrowthPct,
			},
			{
				id: 'fx.volatilityPct',
				label: { en: 'FX — annual volatility', ja: '為替 — 変動の大きさ' },
				unit: 'pct',
				tip: {
					en: 'Measured from foreign-exchange (FX) history over a stated window, the same way as the volatilities above; the prompt below will fetch it. It is how far a year’s move typically lands from no move at all — historical {secondary.code}/{primary.code} runs around 9–10%. This field is the whole of the exchange-rate uncertainty: no direction is assumed, in either currency’s favour, because no direction can be chosen honestly.',
					ja: '上の変動の大きさと同じで、期間を決めて為替（FX＝外国為替）の記録から測る値です。下のプロンプトで調べてもらえます。1年でどれくらい動くのがふつうか、という幅を表します。{secondary.name}{primary.name}の実績はおおむね9〜10％です。この欄が為替の不確実性のすべてで、どちらの方向に動くという想定は置いていません。誠実に決められる値がないためです。',
				},
			},
		],
	},
	{
		title: { en: 'Advanced — correlations & paths', ja: '詳細設定 — 連動性と試行回数' },
		fields: [
			{
				id: 'correlations.secondaryPrimary',
				label: { en: 'corr({secondary.code}, {primary.code})', ja: '連動性：{secondary.name}資産と{primary.name}資産' },
				unit: 'num',
				tip: {
					en: 'Measured from the two markets’ histories over a stated window — the prompt below will fetch it. It is how much they move together, from −1 to 1: at 1 they rise and fall in lockstep, at 0 one tells you nothing about the other, at −1 a good year for one is a bad year for the other. It matters because holding both is only diversification to the extent this number is low — near 1, a crash takes the whole portfolio at once. Broad national equity markets are moderately linked, so around 0.6 is typical.',
					ja: '期間を決めて、2つの市場の記録から測る値です。下のプロンプトで調べてもらえます。どれくらい一緒に動くかを −1〜1 で表します。1なら完全に同じ方向に上下し、0なら片方から他方は何も分からず、−1なら正反対に動きます。両方を持つことが分散になるかどうかはこの数字次第で、1に近いほど、暴落のときに資産全体がまとめて下がることになります。国ごとの幅広い株式指数はある程度一緒に動くので、0.6あたりが目安です。',
				},
			},
			{
				id: 'correlations.secondaryFx',
				label: { en: 'corr({secondary.code}, FX)', ja: '連動性：{secondary.name}資産と為替' },
				unit: 'num',
				tip: {
					en: 'Measured the same way, from the same window: how much {secondary.code} assets move together with the exchange rate, from −1 to 1. Positive means they tend to rise in {secondary.name} just as {secondary.code} strengthens, so the gain arrives twice over once converted; negative means the currency gives back what the market gives, and the two partly cancel. Since everything is spent in {primary.name}, this is what decides whether holding foreign assets amplifies your swings or damps them.',
					ja: '同じ期間の記録から、同じやり方で測ります。{secondary.country}の資産の値動きと為替の動きが、どれくらい一緒に動くかを −1〜1 で表します。正の値なら、{secondary.name}建てで値上がりするときに{secondary.name}高にもなりやすいということで、{primary.name}に直すと利益が二重に効きます。負の値なら、相場で得たぶんを為替が打ち消す関係です。使うお金は{primary.name}なので、外貨建ての資産を持つことが値動きを大きくするのか和らげるのかは、この数字で決まります。',
				},
			},
			{
				id: 'correlations.primaryFx',
				label: { en: 'corr({primary.code}, FX)', ja: '連動性：{primary.name}資産と為替' },
				unit: 'num',
				tip: {
					en: 'The same measure again, for {primary.code} assets against the same exchange rate. Home-market shares often move with the currency — an exporting index tends to do well when the home currency is weak, which reads as a negative here — so this is rarely 0, and setting it there quietly assumes an independence the market does not have.',
					ja: '同じ測り方を、{primary.country}の資産と同じ為替レートについて見たものです。自国の株は為替と連動しがちで、輸出企業の多い指数は自国通貨が安いときに伸びる傾向があります。それはこの欄では負の値にあたります。ですから0になることはまれで、0を入れると「相場と為替は無関係」という、実際には成り立たない前提を置くことになります。',
				},
			},
			{
				id: 'plan.montecarloPaths',
				label: { en: 'Monte Carlo paths', ja: '試行回数（モンテカルロ）' },
				unit: 'paths',
				tip: {
					en: 'How many random futures to simulate. More paths give smoother, steadier percentile bands but take longer to run; a few thousand is usually enough to stop the bands wobbling between runs.',
					ja: 'でたらめな相場を何通り作って試すかです。回数が多いほど帯はなめらかで安定しますが、計算に時間がかかります。数千回もあれば、実行するたびに帯が揺れることはなくなります。',
				},
			},
		],
	},
];

/* Populated from the plan document at startup. */
const BASE_PLAN = {};

/* ------------------------- claim-age fields ------------------------- */
const claimOptions = (spec) =>
	(Array.isArray(configValue(spec.list)) ? configValue(spec.list) : [])
		.filter((o) => o && isFinite(o.startAge) && isFinite(o.annual))
		.map((o) => [o.startAge, o.annual]);
/* An empty option list means no pension, so the field goes entirely — no row,
   no saved key, nothing init() insists on. Before FIELD_IDS is built. */
FIELDS.forEach((section) => {
	section.fields = section.fields.filter((field) => field.unit !== 'claim' || claimOptions(field.claim).length);
});
/* null is a real value here — no growth rate of its own — so init() must not
   report it missing. */
const NULLABLE_FIELDS = new Set([
	'primary.retirementAccountGrowthPct',
	'secondary.retirementAccountGrowthPct',
]);
const PERCENT_FIELDS = new Set();
/* Zero-or-more is the default; these are the exceptions: a gain ratio under
   water, the spending smile, deflation, a pessimistic return, and correlations,
   which are bounded on both sides. */
const FIELD_BOUNDS = {
	'primary.brokerageGainPct': [-Infinity, Infinity],
	'secondary.brokerageGainPct': [-Infinity, Infinity],
	'plan.annualSpendingChangePct': [-Infinity, Infinity],
	'plan.inflationPct': [-Infinity, Infinity],
	'primary.returnMeanPct': [-Infinity, Infinity],
	'secondary.returnMeanPct': [-Infinity, Infinity],
	'correlations.secondaryPrimary': [-1, 1],
	'correlations.secondaryFx': [-1, 1],
	'correlations.primaryFx': [-1, 1],
};
const fieldInRange = (id, v) => {
	const [lo, hi] = FIELD_BOUNDS[id] || [0, Infinity];
	return v >= lo && v <= hi;
};
const FIELD_IDS = [];
/* field id -> {list, role, opts, fmt}; the amount side of a claim-age field.
   `opts` is a snapshot of the configured list: refreshClaimFields() must run
   after the list changes. */
const CLAIM_FIELDS = {};
/* "Age 62 — $1,500/mo". The period is the one the provider's statement quotes, so
   the claim spec names it. */
const CLAIM_FMT = {
	month: {
		en: (age, amt, role) => `Age ${age} — ${formatMoney(amt / 12, role)}/mo`,
		ja: (age, amt, role) => `${age}歳 — 月${formatMoney(amt / 12, role)}`,
	},
	year: {
		en: (age, amt, role) => `Age ${age} — ${formatMoney(amt, role)}/yr`,
		ja: (age, amt, role) => `${age}歳 — 年${formatMoney(amt, role)}`,
	},
};
FIELDS.forEach((section) =>
	section.fields.forEach((field) => {
		FIELD_IDS.push(field.id);
		if (field.unit === 'pct') {
			PERCENT_FIELDS.add(field.id);
		}
		if (field.unit === 'claim') {
			CLAIM_FIELDS[field.id] = {
				list: field.claim.list,
				role: field.claim.role,
				opts: claimOptions(field.claim),
				fmt: CLAIM_FMT[field.claim.period],
			};
		}
	}),
);
function claimAmount(fieldId, startAge) {
	const spec = CLAIM_FIELDS[fieldId];
	if (!spec) {
		return 0;
	}
	const hit = spec.opts.find((o) => o[0] === startAge);
	return hit ? hit[1] : 0;
}
/* An unoffered age would be a pension worth nothing (claimAmount finds no entry),
   so it snaps to the first on offer. Both routes that can put one into MODEL — a
   loaded file, a list edited under a live selection — go through here. */
function listedClaimAge(fieldId, startAge) {
	const opts = (CLAIM_FIELDS[fieldId] || {}).opts || [];
	if (!opts.length) {
		return startAge;
	}
	return opts.some((o) => o[0] === startAge) ? startAge : opts[0][0];
}

/* ------------------------------------------------------------------ */
/* The store                                                          */
/* ------------------------------------------------------------------ */
/* A field id is a path — 'primary.brokerage' — and also the DOM id of its box
   (with a 'set:' prefix, of its box in the settings sheet). The dot means
   lookups anywhere go through getElementById or an attribute selector, never
   '#id'. */
const MODEL = {};
const VIEWS = {};
const registerView = (id, view) => (VIEWS[id] || (VIEWS[id] = [])).push(view);

function setField(view, v) {
	const raw = ungroupDigits(v);
	if (view.tagName === 'SELECT') {
		view.value = raw;
		return;
	}
	view.value = document.activeElement === view ? raw : groupDigits(raw);
}
/* Every view but the one being typed into: regrouping the digits under the
   cursor would fight it. */
function paintField(id, exceptEl) {
	for (const view of VIEWS[id] || []) {
		if (view !== exceptEl) {
			setField(view, getPath(MODEL, id));
		}
	}
}
/* A sidebar box names no aria-errormessage; only a settings row has one. */
function markInvalid(view, bad) {
	if (bad) {
		view.setAttribute('aria-invalid', 'true');
	} else {
		view.removeAttribute('aria-invalid');
	}
	if (view.hasAttribute('aria-errormessage')) {
		document.getElementById(view.getAttribute('aria-errormessage')).hidden = !bad;
	}
}
function markFieldBad(id, bad) {
	for (const view of VIEWS[id] || []) {
		markInvalid(view, bad);
	}
}
function fieldEdited(id, view) {
	const v = readNumber(view);
	/* An emptied box is accepted — it falls back to the plan file. An out-of-range
	   number is refused, and the previous value stays. */
	const ok = !isFinite(v) || fieldInRange(id, v);
	markFieldBad(id, !ok);
	if (!ok) {
		return;
	}
	setPath(MODEL, id, isFinite(v) ? v : undefined);
	paintField(id, view);
	if (sourcedPathFor(id)) {
		stampSource(id);
		paintSources();
	}
	onInput();
}

/* The fields the sidebar shows — the ones touched more than once a year;
   everything else lives only in the settings sheet. A hand-picked list: no rule
   on cadence or leverage gets both annualSpending and the balances right. */
const SIDEBAR_FIELDS = new Set([
	'secondary.brokerage',
	'secondary.brokerageGainPct',
	'secondary.retirementAccount',
	'primary.brokerage',
	'primary.brokerageGainPct',
	'primary.retirementAccount',
	'fx.rate',
	'plan.annualSpending',
	'plan.annualSpendingChangePct',
	'plan.mortgageAnnual',
	'plan.mortgagePayoffAge',
	'plan.earnedIncome',
	'plan.earnedIncomeEndAge',
	'secondary.pensionStartAge',
	'primary.pensionStartAge',
	'plan.currentAge',
	'plan.horizonEndAge',
	'secondary.scheduledRetirementDraw',
]);

/* ----------------------------- build form ----------------------------- */
const fieldLabel = (id, label, tip) =>
	el('label', { htmlFor: id, dataset: tip ? { tip: translate(tip) } : null }, translate(label));
const sidebar = document.getElementById('sidebar');
const fieldTable = el('table', { className: 'fields' });
const fieldBody = el('tbody');
FIELDS.forEach((section, sectionIndex) => {
	const shown = section.fields.filter((field) => SIDEBAR_FIELDS.has(field.id));
	if (!shown.length) {
		return;
	}
	fieldBody.appendChild(
		el(
			'tr',
			{},
			el('th', { className: 'caps', scope: 'rowgroup', colSpan: 3, dataset: { sec: sectionIndex } }, translate(section.title)),
		),
	);
	shown.forEach(({ id, label, unit, tip }) => {
		/* Option values are the ages, so a <select> reads and writes like any other field. */
		if (unit === 'claim') {
			const select = el(
				'select',
				{ dataset: { claim: CLAIM_FIELDS[id].list }, id },
				CLAIM_FIELDS[id].opts.map((o) =>
					el('option', { value: o[0] }, translate(CLAIM_FIELDS[id].fmt)(o[0], o[1], CLAIM_FIELDS[id].role)),
				),
			);
			registerView(id, select);
			select.addEventListener('change', () => fieldEdited(id, select));
			fieldBody.appendChild(
				el(
					'tr',
					{ className: 'claim', dataset: { fieldrow: id } },
					el('td', { colSpan: 3 }, el('div', { className: 'claim-row' }, fieldLabel(id, label, tip), select)),
				),
			);
			return;
		}
		/* data-unit carries the field id, not the unit: relabelForm() finds the cell
		   by it. */
		const row = el(
			'tr',
			{ dataset: { fieldrow: id } },
			el('th', { scope: 'row' }, fieldLabel(id, label, tip)),
			el('td', { className: 'unit', dataset: { unit: id } }, translate(UNITS[unit]) || ''),
		);
		/* type=text: a number input rejects a value with a thousands separator */
		const input = el('input', { type: 'text', inputMode: 'decimal', id });
		registerView(id, input);
		input.addEventListener('input', () => fieldEdited(id, input));
		input.addEventListener('focus', () => {
			input.value = ungroupDigits(input.value);
		});
		input.addEventListener('blur', () => {
			input.value = groupDigits(input.value);
		});
		row.appendChild(el('td', {}, input));
		fieldBody.appendChild(row);
	});
});
fieldTable.appendChild(fieldBody);
sidebar.appendChild(fieldTable);

function refreshClaimFields() {
	for (const [id, spec] of Object.entries(CLAIM_FIELDS)) {
		spec.opts = claimOptions(spec);
		const chosen = listedClaimAge(id, getPath(MODEL, id));
		setPath(MODEL, id, chosen);
		for (const select of VIEWS[id] || []) {
			select.textContent = '';
			for (const o of spec.opts) {
				select.appendChild(el('option', { value: o[0] }, translate(spec.fmt)(o[0], o[1], spec.role)));
			}
			select.value = ungroupDigits(chosen);
			/* In the sheet the cell goes, not the row it shares with the other
			   currency; in the sidebar the row is the control. */
			const holder = select.closest('.setting-control, [data-fieldrow]');
			if (holder) {
				holder.hidden = !spec.opts.length;
			}
		}
	}
}

/* In place, so a language switch never drops focus or a half-typed value. */
function relabelForm() {
	FIELDS.forEach((section, sectionIndex) => {
		const sectionHeading = fieldBody.querySelector('th[data-sec="' + sectionIndex + '"]');
		if (sectionHeading) {
			sectionHeading.textContent = translate(section.title);
		}
		section.fields.forEach(({ id, label, unit, tip }) => {
			const labelElement = fieldBody.querySelector('label[for="' + id + '"]');
			if (labelElement) {
				labelElement.textContent = translate(label);
				if (tip) {
					labelElement.dataset.tip = translate(tip);
				}
			}
			const u = fieldBody.querySelector('td[data-unit="' + id + '"]');
			if (u) {
				u.textContent = translate(UNITS[unit]) || '';
			}
		});
	});
}

wireTips(sidebar);

/* ----------------------------- persistence ----------------------------- */
/* An absent or unparseable value falls back to the plan document, which init()
   has checked supplies every field. */
function readForm() {
	const o = {};
	for (const k of FIELD_IDS) {
		const v = getPath(MODEL, k);
		setPath(o, k, v == null || !isFinite(v) ? getPath(BASE_PLAN, k) : v);
	}
	return o;
}
/* Arrays are leaves — the two pension option lists travel whole. */
function flatten(o, prefix, out) {
	out = out || {};
	for (const k of Object.keys(o || {})) {
		const v = o[k],
			path = prefix ? prefix + '.' + k : k;
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			flatten(v, path, out);
		} else {
			out[path] = v;
		}
	}
	return out;
}
function writeForm(o) {
	for (const k of FIELD_IDS) {
		const given = o ? getPath(o, k) : undefined;
		const v = given != null ? given : getPath(BASE_PLAN, k);
		setPath(MODEL, k, k in CLAIM_FIELDS ? listedClaimAge(k, v) : v);
		paintField(k);
	}
}
