'use strict';

/* ------------------------------------------------------------------ */
/* Settings sheet                                                     */
/* ------------------------------------------------------------------ */
/* A row in SETTINGS is one of three shapes: a string names a field, taken from
   FIELDS; an object describes a setting with no field — see "settings that are
   not fields" below; an array [primary, secondary, label, tip?] pairs two of
   those in one row, one box per currency, in a section whose `cols` are the
   column headings. */
const FIELD_BY_ID = {};
FIELDS.forEach((section) => section.fields.forEach((field) => (FIELD_BY_ID[field.id] = field)));

/* Column headings, primary first. The currencies section uses the role names:
   it is where the countries are defined, so a heading naming one would point at
   an answer given two rows below. */
const PAIR_COLS = ['{primary.country}', '{secondary.country}'];
const ROLE_COLS = [
	{ en: 'Primary', ja: '主通貨' },
	{ en: 'Secondary', ja: '副通貨' },
];

const SETTINGS = [
	{
		open: true,
		title: { en: 'Your accounts', ja: '口座の残高' },
		note: {
			en: 'Add up everything you hold in each currency and enter the totals — several brokerage accounts become one figure, and so do several retirement accounts. These are worth refreshing often: monthly, or whenever you happen to look.',
			ja: 'それぞれの通貨で持っているものを合計して入れてください。証券口座がいくつかあればひとつにまとめ、退職・年金口座も同じようにまとめます。毎月など、こまめに更新する価値があるのはここです。',
		},
		cols: PAIR_COLS,
		rows: [
			[
				'primary.brokerage',
				'secondary.brokerage',
				{ en: 'Brokerage balance', ja: '証券口座の残高' },
			],
			[
				'primary.brokerageGainPct',
				'secondary.brokerageGainPct',
				{ en: 'Brokerage gain ratio', ja: '証券口座の含み益の割合' },
			],
			[
				'primary.retirementAccount',
				'secondary.retirementAccount',
				{ en: 'Retirement account', ja: '退職・年金口座' },
			],
			'fx.rate',
		],
	},
	{
		open: true,
		title: { en: 'Your spending and income', ja: '支出と収入' },
		note: {
			en: 'These are yours to decide rather than to look up, but a year of bank or card statements is the honest place to start — what you actually spent beats what you meant to. All in today’s money, in the currency you live in. Spending is the single biggest lever in the whole model.',
			ja: 'ここは調べて写す値ではなく、自分で決める値です。ただし、まずは1年ぶんの銀行やカードの明細を見て、実際に使った額から始めるのが確実です。「使うつもりの額」より当てになります。すべて今の物価に直した金額で、生活している通貨で入れてください。生活費はこのモデルで最も効く数字です。',
		},
		rows: [
			'plan.annualSpending',
			'plan.annualSpendingChangePct',
			'plan.mortgageAnnual',
			'plan.mortgagePayoffAge',
			'plan.earnedIncome',
			'plan.earnedIncomeEndAge',
		],
	},
	{
		title: { en: 'Your ages and strategy', ja: '年齢と引き出し方針' },
		note: {
			en: 'All three are yours to set — no statement or authority supplies them. They decide how long the money has to last and how much comes out on a schedule rather than on demand.',
			ja: '3つとも自分で決める値です。明細にも法令にも載っていません。お金が何年もつ必要があるか、そして必要かどうかに関わらず毎年いくら引き出すかを決めます。',
		},
		rows: ['plan.currentAge', 'plan.horizonEndAge', 'secondary.scheduledRetirementDraw'],
	},
	{
		title: { en: 'Your pensions', ja: '公的年金' },
		note: {
			en: 'Both come off a benefit projection you request from the scheme itself: ssa.gov/myaccount for a US Social Security estimate, Nenkin Net for a Japanese one. Each quotes a benefit per claim age, so the age is what you choose and the amount is looked up beside it.',
			ja: 'どちらも、制度そのものが出す見込額から写します。米国のソーシャルセキュリティなら ssa.gov/myaccount、日本の公的年金なら「ねんきんネット」です。どちらも「何歳から受け取るか」ごとに金額が示されるので、選ぶのは年齢だけで、金額はそこから引かれます。',
		},
		cols: PAIR_COLS,
		rows: [
			['primary.pensionStartAge', 'secondary.pensionStartAge', { en: 'Claim age', ja: '受給を始める年齢' }],
			...[
				{
					prop: 'pensionOptions',
					kind: 'list',
					list: 'options',
					rows: 4,
					label: { en: 'Age and amount, one pair per line', ja: '年齢と金額（1行に1組）' },
					tip: PAIRED_TIPS.pensionOptions,
				},
			].map((row) => [
				{ ...row, path: 'primary.' + row.prop },
				{ ...row, path: 'secondary.' + row.prop },
				row.label,
				row.tip,
			]),
		],
	},
	{
		title: { en: 'Your tax rates', ja: '実効税率' },
		note: {
			en: 'Estimates you make, not figures to copy: an effective rate is what you end up paying across the whole amount, which no table states directly. Work each one out from last year’s return — tax paid ÷ income of that kind — or from your bracket, and revisit when your circumstances change rather than on any schedule.',
			ja: 'ここは写す値ではなく、自分で見積もる値です。「実効税率」は、段階的にかかる税をならして「結局、全体の何％を払うことになるか」を表した数字で、税率表にそのまま載っているものではありません。前年の確定申告から「その種類の所得に払った税額 ÷ その所得」で求めるか、自分の税率区分から見積もってください。決まった時期ではなく、状況が変わったときに見直します。',
		},
		cols: PAIR_COLS,
		rows: [
			[
				'primary.retirementAccountTaxPct',
				'secondary.retirementAccountTaxPct',
				{ en: 'Retirement account withdrawals', ja: '退職・年金口座からの引き出し' },
			],
			'plan.pensionTaxPct',
			'plan.earnedIncomeTaxPct',
		],
	},
	{
		title: { en: 'How your retirement accounts behave', ja: '退職・年金口座の決まり' },
		note: {
			en: 'The two retirement accounts only — a brokerage account has neither of these, since you can sell from it at any age. The two rows come from different places: the age is set by law, so the tax authority states it, while the growth rate is your provider’s. Both are checked when your circumstances change rather than on any schedule.',
			ja: 'ここは退職・年金口座だけの設定です。ふつうの証券口座はいつでも売れるので、どちらの項目もありません。2つの行は出どころが違います。年齢は法律で決まっているので税務当局が示すもの、利回りは運営会社が示すものです。どちらも決まった時期ではなく、状況が変わったときに見直します。',
		},
		cols: PAIR_COLS,
		rows: [
			[
				'primary.retirementAccountAccessAge',
				'secondary.retirementAccountAccessAge',
				{ en: 'Earliest age it can be drawn', ja: '受け取り始められる年齢' },
			],
			[
				'primary.retirementAccountGrowthPct',
				'secondary.retirementAccountGrowthPct',
				{ en: 'Growth, if it does not track the market', ja: '市場に連動しない場合の利回り' },
			],
		],
	},
	{
		prompts: ['measured', 'assumptions'],
		title: { en: 'Market assumptions', ja: '市場の前提' },
		note: {
			en: 'Not facts, and not yours either — these come from published capital-market assumptions and from measured market history. The prompts at the end of this section will fetch them for you. This is the arguable part of the model, which is why the sensitivity grid exists: two points on a mean return is the difference between a plan that works and one that does not.',
			ja: 'ここは事実でもなく、自分で決める値でもありません。公表されている市場前提や、実際の相場の記録から取ってきます。この区分の最後にあるプロンプトを使えば、AIに調べてもらえます。意見の分かれる部分なので、だからこそ感度分析の表があります。平均利回りが2ポイント違えば、計画が成り立つかどうかが変わります。',
		},
		cols: PAIR_COLS,
		rows: [
			['primary.returnMeanPct', 'secondary.returnMeanPct', { en: 'Mean return', ja: '平均利回り' }],
			[
				'primary.returnVolatilityPct',
				'secondary.returnVolatilityPct',
				{ en: 'Volatility', ja: '変動の大きさ' },
			],
			'fx.volatilityPct',
			'plan.inflationPct',
			'correlations.secondaryPrimary',
			'correlations.secondaryFx',
			'correlations.primaryFx',
		],
	},
	{
		prompts: ['statute'],
		title: { en: 'Statute', ja: '法令で決まる値' },
		note: {
			en: 'Copied from the tax authorities named below, as the rules stood on the day you copied them. They go out of date silently — a three-year-old rate looks exactly like a current one, and nothing on screen tells you which you have — which is why each carries the date it was last checked.',
			ja: '下に挙げた税務当局から、写した日の内容をそのまま入れたものです。こうした値は黙って古くなります。3年前の税率も今の税率も見た目は同じで、どちらなのか画面のどこにも出ません。だからこそ、それぞれに最後に確認した日付を持たせてあります。',
		},
		cols: PAIR_COLS,
		/* `needs` lists the kinds that use a part; a cell whose kind does not is
		   hidden — see showApplicableCells. */
		rows: [
			'plan.capitalGainsTaxPct',
			...[
				{
					prop: 'kind',
					kind: 'choice',
					options: 'compulsory',
					label: { en: 'Compulsory distribution', ja: '強制的な引き出しの制度' },
					tip: {
						en: 'Which rule the country holding this retirement account imposes, if any — the tax authority there is the source. Two shapes exist. A minimum each year takes a fraction of the balance, set by a divisor that tracks life expectancy, so the account is drawn down but never emptied: the US required minimum distribution (RMD) works this way. A payout over a fixed term instead names a deadline to begin by and a number of years to spread the whole balance across, so the account is empty at the end of them: a Japanese defined-contribution plan works this way. Choose “none” where the country has no such rule, and nothing is ever forced out of that account.',
						ja: 'この退職・年金口座がある国が、どの制度を課しているかを選びます。出どころはその国の税務当局です。形は2つあります。「毎年の最低引き出し」は残高の一定割合を引き出させるもので、その割合は平均余命に沿った係数で決まるため、口座は減っていきますが空にはなりません。米国のRMD（最低引き出し義務）がこれです。「一定年数で全額受け取り」は、始める期限と、残高を何年に分けるかを決めるもので、その年数が終わると口座は空になります。日本の確定拠出年金がこれです。そうした制度のない国なら「なし」を選んでください。その口座からは何も強制的に引き出されません。',
					},
				},
				{
					prop: 'startAge',
					kind: 'num',
					unit: 'age',
					needs: ['payout'],
					label: { en: 'Begins at age', ja: '始まる年齢' },
					tip: {
						en: 'The latest age receipt may begin — 75 for a Japanese defined-contribution plan, with the choice of starting any time from 60. Miss that deadline and the instalment right is lost and the balance is paid as one lump sum. A minimum each year has no field of its own here: it begins at the first row of its table, which is the same fact written once instead of twice.',
						ja: '受け取りを始めなければならない期限の年齢です。日本の確定拠出年金なら75歳で、60歳からいつ始めてもかまいません。この期限を過ぎると分割で受け取る権利がなくなり、残高すべてが一時金として支払われます。「毎年の最低引き出し」にはこの欄がありません。そちらは係数表のいちばん上の行から始まります。同じことを二度書かずに済ませるためです。',
					},
				},
				{
					prop: 'divisors',
					kind: 'list',
					list: 'table',
					rows: 6,
					needs: ['rmd'],
					label: { en: 'Divisor table', ja: '係数表' },
					tip: {
						en: 'One line per age: the age, then its divisor. The year’s minimum is the account balance divided by the divisor for your age, and an age past the last row uses that row. For a US account this is the Internal Revenue Service (IRS) Uniform Lifetime Table. Keep it trimmed to the ages that apply to you: the first row here is the age distributions begin, so with a start age of 75 the published rows for 72, 73 and 74 are noise. The authority publishes them because the table serves every birth cohort at once. A refresh that brings them back drops them again rather than moving your first row — editing this box by hand does not, because then the first line you write is the age you are choosing.',
						ja: '1行につき「年齢」と「その年齢の係数」です。その年の最低引き出し額は「口座の残高 ÷ その年齢の係数」で、表の最後の行より上の年齢は最後の行を使います。米国の口座なら、内国歳入庁（IRS）が公表しているUniform Lifetime Tableがこれにあたります。自分に当てはまる年齢だけに絞って入れてください。ここのいちばん上の行が、引き出しが始まる年齢そのものです。開始年齢が75歳なら、公表されている72・73・74歳の行は不要です。当局がその行も載せているのは、この表がすべての世代を一度に扱うからです。プロンプトで取り込んだ表にその行が含まれていた場合は自動で落とし、いちばん上の行は動かしません。手で書き換えたときは落としません。そのときは、書いた最初の行が自分で選んだ年齢だからです。',
					},
				},
				{
					prop: 'overYears',
					kind: 'num',
					unit: 'years',
					needs: ['payout'],
					label: { en: 'Spread over', ja: '分ける年数' },
					tip: {
						en: 'How many years the balance is spread across once payouts begin. Japan’s pension law bounds this at five to twenty years and your plan’s 規約 fixes the range within that, so read it off the plan rather than choosing freely. Unlike a divisor table this empties the account: the last year takes whatever is left. Setting it to 1 models the lump sum, which is what happens if the deadline above is missed.',
						ja: '受け取りを始めたあと、残高を何年に分けて受け取るかです。日本の確定拠出年金法の範囲は5年以上20年以下で、その中のどこまで選べるかは加入している制度の規約で決まっています。自由に決める値ではなく、規約から読み取ってください。係数表と違い、この方式は口座を空にします。最後の年に残りをすべて受け取ります。1にすると一時金での受け取りになり、これは上の期限を過ぎた場合に起きることでもあります。',
					},
				},
			].map((row) => [
				{ ...row, path: 'primary.compulsory.' + row.prop, role: 'primary' },
				{ ...row, path: 'secondary.compulsory.' + row.prop, role: 'secondary' },
				row.label,
				row.tip,
			]),
		],
	},
	{
		title: { en: 'Countries & currencies', ja: '国と通貨' },
		note: {
			en: 'Nothing to look up here: you are naming the two currencies this plan is for, and the page takes every label from what you write. No country or currency is named anywhere else in it, so changing a word here relabels the whole page as you type. Decided once.',
			ja: 'ここに調べて写す値はありません。この計画が対象とする2つの通貨を、自分で名付ける場所です。画面のラベルはすべてここに書いた言葉から作られます。ページ側には国名も通貨名も一切書かれていないので、ここの言葉を変えると、入力しただけでページ全体の表示が変わります。最初に一度決めるだけです。',
		},
		cols: ROLE_COLS,
		rows: [
			{
				prop: 'code',
				kind: 'text',
				label: { en: 'Currency code', ja: '通貨コード' },
				tip: {
					en: 'The standard three-letter code — USD, JPY. Used where a label has no room for a name: “corr(USD, JPY)”, “FX (JPY per USD)”.',
					ja: '通貨の標準的な3文字コードです（USD、JPY など）。名前を書く余裕のないラベルで使います（「corr(USD, JPY)」「為替レート（1ドル＝何円）」など）。',
				},
			},
			{
				prop: 'symbol',
				kind: 'text',
				label: { en: 'Symbol', ja: '通貨記号' },
				tip: {
					en: 'The character money is written with — ¥, $. Typed in rather than derived from the code above, because the browser’s own formatter returns the full-width ￥ in Japanese instead of the ¥ used everywhere else: a different glyph, at a different width, in a monospace column, appearing the moment you switch language. Several currencies (CHF, SGD) have no symbol there at all.',
					ja: '金額の前に付ける記号です（¥、$ など）。上のコードから自動で導かず、ここで指定します。ブラウザ自身の書式機能を使うと、日本語では他の箇所で使っている「¥」ではなく全角の「￥」が返ってきます。字形も幅も違うものが、言語を切り替えた瞬間に等幅の数字の列に混ざることになります。CHFやSGDのように、そこに記号が用意されていない通貨もあります。',
				},
			},
			{
				prop: 'name',
				kind: 'pair',
				label: { en: 'Currency name', ja: '通貨の呼び名' },
				tip: {
					en: 'The word for the money itself — "yen", "dollars". Used in prose and in the Japanese half of labels where the code would read badly.',
					ja: 'お金そのものの呼び名です（「円」「ドル」）。文章の中や、コードでは読みにくい日本語のラベルで使います。',
				},
			},
			{
				prop: 'country',
				kind: 'pair',
				label: { en: 'Country', ja: '国名' },
				tip: {
					en: 'The jurisdiction, as it reads in brackets: "Capital-gains rate (Japan)". So "US", not "the US" — prose that needs the article writes it.',
					ja: '国や地域の名前です。「株の譲渡益税率（日本）」のように括弧に入って出てくる形で入れてください。英語では冠詞を含めず "US" のように書きます。冠詞が必要な文章の側で付けます。',
				},
			},
			{
				prop: 'adjective',
				kind: 'pair',
				label: { en: 'Adjective', ja: '「〜の」の形' },
				tip: {
					en: 'The form that describes something belonging to that country — "Japanese brokerage", "your Japanese broker statement". An account takes this; a jurisdiction in brackets takes the country above.',
					ja: 'その国のものであることを表す形です（「日本の証券口座」など）。口座の名前にはこちらを使い、括弧に入る法令の管轄には上の国名を使います。日本語では「の」まで含めて入れてください。',
				},
			},
			{
				prop: 'bigUnit.factor',
				kind: 'num',
				unit: 'divisor',
				label: { en: 'Large-figure divisor', ja: '大きい金額の単位' },
				tip: {
					en: 'Your choice of reading scale: what the headline figures are divided by so they stay legible. 100000000 for yen read in 億, 1000000 for dollars read in millions.',
					ja: '大きな金額をどの単位で読みたいか、という好みの問題です。見出しの金額をこの数で割って表示します。円を「億」で読むなら100000000、ドルを「百万」で読むなら1000000。',
				},
			},
			{
				prop: 'bigUnit.label',
				kind: 'pair',
				label: { en: 'Large-figure suffix', ja: '大きい金額の単位の表記' },
				tip: {
					en: 'What is printed after a divided figure — 億, or M. Allowed to be the same in both languages, unlike the names above; 億 is 億 either way.',
					ja: '割ったあとの数字のうしろに付ける表記です（「億」や「M」）。上の呼び名と違い、両方の言語で同じでも構いません。「億」はどちらでも「億」です。',
				},
			},
			{
				prop: 'bigUnit.decimals',
				kind: 'num',
				unit: 'digits',
				label: { en: 'Large-figure decimals', ja: '大きい金額の小数桁' },
				tip: {
					en: 'Your choice again: how many decimal places a divided figure keeps. 2 gives 2.69億.',
					ja: 'これも好みです。割ったあとの数字を小数第何位まで出すかを決めます。2なら「2.69億」になります。',
				},
			},
		].map((row) => [
			{ ...row, path: 'currencies.primary.' + row.prop },
			{ ...row, path: 'currencies.secondary.' + row.prop },
			row.label,
			row.tip,
		]),
	},
	{
		title: { en: 'Simulation & analysis', ja: 'シミュレーションと分析' },
		note: {
			en: 'Nothing to look up here either: these are choices about how the panels are drawn and how the simulation is run, not facts about your plan. The values already here are sensible — change one only when you want a different view. Decided once.',
			ja: 'ここにも調べて写す値はありません。あなたの計画そのものではなく、各パネルの描き方と計算の走らせ方をどうするか、という選び方の設定です。今入っている値のままで問題ありません。別の見方をしたいときだけ変えてください。最初に一度決めるだけです。',
		},
		rows: [
			{
				path: 'comparison.spendStepPct',
				kind: 'num',
				unit: 'pct',
				label: { en: 'Spending comparison step', ja: '生活費の比較幅' },
				tip: {
					en: 'The survival chart draws your plan with spending this much lower and this much higher, from the same market paths, so the gap between the three curves is the spending decision alone with no sampling noise in it.',
					ja: '資金が尽きない確率のグラフに、生活費をこの割合だけ減らした場合と増やした場合の線を重ねて描きます。相場の道筋は同じものを使うので、3本の差は生活費の違いだけによるもので、乱数のばらつきは混ざりません。',
				},
			},
			{
				path: 'comparison.sequenceYears',
				kind: 'num',
				unit: 'years',
				label: { en: 'Early-years window', ja: '「出だし」とみなす年数' },
				tip: {
					en: 'Your definition of “early”: how many years count as the opening stretch when the same paths are re-sorted into the worst quarter, the middle half and the best quarter by how their start went. Ten years is a common reading of sequence-of-returns risk.',
					ja: '「出だし」を何年とみなすか、という定義を自分で決める欄です。同じシミュレーションを出だしの成績で並べ替えて、悪かった4分の1・真ん中の半分・良かった4分の1に分けるときに使います。リタイア直後の相場の影響を見るには10年あたりがよく使われます。',
				},
			},
			{
				path: 'sensitivity.returnStepsPct',
				kind: 'list',
				list: 'steps',
				unit: 'steps',
				label: { en: 'Sensitivity — return steps', ja: '感度分析 — 利回りの刻み' },
				tip: {
					en: 'How far either side of your own mean return to probe — the rows of the sensitivity grid, in percentage points. Must include 0, since that row is the plan exactly as configured and is where the outlined cell sits.',
					ja: '入力した平均利回りから、上下どこまで振って試すかを自分で決めます。感度分析の表の縦の並びで、単位はポイントです。0を必ず含めてください。その行が入力どおりの計画で、枠で囲んだマスがある行です。',
				},
			},
			{
				path: 'sensitivity.fxStepsPct',
				kind: 'list',
				list: 'steps',
				unit: 'steps',
				label: { en: 'Sensitivity — FX steps', ja: '感度分析 — 為替の刻み' },
				tip: {
					en: 'The columns of the same grid, as percentages either side of the foreign-exchange (FX) rate you entered. Must include 0, for the same reason.',
					ja: '同じ表の横の並びです。入力した為替（FX＝外国為替）レートから何％離すかを並べます。同じ理由で0を必ず含めてください。',
				},
			},
			{
				path: 'successThresholdsPct.good',
				kind: 'num',
				unit: 'pct',
				label: { en: 'Success shown green at', ja: '緑で表示する成功率' },
				tip: {
					en: 'At or above this, the headline success figure is green. Where you put it is a judgement about how much certainty you want, not a fact about the plan.',
					ja: 'この値以上なら、見出しの成功率を緑で表示します。どこに置くかは「どれくらいの確実さを求めるか」という判断で、計画そのものの性質ではありません。',
				},
			},
			{
				path: 'successThresholdsPct.fair',
				kind: 'num',
				unit: 'pct',
				label: { en: 'Success shown amber at', ja: '黄色で表示する成功率' },
				tip: {
					en: 'The other end of the same judgement: amber down to this, red below it.',
					ja: '同じ判断のもう一方の境目です。この値までは黄色、それより下は赤で表示します。',
				},
			},
			{
				path: 'simulation.seed',
				kind: 'num',
				unit: 'num',
				label: { en: 'Random seed', ja: '乱数の出発点' },
				tip: {
					en: 'Any number will do — it just fixes the random draw. Because it is fixed, the same inputs always give the same answer, so a figure you read once is the figure you get back and the comparison curves draw from the same market paths. Change it to resample: a different seed is a different set of imagined futures with the same statistics.',
					ja: 'どんな数字でも構いません。乱数の出発点を決めるだけの値です。固定してあるので、同じ入力なら必ず同じ答えになります。一度読んだ数字が次も同じで、比較用の線も同じ相場の道筋から描かれます。この値を変えると引き直せます。統計的な性質は同じで、想定する未来の組み合わせだけが変わります。',
				},
			},
			{
				path: 'staleAfterMonths',
				kind: 'num',
				unit: 'months',
				label: { en: 'Flag a copied figure after', ja: '写した値を古いと見なす月数' },
				tip: {
					en: 'How many months a figure taken from somewhere else may go unchecked before this panel marks it. It applies to the statutory rates, the required-minimum-distribution table, the market assumptions and the benefit figures — the values that are copies rather than yours, and that go out of date without looking any different. Twelve is a sensible setting: tax law and published capital-market assumptions both move on roughly annual cycles.',
					ja: 'ほかから写してきた値を、何か月確認しないままだとこのパネルで印を付けるかを決めます。対象は法令で決まる税率、最低引き出し義務の係数表、市場の前提、年金の見込額など、「自分で決めたのではなく写した値」です。こうした値は古くなっても見た目が変わりません。税制も、公表される市場前提も、だいたい1年周期で動くので、12か月が妥当です。',
				},
			},
			'plan.montecarloPaths',
			{
				path: 'simulation.minPaths',
				kind: 'num',
				unit: 'paths',
				label: { en: 'Minimum paths', ja: '試行回数の下限' },
				tip: {
					en: 'A safety floor you set once: however low the count above goes, the run never drops below this. Too few paths and the percentile bands are noise rather than a result.',
					ja: '一度決めておく下限です。すぐ上の試行回数をいくら小さくしても、これより下では計算しません。回数が少なすぎると、帯の形は結果ではなく、ただのばらつきになってしまいます。',
				},
			},
		],
	},
];

/* ---------------------- settings that are not fields ---------------------- */
/* A setting with no field lives in one of the two documents and nowhere else.
   `kind` says how it is presented: 'num' and 'text' a single box; 'choice' a
   dropdown over CHOICES[options]; 'pair' the two halves of a translated string;
   'list' a textarea (or a single line — see LIST_KINDS), parsed and formatted per
   `list`. */

const CHOICES = { compulsory: COMPULSORY_KINDS };
const CHOICE_LABELS = {
	'compulsory.none': UI.compulsoryNone,
	'compulsory.rmd': UI.compulsoryRmd,
	'compulsory.payout': UI.compulsoryPayout,
};
/* `oneLine` marks a list that stays one line, drawn as an input; the others need
   a textarea. */
const LIST_KINDS = {
	steps: {
		oneLine: true,
		format: (v) => (v || []).join(', '),
		parse: (t) => t.split(',').map((x) => Number(x.trim())),
	},
	options: {
		format: (v) => (v || []).map((o) => o.startAge + '\t' + o.annual).join('\n'),
		parse: (t) =>
			t
				.split('\n')
				.filter((l) => l.trim())
				.map((l) => {
					const [a, b] = l.trim().split(/[\s,]+/);
					return { startAge: Number(a), annual: Number(b) };
				}),
	},
	table: {
		format: (v) =>
			Object.keys(v || {})
				.map(Number)
				.sort((a, b) => a - b)
				.map((a) => a + '\t' + v[a])
				.join('\n'),
		parse: (t) => {
			const o = {};
			for (const l of t.split('\n')) {
				if (!l.trim()) {
					continue;
				}
				const [a, b] = l.trim().split(/[\s,]+/);
				o[Number(a)] = Number(b);
			}
			return o;
		},
	},
};

/* path -> [controls], the same arrangement VIEWS has for fields. */
const SETTING_VIEWS = {};
const SETTING_BY_PATH = {};

const settingsBody = document.getElementById('settings-body');

function unitCell(control, unit) {
	control.prepend(el('span', { className: 'unit', dataset: { unit: unit || 'num' } }));
}

function fieldCell(id) {
	const { unit, claim } = FIELD_BY_ID[id];
	const control = el('div', { className: 'setting-control' });
	const view =
		unit === 'claim'
			? el('select', { dataset: { claim: claim.list }, id: 'set:' + id })
			: el('input', { type: 'text', inputMode: 'decimal', id: 'set:' + id });
	control.appendChild(view);
	if (unit !== 'claim') {
		unitCell(control, unit);
	}
	registerView(id, view);
	if (unit === 'claim') {
		view.addEventListener('change', () => fieldEdited(id, view));
	} else {
		view.addEventListener('input', () => fieldEdited(id, view));
		view.addEventListener('focus', () => (view.value = ungroupDigits(view.value)));
		view.addEventListener('blur', () => (view.value = groupDigits(view.value)));
	}
	return control;
}

function settingCell(desc) {
	SETTING_BY_PATH[desc.path] = desc;
	const control = el('div', {
		className: 'setting-control',
		dataset: desc.needs ? { needs: desc.needs.join(' '), role: desc.role } : null,
	});
	const domId = 'set:' + desc.path;
	const wire = (view, path) => {
		(SETTING_VIEWS[path] || (SETTING_VIEWS[path] = [])).push(view);
		view.addEventListener('input', () => settingEdited(path, view, desc));
	};
	if (desc.kind === 'choice') {
		/* No data-claim: the stylesheet and the tests find claim-age dropdowns by it. */
		const select = el(
			'select',
			{ id: domId },
			CHOICES[desc.options].map((k) => el('option', { value: k, dataset: { choice: desc.options + '.' + k } })),
		);
		control.appendChild(select);
		(SETTING_VIEWS[desc.path] || (SETTING_VIEWS[desc.path] = [])).push(select);
		select.addEventListener('change', () => settingEdited(desc.path, select, desc));
		return control;
	}
	if (desc.kind === 'pair') {
		for (const languageCode of ['en', 'ja']) {
			const tag = el('span', { className: 'unit' }, SYMBOLS.languageTag[languageCode]);
			const input = el('input', { type: 'text', id: languageCode === 'en' ? domId : null });
			control.appendChild(tag);
			control.appendChild(input);
			wire(input, desc.path + '.' + languageCode);
		}
		return control;
	}
	const oneLine = desc.kind === 'list' && LIST_KINDS[desc.list].oneLine;
	const view =
		desc.kind === 'list' && !oneLine
			? el('textarea', { id: domId, rows: desc.rows || 3 })
			: el('input', {
					id: domId,
					type: 'text',
					className: oneLine ? 'wide' : null,
					inputMode: desc.kind === 'num' ? 'decimal' : null,
				});
	if (desc.kind === 'num') {
		view.addEventListener('focus', () => (view.value = ungroupDigits(view.value)));
		view.addEventListener('blur', () => (view.value = groupDigits(view.value)));
	}
	control.appendChild(view);
	unitCell(control, desc.unit);
	wire(view, desc.path);
	return control;
}

/* The rows of SETTINGS in one normalised shape — see normalizeRow. `sources` is
   a list: the two halves of a paired row are sourced separately. */
const ROWS = [];
const pathOf = (cell) => (typeof cell === 'string' ? cell : cell.path);
/* A field can be absent — a claim age with an empty option list is dropped from
   FIELDS — and must cost its column, not the page. */
const cellExists = (cell) => typeof cell !== 'string' || !!FIELD_BY_ID[cell];
function normalizeRow(spec) {
	const cells = Array.isArray(spec) ? [spec[0], spec[1]] : [spec];
	const live = cells.filter(cellExists);
	if (!live.length) {
		return null;
	}
	const own = (cell) =>
		typeof cell === 'string'
			? { label: FIELD_BY_ID[cell].label, tip: FIELD_BY_ID[cell].tip }
			: { label: cell.label, tip: cell.tip };
	return {
		cells,
		live,
		label: Array.isArray(spec) ? spec[2] : own(live[0]).label,
		tip: (Array.isArray(spec) ? spec[3] : null) || own(live[0]).tip,
		sources: [...new Set(live.map((c) => sourcedPathFor(pathOf(c))).filter(Boolean))],
	};
}

function settingsRow(spec, cols) {
	const row = normalizeRow(spec);
	if (!row) {
		return null;
	}
	row.cols = cols || [];
	const path = pathOf(row.live[0]);
	/* An absent cell still takes its column, empty, so the one beside it stays
	   under the right heading. */
	const rowElement = el(
		'div',
		{ className: 'setting-row', dataset: { row: ROWS.push(row) - 1 } },
		el('label', { htmlFor: 'set:' + path }),
		row.cells.map((cell) =>
			!cellExists(cell) ? el('div', { className: 'setting-control' }) : typeof cell === 'string' ? fieldCell(cell) : settingCell(cell),
		),
		el('p', { className: 'note danger', id: 'rejected:' + path, hidden: true }),
		el('p', { className: 'note', id: 'describe:' + path }),
		row.sources.map((src) => el('p', { className: 'note', dataset: { src } })),
	);
	/* Both boxes of a paired row point at the row's one description and rejection
	   message; markInvalid() looks the message up through this id. */
	for (const control of rowElement.querySelectorAll('input, select, textarea')) {
		control.setAttribute('aria-describedby', 'describe:' + path);
		control.setAttribute('aria-errormessage', 'rejected:' + path);
	}
	return rowElement;
}
/* ------------------------------- the prompts ------------------------------- */
const PROMPTS = {
	statute: {
		paths: ['plan.capitalGainsTaxPct', 'secondary.compulsory', 'primary.compulsory'],
		title: { en: 'Ask an AI to check the statutory figures', ja: '法令で決まる値をAIに確認してもらう' },
		blurb: {
			en: 'These two have correct answers, so the reply should be checkable against the source it cites. The prompt tells it to leave a figure out rather than guess at one.',
			ja: 'この2つには正解があるので、返ってきた答えは示された出典で確かめられるはずです。確認できなかった値は推測で埋めず省くよう指示してあります。',
		},
		body: {
			en:
				'I keep a retirement plan for a {secondary.adjective} citizen living in {primary.country}, and\n' +
				'three of its figures are statutory. Please check each against primary sources and tell\n' +
				'me the current values.\n\n' +
				'1. The tax on capital gains from listed securities for a resident of {primary.country},\n' +
				'   as a single effective percentage. My plan currently uses {plan.capitalGainsTaxPct}%.\n' +
				'2. The required-minimum-distribution rules for a pre-tax {secondary.adjective} retirement\n' +
				'   account: the age they begin for someone born in 1960 or after, and the full\n' +
				'   divisor table from that age onward — I do not need the rows below it.\n' +
				'   My plan currently has {secondary.compulsory}.\n' +
				'3. The compulsory payout rules for a {primary.adjective} defined-contribution pension:\n' +
				'   the latest age receipt must begin, and the range of years the balance may be\n' +
				'   spread over. My plan currently has {primary.compulsory}.\n\n' +
				'Rules. Cite a primary source — the tax authority or the statute itself, not a summary\n' +
				'site. Give the date you checked it. If you cannot verify a figure, say so and leave it\n' +
				'out rather than giving me your best guess: I would rather keep a value I know is old\n' +
				'than take one that might be invented.\n\n' +
				'Reply with a short note on what changed and why, then this file on its own, in a code\n' +
				'block, with no other keys:\n\n' +
				'window.RETIREMENT_REFRESH = {\n' +
				'  "plan.capitalGainsTaxPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "secondary.compulsory": { "value": { "kind": "rmd", "startAge": 0, "divisors": { "72": 0 } }, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "primary.compulsory": { "value": { "kind": "payout", "startAge": 0, "overYears": 0 }, "url": "", "asOf": "YYYY-MM-DD" }\n' +
				'};\n\n' +
				'Omit any entry you could not verify.',
			ja:
				'{primary.country}に住む{secondary.country}籍の人のリタイア計画を管理しています。そのうち2つの値は\n' +
				'法令で決まるものです。一次情報にあたって、今の値を教えてください。\n\n' +
				'1. {primary.country}の居住者が上場株式等の譲渡益に対して負担する税率（合計の実効税率として\n' +
				'   1つの％で）。今の計画では {plan.capitalGainsTaxPct}% を使っています。\n' +
				'2. {secondary.country}にある税引き前の退職・年金口座の「最低引き出し義務」の規定。開始年齢、\n' +
				'   1960年以降に生まれた人の開始年齢と、その年齢以降の係数表（それより下の行は不要です）。\n' +
				'   今の計画では {secondary.compulsory} です。\n' +
				'3. {primary.country}の確定拠出年金の受け取り開始の期限と、残高を分割できる年数の範囲。\n' +
				'   今の計画では {primary.compulsory} です。\n\n' +
				'条件。要約サイトではなく、税務当局または法令そのものを出典として示してください。確認した日付も\n' +
				'書いてください。確認できなかった値は、推測で埋めずに「確認できなかった」と書いて省いてください。\n' +
				'古いと分かっている値を使うほうが、作られた値を使うよりましです。\n\n' +
				'返答は、まず何がどう変わったかを短く説明し、そのあとにこのファイルだけを、ほかのキーを足さずに\n' +
				'コードブロックで出してください:\n\n' +
				'window.RETIREMENT_REFRESH = {\n' +
				'  "plan.capitalGainsTaxPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "secondary.compulsory": { "value": { "kind": "rmd", "startAge": 0, "divisors": { "72": 0 } }, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "primary.compulsory": { "value": { "kind": "payout", "startAge": 0, "overYears": 0 }, "url": "", "asOf": "YYYY-MM-DD" }\n' +
				'};\n\n' +
				'確認できなかった項目は入れないでください。',
		},
	},
	measured: {
		paths: [
			'secondary.returnVolatilityPct',
			'primary.returnVolatilityPct',
			'fx.volatilityPct',
			'correlations.secondaryPrimary',
			'correlations.secondaryFx',
			'correlations.primaryFx',
		],
		title: { en: 'Ask an AI to re-measure the volatilities and correlations', ja: '変動の大きさと連動性を測り直してもらう' },
		blurb: {
			en: 'These are measurements, not opinions — but a measurement is meaningless without the window it was taken over, so the prompt insists on being told.',
			ja: 'これらは意見ではなく測った値です。ただし「いつからいつまでを測ったか」がなければ意味がないので、必ず書いてもらうようお願いしています。',
		},
		body: {
			en:
				'I need six figures for a retirement simulation, all of them measurable from market\n' +
				'history rather than matters of opinion. The two currencies are {primary.code} (where I\n' +
				'live and spend) and {secondary.code}.\n\n' +
				'  annual standard deviation of broad {secondary.country} equity returns, in {secondary.code}\n' +
				'  annual standard deviation of broad {primary.country} equity returns, in {primary.code}\n' +
				'  annual volatility of the {secondary.code}/{primary.code} exchange rate\n' +
				'  correlation of {secondary.country} and {primary.country} equity returns\n' +
				'  correlation of {secondary.country} equity returns with {secondary.code}/{primary.code}\n' +
				'  correlation of {primary.country} equity returns with {secondary.code}/{primary.code}\n\n' +
				'My plan currently uses {measured}.\n\n' +
				'Rules. State the index or series you measured, the window, and the frequency of the\n' +
				'underlying data — a correlation over ten years of monthly returns is a different number\n' +
				'from one over thirty years of annual returns, and I need to know which I am getting.\n' +
				'Prefer a long window; say so if a shorter one materially changes the answer. Name the\n' +
				'data source and the date you looked.\n\n' +
				'Reply with those details, then this file on its own, in a code block:\n\n' +
				'window.RETIREMENT_REFRESH = {\n' +
				'  "secondary.returnVolatilityPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "primary.returnVolatilityPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "fx.volatilityPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "correlations.secondaryPrimary": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "correlations.secondaryFx": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "correlations.primaryFx": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" }\n' +
				'};',
			ja:
				'リタイア資金のシミュレーションに使う6つの値が必要です。どれも意見ではなく、相場の記録から\n' +
				'測れる値です。通貨は{primary.code}（生活する通貨）と{secondary.code}です。\n\n' +
				'  {secondary.country}株式全体の年間の標準偏差（{secondary.code}建て）\n' +
				'  {primary.country}株式全体の年間の標準偏差（{primary.code}建て）\n' +
				'  {secondary.code}/{primary.code}為替レートの年間の変動の大きさ\n' +
				'  {secondary.country}株式と{primary.country}株式の相関\n' +
				'  {secondary.country}株式と{secondary.code}/{primary.code}の相関\n' +
				'  {primary.country}株式と{secondary.code}/{primary.code}の相関\n\n' +
				'今の計画では {measured} を使っています。\n\n' +
				'条件。どの指数・どの系列を、いつからいつまで、どの頻度のデータで測ったかを書いてください。\n' +
				'月次10年の相関と年次30年の相関は別の数字なので、どちらなのかを知る必要があります。\n' +
				'できるだけ長い期間を優先し、短い期間だと答えが大きく変わる場合はそう書いてください。\n' +
				'データの出どころと、確認した日付も書いてください。\n\n' +
				'その説明のあとに、このファイルだけをコードブロックで出してください:\n\n' +
				'window.RETIREMENT_REFRESH = {\n' +
				'  "secondary.returnVolatilityPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "primary.returnVolatilityPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "fx.volatilityPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "correlations.secondaryPrimary": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "correlations.secondaryFx": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "correlations.primaryFx": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" }\n' +
				'};',
		},
	},
	assumptions: {
		paths: ['secondary.returnMeanPct', 'primary.returnMeanPct', 'plan.inflationPct'],
		title: { en: 'Ask an AI what the published assumptions say', ja: '公表されている前提を調べてもらう' },
		blurb: {
			en: 'These three have no correct answer — they are a choice between institutions that disagree, and two points on a mean return is the difference between a plan that works and one that does not. So this asks for the spread and tells the AI not to pick for you. Read the reply before applying it.',
			ja: 'この3つには正解がありません。機関によって見解が違い、どれを採るかという選択です。平均利回りが2ポイント違えば計画が成り立つかどうかが変わります。ですから幅を出してもらい、選ぶのはAIに任せないよう指示しています。読んでから反映してください。',
		},
		body: {
			en:
				'I need to choose three long-run assumptions for a retirement simulation, and I want to\n' +
				'see what is currently published rather than have you decide for me. The currencies are\n' +
				'{primary.code} (where I live and spend) and {secondary.code}.\n\n' +
				'  expected long-run nominal annual return on broad {secondary.country} equities, in {secondary.code}\n' +
				'  expected long-run nominal annual return on broad {primary.country} equities, in {primary.code}\n' +
				'  expected long-run consumer price inflation in {primary.country}\n\n' +
				'My plan currently uses {assumptions}.\n\n' +
				'Rules, and this is the important part. Do not give me a single number as if it were a\n' +
				'fact. For each of the three, report what several named institutions currently publish —\n' +
				'asset managers’ capital-market assumptions, the central bank’s own projection for\n' +
				'inflation — with the figure, the institution, the horizon it applies to, and a link.\n' +
				'Show me the range across them and say where the middle is. State plainly whether each\n' +
				'figure is arithmetic or geometric, because this simulation wants the arithmetic mean\n' +
				'and the two differ by roughly half the variance. Do not average the institutions\n' +
				'together into one recommendation, and do not tell me which to use.\n\n' +
				'Then, so I can apply a choice easily, give the file below filled in with the *median*\n' +
				'of the institutions you found, clearly labelled as that and not as a recommendation:\n\n' +
				'window.RETIREMENT_REFRESH = {\n' +
				'  "secondary.returnMeanPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "primary.returnMeanPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "plan.inflationPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" }\n' +
				'};',
			ja:
				'リタイア資金のシミュレーションに使う長期の前提を3つ決めたいのですが、あなたに決めてほしいのでは\n' +
				'なく、今どういう数字が公表されているかを知りたいです。通貨は{primary.code}（生活する通貨）と\n' +
				'{secondary.code}です。\n\n' +
				'  {secondary.country}株式全体の長期の期待名目利回り（{secondary.code}建て）\n' +
				'  {primary.country}株式全体の長期の期待名目利回り（{primary.code}建て）\n' +
				'  {primary.country}の長期の消費者物価上昇率\n\n' +
				'今の計画では {assumptions} を使っています。\n\n' +
				'条件。ここが重要です。1つの数字を事実のように出さないでください。3つそれぞれについて、\n' +
				'複数の機関が今公表している数字を、機関名・対象期間・出典リンクとともに挙げてください\n' +
				'（運用会社の長期市場前提、物価については中央銀行の見通しなど）。そのばらつきの幅と、\n' +
				'真ん中がどこかも示してください。また、その数字が算術平均か幾何平均かを明記してください。\n' +
				'このシミュレーションが必要なのは算術平均で、両者は分散の半分ほど違います。\n' +
				'機関の数字を平均して1つの推奨にまとめないでください。どれを使うべきかも言わないでください。\n\n' +
				'そのあと、選んだものを取り込みやすいように、見つけた機関の数字の「中央値」を入れた\n' +
				'下のファイルを出してください。推奨ではなく中央値だと明記してください:\n\n' +
				'window.RETIREMENT_REFRESH = {\n' +
				'  "secondary.returnMeanPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "primary.returnMeanPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" },\n' +
				'  "plan.inflationPct": { "value": 0, "url": "", "asOf": "YYYY-MM-DD" }\n' +
				'};',
		},
	},
};
function promptCurrent(paths) {
	return paths
		.map((path) => {
			const src = sourceOf(path) || {};
			const raw = FIELD_IDS.includes(path) ? getPath(readForm(), path) : configValue(path);
			const shown = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
			const when = src.asOf ? translate(UI.promptAsOf)(src.asOf) : translate(UI.promptNoDate);
			return path + ' = ' + shown + ' (' + when + ')';
		})
		.join('\n  ');
}
/* Summarised: fifty rows of divisors would swamp the prompt. */
function describeCompulsory(role) {
	const c = compulsoryRule(role);
	if (!c) {
		return translate(UI.promptNoRule);
	}
	if (c.kind === 'payout') {
		return translate(UI.promptPayout)(c.startAge, c.overYears);
	}
	const ages = Object.keys(c.divisors || {}).map(Number);
	return translate(UI.promptRmd)(ages.length, Math.min(...ages), Math.max(...ages));
}
function promptText(key) {
	const spec = PROMPTS[key];
	let body = translate(spec.body);
	body = body.replace('{measured}', '\n  ' + promptCurrent(PROMPTS.measured.paths));
	body = body.replace('{assumptions}', '\n  ' + promptCurrent(PROMPTS.assumptions.paths));
	for (const path of PROMPTS.statute.paths) {
		const src = sourceOf(path) || {};
		const shown =
			path.endsWith('.compulsory')
				? describeCompulsory(path.split('.')[0])
				: String(FIELD_IDS.includes(path) ? getPath(readForm(), path) : configValue(path));
		body = body.replace(
			'{' + path + '}',
			shown + (src.asOf ? ', ' + translate(UI.promptAsOf)(src.asOf) : ''),
		);
	}
	return body;
}
/* The clipboard API can refuse (headless Chrome does until the page has had a
   real user gesture), so a refusal selects the text and says to press ⌘C. */
function copyPrompt(textarea, note) {
	const text = textarea.value;
	const fallback = () => {
		textarea.focus();
		textarea.select();
		note.textContent = translate(UI.promptSelectAndCopy);
		note.className = 'note';
	};
	try {
		navigator.clipboard.writeText(text).then(() => {
			note.textContent = translate(UI.promptCopied);
			note.className = 'note success';
		}, fallback);
	} catch {
		fallback();
	}
}
/* An AI reply is prose around a code block: strip the fences and run only the
   assignment. Running it is the same trust as loading a .js document. */
function parseRefresh(text) {
	const cleaned = text.replace(/```[a-z]*\n?/gi, '');
	const at = cleaned.indexOf('RETIREMENT_REFRESH');
	if (at >= 0) {
		const from = cleaned.lastIndexOf('window', at);
		const to = cleaned.lastIndexOf('}');
		const box = {};
		new Function('window', cleaned.slice(from < 0 ? at : from, to + 1) + ';')(box);
		if (box.RETIREMENT_REFRESH) {
			return box.RETIREMENT_REFRESH;
		}
	}
	const open = cleaned.indexOf('{'), close = cleaned.lastIndexOf('}');
	if (open >= 0 && close > open) {
		return JSON.parse(cleaned.slice(open, close + 1));
	}
	throw new Error('no refresh document in that text');
}
function applyPasted(view) {
	const textarea = view.paste;
	const say = (text, ok) => {
		view.applyStatus.textContent = text;
		view.applyStatus.className = ok ? 'note success' : 'note danger';
	};
	if (!textarea.value.trim()) {
		say(translate(UI.pasteEmpty), false);
		return;
	}
	let patch;
	try {
		patch = parseRefresh(textarea.value);
	} catch {
		say(translate(UI.pasteUnreadable), false);
		return;
	}
	const { applied, refused } = applyRefresh(patch);
	for (const id of FIELD_IDS) {
		paintField(id);
	}
	settingsChanged();
	say(translate(UI.pasteResult)(applied.length, refused), applied.length > 0);
	if (applied.length) {
		textarea.value = '';
	}
	lastMonteCarlo = null;
	scheduleMonteCarlo(0);
}
const PROMPT_VIEWS = [];
function promptBlock(key) {
	const view = {
		key,
		title: el('h3'),
		blurb: el('p', { className: 'note' }),
		copyStep: el('span'),
		prompt: el('textarea', { rows: 10, readOnly: true }),
		copyStatus: el('span', { className: 'note' }),
		pasteStep: el('span'),
		paste: el('textarea', { rows: 4 }),
		applyStatus: el('span', { className: 'note' }),
		copyButton: el('button'),
		applyButton: el('button'),
	};
	view.copyButton.onclick = () => copyPrompt(view.prompt, view.copyStatus);
	view.applyButton.onclick = () => applyPasted(view);
	PROMPT_VIEWS.push(view);
	return el(
		'div',
		{ className: 'prompt', dataset: { prompt: key } },
		view.title,
		view.blurb,
		el('p', {}, el('b', {}, SYMBOLS.ordinal(1)), ' ', view.copyStep),
		view.prompt,
		el('div', {}, view.copyButton, view.copyStatus),
		el('p', {}, el('b', {}, SYMBOLS.ordinal(2)), ' ', view.pasteStep),
		view.paste,
		el('div', {}, view.applyButton, view.applyStatus),
	);
}
function paintPrompts() {
	for (const view of PROMPT_VIEWS) {
		const spec = PROMPTS[view.key];
		view.title.textContent = translate(spec.title);
		view.blurb.textContent = translate(spec.blurb);
		view.copyStep.textContent = translate(UI.promptStep1);
		view.pasteStep.textContent = translate(UI.promptStep2);
		view.prompt.value = promptText(view.key);
		view.paste.placeholder = translate(UI.pastePlaceholder);
		view.copyButton.textContent = translate(UI.buttonCopyPrompt);
		view.applyButton.textContent = translate(UI.buttonApplyPasted);
		view.copyStatus.textContent = '';
	}
}

function settingEdited(path, view, desc) {
	const value =
		desc.kind === 'list'
			? LIST_KINDS[desc.list].parse(view.value)
			: desc.kind === 'num'
				? Number(ungroupDigits(view.value))
				: view.value;
	const wellFormed =
		desc.kind !== 'num' || (ungroupDigits(view.value) !== '' && isFinite(value));
	const ok = wellFormed && settingValid(path, value);
	markInvalid(view, !ok);
	if (!ok) {
		return;
	}
	setPath(documents[documentFor(path)], path, value);
	stampSource(path);
	settingsChanged(view);
}
/* Refreshes everything: a setting can change labels, units, dropdowns or the
   simulation, and these edits are rare. */
function settingsChanged(exceptEl) {
	refreshClaimFields();
	relabelForm();
	relabelSettings();
	paintSettings(exceptEl);
	showApplicableCells();
	paintSources();
	paintPrompts();
	onInput();
}
function showApplicableCells() {
	for (const cell of settingsBody.querySelectorAll('.setting-control[data-needs]')) {
		const kind = configValue(cell.dataset.role + '.compulsory.kind') || 'none';
		/* A class, not `hidden`: the cell must keep its grid slot or the column
		   beside it slides under the wrong heading. */
		cell.classList.toggle('not-applicable', !cell.dataset.needs.split(' ').includes(kind));
	}
	for (const row of settingsBody.querySelectorAll('.setting-row')) {
		const cells = [...row.querySelectorAll('.setting-control[data-needs]')];
		if (cells.length) {
			row.hidden = cells.every((c) => c.classList.contains('not-applicable'));
		}
	}
	for (const line of settingsBody.querySelectorAll('[data-src]')) {
		const cell = line
			.closest('.setting-row')
			.querySelector('.setting-control[data-needs][data-role="' + line.dataset.src.split('.')[0] + '"]');
		if (cell) {
			line.hidden = cell.classList.contains('not-applicable');
		}
	}
}
function relabelChoices() {
	for (const option of settingsBody.querySelectorAll('option[data-choice]')) {
		option.textContent = translate(CHOICE_LABELS[option.dataset.choice]);
	}
}
function paintSettings(exceptEl) {
	for (const [path, views] of Object.entries(SETTING_VIEWS)) {
		const desc = SETTING_BY_PATH[path] || SETTING_BY_PATH[path.replace(/\.(en|ja)$/, '')];
		for (const view of views) {
			if (view === exceptEl) {
				continue;
			}
			const v = configValue(path);
			if (desc.kind === 'choice') {
				view.value = v == null ? 'none' : String(v);
				continue;
			}
			view.value =
				desc.kind === 'list'
					? LIST_KINDS[desc.list].format(v)
					: desc.kind === 'num'
						? groupDigits(v)
						: v == null
							? ''
							: String(v);
		}
	}
}

SETTINGS.forEach((section, i) => {
	settingsBody.appendChild(
		el(
			'details',
			{ dataset: { setsec: i }, open: section.open },
			el('summary', { className: 'caps' }),
			el('p', { className: 'note' }),
			el(
				'div',
				{ className: 'setting-grid' + (section.cols ? ' paired' : '') },
				section.cols && el('div', { className: 'column-heads' }, Array.from({ length: 3 }, () => el('span', { className: 'caps' }))),
				section.rows.map((r) => settingsRow(r, section.cols)),
			),
			(section.prompts || []).map(promptBlock),
		),
	);
});
/* The sheet's claim-age selects are built empty; refreshClaimFields fills them.
   Before init(), so the ages it writes land on options that exist. */
refreshClaimFields();
paintSettings();
showApplicableCells();
paintSources();

const settingsIntro = el(
	'div',
	{ className: 'note', id: 'settings-intro' },
	el('p'),
	el('p'),
);
settingsBody.insertBefore(settingsIntro, settingsBody.firstChild);
function paintSources() {
	for (const line of settingsBody.querySelectorAll('[data-src]')) {
		const path = line.dataset.src;
		const src = sourceOf(path);
		const row = ROWS[line.closest('.setting-row').dataset.row];
		line.classList.toggle('danger', src.stale);
		const which =
			row.sources.length > 1 ? translate(row.cols[row.sources.indexOf(path)]) + SYMBOLS.separator : '';
		const when =
			src.asOf === undefined ? translate(UI.sourceNever) : translate(UI.sourceChecked)(src.asOf, src.months);
		line.replaceChildren(which + (src.stale ? SYMBOLS.stale + ' ' : '') + when);
		if (src.stale) {
			line.append(
				SYMBOLS.separator,
				el(
					'button',
					{
						type: 'button',
						className: 'link',
						onclick: () => {
							stampSource(path);
							paintSources();
						},
					},
					translate(UI.sourceDismiss)(configValue('staleAfterMonths')),
				),
			);
		}
		if (src.url) {
			line.append(
				SYMBOLS.separator + translate(UI.sourceFrom) + ' ',
				isWebUrl(src.url)
					? el('a', { href: src.url, target: '_blank', rel: 'noreferrer' }, src.url.replace(/^https?:\/\/(www\.)?/, ''))
					: src.url,
			);
		}
	}
	const stale = stalePaths();
	for (const sectionElement of settingsBody.querySelectorAll('details')) {
		const mine = new Set(
			[...sectionElement.querySelectorAll('[data-src]')].map((line) => line.dataset.src),
		);
		const n = stale.filter((p) => mine.has(p)).length;
		const tag = sectionElement.querySelector('summary .badge');
		if (tag) {
			tag.remove();
		}
		if (n) {
			sectionElement.querySelector('summary').appendChild(el('span', { className: 'badge danger' }, SYMBOLS.stale + ' ' + translate(UI.sourceCount)(n)));
		}
	}
	const btn = document.getElementById('open-settings');
	const old = btn.querySelector('.badge');
	if (old) {
		old.remove();
	}
	if (stale.length) {
		btn.appendChild(el('span', { className: 'badge danger' }, SYMBOLS.count(stale.length)));
	}
}

function relabelSettings() {
	const [intro, stale] = settingsIntro.children;
	intro.textContent = translate(UI.setIntro);
	stale.textContent = translate(UI.setIntroStale);
	SETTINGS.forEach((section, i) => {
		const sectionElement = settingsBody.querySelector('details[data-setsec="' + i + '"]');
		sectionElement.querySelector('summary').textContent = translate(section.title);
		sectionElement.querySelector(':scope > .note').textContent = translate(section.note);
		const head = sectionElement.querySelectorAll('.column-heads > span');
		(section.cols || []).forEach((c, n) => (head[n + 1].textContent = translate(c)));
	});
	for (const rowElement of settingsBody.querySelectorAll('.setting-row')) {
		const row = ROWS[rowElement.dataset.row];
		const path = pathOf(row.live[0]);
		rowElement.querySelector('label').textContent = translate(row.label);
		document.getElementById('describe:' + path).textContent = translate(row.tip);
		document.getElementById('rejected:' + path).textContent = translate(UI.setRejected);
	}
	for (const u of settingsBody.querySelectorAll('.unit[data-unit]')) {
		u.textContent = translate(UNITS[u.dataset.unit]) || '';
	}
	relabelChoices();
}

const settingsSheet = document.getElementById('settings-sheet');
function openSettings() {
	settingsSheet.showModal();
	/* Focus the sheet, not its first input, which would strip its separators. */
	settingsSheet.focus();
}
function closeSettings() {
	settingsSheet.close();
}
document.getElementById('open-settings').onclick = openSettings;
document.getElementById('settings-close').onclick = closeSettings;
/* The dialog has no padding and its content fills it, so a click whose target
   is the dialog itself lands on the backdrop. */
settingsSheet.addEventListener('click', (event) => {
	if (event.target === settingsSheet) {
		closeSettings();
	}
});
