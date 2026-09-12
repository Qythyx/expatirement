'use strict';

/* ------------------------------------------------------------------ */
/* Language                                                           */
/* ------------------------------------------------------------------ */
/* Every string the reader sees is an { en, ja } pair. A half is a function when
   the sentence has a number in it, and each half formats its own: word order
   differs between the two languages. */
let language = 'en';
/* Display text goes through translate(): pickLanguage() alone leaves the
   {primary.…} tokens unfilled. For a function half, translate() returns a wrapper
   that fills the tokens in what it produces. */
const pickLanguage = (s) => (s && typeof s === 'object' && !Array.isArray(s) ? (s.ja !== undefined && language === 'ja' ? s.ja : s.en) : s);
function translate(s) {
	const v = pickLanguage(s);
	return typeof v === 'function' ? (...a) => fillCurrencyTokens(v(...a)) : fillCurrencyTokens(v);
}

/* ------------------------------------------------------------------ */
/* Currencies                                                         */
/* ------------------------------------------------------------------ */
/* `primary` is where you live and spend — every figure on screen is reported in
   it; `secondary` is the foreign currency you also hold assets in. Read through
   documents.setup on every call, because a discard replaces the whole document;
   the `|| {}` only keeps a missing setup from throwing before init() reports it. */
const currencyText = (role, path) => pickLanguage(getPath((documents.setup.currencies || {})[role], path));
/* Fills {primary.country}-style tokens. A token naming nothing configured is left
   as written, so a typo shows on screen as itself. */
function fillCurrencyTokens(s) {
	if (Array.isArray(s)) {
		return s.map(fillCurrencyTokens);
	}
	if (s && typeof s === 'object') {
		return Object.fromEntries(Object.entries(s).map(([key, value]) => [key, fillCurrencyTokens(value)]));
	}
	return typeof s === 'string'
		? s.replace(/\{(primary|secondary)\.([\w.]+)\}/g, (tok, role, path) => {
				const v = currencyText(role, path);
				return typeof v === 'string' ? v : tok;
			})
		: s;
}

/* A plain string here is the same in both languages. 'num' is empty, for a figure
   that measures nothing — a correlation, a random seed. */
const UNITS = {
	primary: '{primary.symbol}',
	secondary: '{secondary.symbol}',
	pct: '%',
	age: { en: 'age', ja: '歳' },
	months: { en: 'months', ja: 'か月' },
	years: { en: 'years', ja: '年' },
	paths: { en: 'paths', ja: '回' },
	digits: { en: 'digits', ja: '桁' },
	steps: { en: '± %', ja: '±％' },
	divisor: '÷',
	num: '',
};

const APP_NAME = 'Expatirement';

/* Text that is the same in every language, so it is not a pair. */
const SYMBOLS = {
	noValue: '—',
	info: 'ⓘ',
	stale: '⚠',
	separator: ' · ',
	titleSeparator: ' — ',
	bandOuter: '10–90%',
	bandInner: '25–75%',
	languageTag: { en: 'EN', ja: 'JA' },
	count: (n) => `(${n})`,
	range: (from, to) => from + '–' + to,
	ordinal: (n) => n + '.',
};

const UI = {
	tagline: {
		en: 'Retirement Simulator for Dual Currencies',
		ja: '二つの通貨のためのリタイア資金シミュレーター',
	},
	sub: {
		en:
			'A self-contained planner for a {secondary.adjective} citizen retiring abroad: home ' +
			'{primary.country}, assets in {primary.code} and {secondary.code}. The FX mismatch, dual-tax ' +
			'withdrawals, pensions and a mortgage payoff, run as a Monte\u00a0Carlo. Download these files and ' +
			'open the page locally. Your figures are not stored between visits — “Save plan” writes them to a ' +
			'file, and “Load plan” reads one back.',
		ja:
			'{primary.country}でリタイアする{secondary.country}籍の方のための、これだけで動く資金計画ツールです。' +
			'{secondary.name}資産と{primary.name}資産、その為替のずれ、二国それぞれの税金を踏まえた取り崩し、年金、' +
			'住宅ローンの完済までを、モンテカルロ法（運まかせの相場を何千通りも試して数える方法）で計算します。' +
			'これらのファイルをダウンロードして、お使いのパソコンでページを開いてください。入力した数字は次に開いたときには残りません。' +
			'「計画を保存」でファイルに書き出し、「計画を読み込む」で読み戻してください。',
	},
	languageButton: { en: '日本語', ja: 'English' },
	buttonSettings: { en: 'All settings', ja: 'すべての設定' },
	panelSettings: { en: 'All settings', ja: 'すべての設定' },
	buttonClose: { en: 'Close', ja: '閉じる' },
	buttonCopyPrompt: { en: 'Copy prompt', ja: 'プロンプトをコピー' },
	buttonApplyPasted: { en: 'Apply', ja: '反映する' },
	promptStep1: {
		en: 'Copy this and give it to an AI that can search the web.',
		ja: 'これをコピーして、ウェブを検索できるAIに渡してください。',
	},
	promptStep2: {
		en:
			'It will reply with what it found and a short block of code. Paste the reply here — ' +
			'all of it is fine, or just the code — and press Apply. Only the figures the prompt ' +
			'named can change, each records the date it was checked, and anything unusable is ' +
			'refused rather than half-applied. Nothing is written to disk until you use “Save plan”.',
		ja:
			'AIは、調べた内容と短いコードのかたまりを返してきます。その返答をここに貼って（全文でも、コードの部分だけでも構いません）' +
			'「反映する」を押してください。変わるのはプロンプトに挙がっていた値だけで、それぞれに確認日が記録され、' +
			'使えない値は中途半端に反映せず拒否します。ファイルに書き込まれるのは「計画を保存」を押したときだけです。',
	},
	pastePlaceholder: {
		en: 'Paste the AI’s reply here',
		ja: 'AIの返答をここに貼ってください',
	},
	pasteEmpty: { en: 'nothing pasted yet', ja: 'まだ何も貼られていません' },
	pasteUnreadable: {
		en: 'could not find a refresh document in that — paste the reply again, including its code block',
		ja: 'その中に更新用のデータが見つかりませんでした。コードの部分を含めて、もう一度貼ってください',
	},
	pasteResult: {
		en: (n, refused) =>
			n +
			' value' +
			(n === 1 ? '' : 's') +
			' updated' +
			(refused.length ? ' · refused: ' + refused.join(', ') : ''),
		ja: (n, refused) =>
			n + '件を更新しました' + (refused.length ? '・拒否: ' + refused.join(', ') : ''),
	},
	promptCopied: { en: 'copied', ja: 'コピーしました' },
	promptSelectAndCopy: {
		en: 'selected — press ⌘C (the browser would not let the page write to the clipboard)',
		ja: '選択しました。⌘Cを押してください（ブラウザがクリップボードへの書き込みを許可しませんでした）',
	},
	promptAsOf: {
		en: (date) => 'last checked ' + date,
		ja: (date) => date + 'に確認',
	},
	promptNoDate: { en: 'never checked', ja: '確認日の記録なし' },
	promptRmd: {
		en: (rows, lo, hi) =>
			'a ' + rows + '-row divisor table running from age ' + lo + ' to ' + hi +
			', so distributions begin at ' + lo,
		ja: (rows, lo, hi) =>
			lo + '歳から' + hi + '歳までの' + rows + '行の係数表（' + lo + '歳から引き出しが始まります）',
	},
	compulsoryNone: { en: 'none', ja: 'なし' },
	compulsoryRmd: { en: 'a minimum each year', ja: '毎年の最低引き出し' },
	compulsoryPayout: { en: 'paid out over a fixed term', ja: '一定年数で全額受け取り' },
	promptNoRule: {
		en: 'no such rule configured at all',
		ja: 'この制度は設定されていません',
	},
	promptPayout: {
		en: (start, years) =>
			'payouts beginning by age ' + start + ' and spread over ' + years + ' years',
		ja: (start, years) => start + '歳までに受け取りを始め、' + years + '年に分けて受け取る',
	},
	sourceNever: {
		en: 'never checked',
		ja: '一度も確認していません',
	},
	sourceDismiss: {
		en: (months) => 'dismiss warning for ' + months + ' months',
		ja: (months) => months + 'か月この警告を消す',
	},
	sourceChecked: {
		en: (date, months) =>
			'last checked ' + date + (months < 1 ? ' (today)' : ', ' + months + ' months ago'),
		ja: (date, months) => '最終確認 ' + date + (months < 1 ? '（今日）' : '・' + months + 'か月前'),
	},
	sourceFrom: { en: 'from', ja: '出どころ' },
	sourceCount: {
		en: (n) => n + ' stale value' + (n === 1 ? '' : 's'),
		ja: (n) => '古い値 ' + n + '件',
	},
	setRejected: {
		en: 'Not a value the page could start on, so it was not applied — the previous one is still in force.',
		ja: 'この値ではページを開けないため、反映していません。前の値がそのまま使われています。',
	},
	setIntro: {
		en:
			'Everything the simulation runs on. The sidebar carries the handful worth ' +
			'dragging while you watch the chart; this carries all of them, so nothing has ' +
			'to be edited in a file. Sections are grouped by how often they change — the ' +
			'ones that rarely do start closed.',
		ja:
			'シミュレーションが使うすべての値です。左側にあるのは、グラフを見ながら動かして試す価値のあるものだけで、' +
			'ここにはすべてあります。ファイルを直接編集する必要はありません。' +
			'区分けは「どれくらいの頻度で変わるか」で、めったに変わらないものは閉じた状態から始まります。',
	},
	setIntroStale: {
		en:
			'Some of these are not yours and not your judgement — a statutory rate, a ' +
			'divisor table, a figure off a benefit statement. Those carry the date they were ' +
			'last checked, because they go out of date without looking any different, and are ' +
			'marked ⚠ when that date is old or missing. Three things clear the mark: editing ' +
			'the value, applying an answer to one of the prompts further down — which also ' +
			'records where the figure came from — and, when you have looked one up and it had ' +
			'not moved, the dismiss link on the warning itself.',
		ja:
			'このうちいくつかは、自分で決めた値でも見込みでもありません。法令で決まる税率、係数表、' +
			'年金の見込額など、ほかから写してきた値です。こうした値は古くなっても見た目が変わらないので、' +
			'最後に確認した日付を持たせてあり、その日付が古いか記録がないときは ⚠ を付けます。' +
			'印が消えるのは3通りです。値を編集したとき、下にあるプロンプトの答えを取り込んだとき' +
			'（このときは出どころもいっしょに記録されます）、そして調べてみて値が変わっていなかったときに、' +
			'警告の中にある「消す」を押したときです。',
	},
	infoShow: { en: 'Show explanation', ja: '説明を表示' },
	infoHide: { en: 'Hide explanation', ja: '説明を隠す' },
	buttonSave: { en: 'Save plan', ja: '計画を保存' },
	buttonLoad: { en: 'Load plan', ja: '計画を読み込む' },
	buttonReset: { en: 'Discard changes', ja: '変更を取り消す' },

	/* ---- save status ---- */
	dirty: {
		en: '● unsaved changes — use “Save plan”',
		ja: '● 未保存の変更があります —「計画を保存」を押してください',
	},
	dirtySetup: {
		en: '● unsaved setup changes — use “Save setup”',
		ja: '● 未保存の設定変更があります —「設定を保存」を押してください',
	},
	dirtyBoth: {
		en: '● unsaved changes — use “Save plan” and “Save setup”',
		ja: '● 未保存の変更があります —「計画を保存」と「設定を保存」を押してください',
	},
	cleanSaved: { en: 'plan saved to file', ja: '計画をファイルに保存しました' },
	cleanSetupSaved: { en: 'setup saved to file', ja: '設定をファイルに保存しました' },
	buttonSaveSetup: { en: 'Save setup', ja: '設定を保存' },
	cleanLoaded: { en: 'loaded from file', ja: 'ファイルから読み込みました' },
	cleanLoadedIgnored: {
		en: (n) => 'loaded from file · ' + n + ' ignored',
		ja: (n) => 'ファイルから読み込みました・' + n + '件は無視されました',
	},
	cleanDefaults: {
		en: (file) => 'showing ' + file,
		ja: (file) => file + ' を表示しています',
	},
	cleanNoFiles: {
		en: (files) => 'could not load ' + files.join(' and '),
		ja: (files) => files.join('と') + ' を読み込めませんでした',
	},
	cleanBadConfig: {
		en: 'configuration incomplete',
		ja: '設定の内容が足りません',
	},
	configRejectedSuffix: {
		en: ' · not running',
		ja: '・停止しています',
	},

	/* ---- portfolio path panel ---- */
	panelPath: { en: 'Portfolio path', ja: '資産の推移' },
	notePath: {
		en:
			'Values are in today’s {primary.name}. The solid line is the median of the simulated ' +
			'paths, the inner band the 25th–75th percentile and the outer band the ' +
			'10th–90th. Bear in mind that the median is a reading taken at each age ' +
			'separately, not a single simulation — no one path traces it, and real paths ' +
			'wander across the bands. The two right-axis lines are also medians, over the ' +
			'same median start-of-year portfolio. Every edit re-runs the simulation, from ' +
			'a fixed random seed, so the same inputs always give the same answer.',
		ja:
			'金額はすべて今の物価に直した{primary.name}です。太い線は何千通りものシミュレーションのちょうど真ん中（中央値）、' +
			'内側の帯は下から25％〜75％にあたる範囲、外側の帯は10％〜90％の範囲です。' +
			'ただし中央値は年齢ごとに別々に取った目安であって、ひとつのシミュレーションがこの線をたどるわけではありません。' +
			'実際の道筋は帯の中を上下に行き来します。右側の目盛りの2本の線も同じく中央値で、' +
			'どちらもその年の初めの資産（中央値）を分母にしています。' +
			'入力を変えるたびに計算し直しますが、乱数の出発点は固定してあるので、同じ入力なら必ず同じ答えになります。',
	},
	metricMinPortfolio: { en: 'Min portfolio (median path)', ja: '資産の底値（中央値）' },
	metricMedianAtEnd: {
		en: (age) => 'Median value (age ' + age + ')',
		ja: (age) => age + '歳時点の資産（中央値）',
	},
	metricSell: { en: 'Year-1 amount to sell', ja: '1年目に売る金額' },
	metricTax: { en: 'Year-1 tax', ja: '1年目の税金' },
	metricTaxableIncome: { en: 'Year-1 taxable income', ja: '1年目の課税対象の利益' },
	metricWithdrawalRate: { en: 'Initial withdrawal rate', ja: '初年度の取り崩し率' },
	metricForced: { en: 'Year-1 forced draw', ja: '1年目の強制的な引き出し' },
	fromAge: { en: (age) => 'from age ' + age, ja: (age) => age + '歳から' },

	/* ---- chart furniture ---- */
	axisAge: { en: 'age', ja: '年齢' },
	legendMedian: { en: 'median', ja: '中央値' },
	legendSpendRate: { en: 'spend / portfolio', ja: '支出 ÷ 資産' },
	legendDrawn: { en: 'drawn from portfolio', ja: '資産から取り崩した額' },
	hoverAge: { en: 'age', ja: '年齢' },
	hoverMedian: { en: 'median', ja: '中央値' },
	hoverSpending: { en: 'spending', ja: '支出' },
	hoverDrawn: { en: 'drawn', ja: '取り崩し' },

	/* ---- Monte Carlo panel ---- */
	panelMonteCarlo: {
		en: 'Monte Carlo — probability the plan stays funded',
		ja: 'モンテカルロ法 — 資金が尽きない確率',
	},
	successCaptionInitial: {
		en: [
			'Success = spending met every year through the horizon without depleting the ' +
				'portfolio. This is a ',
			{ em: 'rigid-spending' },
			' figure; trimming discretionary spending in bad years raises it.',
		],
		ja: [
			'ここでいう「成功」とは、最後の年まで毎年の支出をまかなえて、資産が尽きなかったことです。生活費を',
			{ em: 'まったく変えない' },
			'前提の数字なので、相場が悪い年に使うお金を絞れれば、この確率は上がります。',
		],
	},
	successCaption: {
		en: (paths, age) => [
			'of ' + paths.toLocaleString() + ' simulated paths stay funded to age ' + age + '. ',
			{ em: 'Rigid-spending' },
			' figure — flexibility in weak markets raises it.',
		],
		ja: (paths, age) => [
			paths.toLocaleString() + '通りのシミュレーションのうち、' + age + '歳まで資金が尽きなかった割合です。生活費を',
			{ em: 'まったく変えない' },
			'前提の数字なので、相場が悪い年に支出を絞れる余裕があれば、この確率は上がります。',
		],
	},
	/* the survival chart's own legend */
	survivalAsConfigured: { en: 'as configured', ja: '入力どおり' },
	survivalSpendLower: {
		en: (pct) => 'spend −' + pct + '%',
		ja: (pct) => '支出 −' + pct + '%',
	},
	survivalSpendHigher: {
		en: (pct) => 'spend +' + pct + '%',
		ja: (pct) => '支出 +' + pct + '%',
	},
	survivalWorstStarts: { en: 'worst 25% of starts', ja: '出だしが悪かった25%' },
	survivalMiddle: { en: 'middle 50%', ja: '真ん中の50%' },
	survivalBestStarts: { en: 'best 25% of starts', ja: '出だしが良かった25%' },
	/* the two readings of that chart, in prose */
	noteCompare: {
		en: (endAge, step) =>
			'Share of the simulated paths still solvent at each age. The teal line is your ' +
			'plan, and its right-hand end is the headline figure above — the chance of still ' +
			'being funded at age ' +
			endAge +
			'. The other two are the identical simulation with spending ' +
			step +
			'% lower and ' +
			step +
			'% higher, which shows that the choice moves the whole curve rather than just ' +
			'the final number.',
		ja: (endAge, step) =>
			'それぞれの年齢の時点で、資金が尽きずに残っているシミュレーションの割合です。' +
			'緑の線があなたの計画で、その右端が上の見出しの数字 — つまり' +
			endAge +
			'歳の時点でまだ資金が続いている確率です。ほかの2本はまったく同じ条件で、生活費だけを' +
			step +
			'％少なく、' +
			step +
			'％多くしたものです。生活費の決め方が、最後の数字だけでなく曲線の全体を動かすことが分かります。',
	},
	noteSequence: {
		en: (splitAge) =>
			'A bad stretch of markets early does far more damage than the same stretch ' +
			'later, because the losses come out of a portfolio that still has every ' +
			'remaining year to pay for. These are the same simulated paths, sorted by how ' +
			'much was left at age ' +
			splitAge +
			' and then split into the worst quarter, the middle half and the best quarter. ' +
			'Nothing about the plan differs between the three groups — only the markets ' +
			'they happened to get. That spread is the part of the outcome you do not ' +
			'control, and it is the argument for keeping room to cut spending if the early ' +
			'years go badly, rather than fixing the number now.',
		ja: (splitAge) =>
			'相場の悪い時期が早い年に来ると、あとから来る場合よりずっと大きな痛手になります。' +
			'まだ残りの年数すべてを支えなければならない資産から、その損失が出ていくからです。' +
			'ここに出ているのはまったく同じシミュレーションを並べ替えただけのもので、' +
			splitAge +
			'歳の時点でお金がどれだけ残っていたかで、悪かった4分の1、真ん中の半分、良かった4分の1の3つに分けています。' +
			'3つのグループで計画は何ひとつ違いません。違うのは、たまたま当たった相場だけです。' +
			'この開きは自分ではどうにもならない部分で、だからこそ、いま生活費をきっちり決めてしまうよりも、' +
			'最初の数年がうまくいかなかったときに支出を削れる余裕を残しておくほうが良い、という話になります。',
	},

	/* ---- outcomes table ---- */
	outcomeWorstTenth: { en: 'worst tenth', ja: '悪いほうの1割' },
	outcomeMiddle: { en: 'middle', ja: '真ん中' },
	outcomeBestTenth: { en: 'best tenth', ja: '良いほうの1割' },
	outcomeCompareButton: { en: 'Spending comparison', ja: '生活費を変えたら' },
	outcomeSequenceButton: { en: 'Effect of a bad start', ja: '出だしが悪かったら' },
	outcomeLastTo: {
		en: (pct, age) => pct + ' last to ' + age + ', leaving',
		ja: (pct, age) => pct + 'が' + age + '歳まで持ち、残るお金は',
	},
	outcomeRanOut: {
		en: (pct) => pct + ' run out, at age',
		ja: (pct) => pct + 'が資金切れ、その年齢は',
	},
	tipEndLow: {
		en: (age) =>
			'Of the paths that last to ' + age + ', the poorest tenth finish with this or less, in today’s {primary.name}.',
		ja: (age) =>
			age + '歳まで持ったシミュレーションのうち、成績が悪いほうの1割は、最後に残るお金がこの金額以下です（今の物価に直した{primary.name}）。',
	},
	tipEndMid: {
		en: (age) =>
			'Of the paths that last to ' + age + ', half finish above this and half below, in today’s {primary.name}.',
		ja: (age) =>
			age + '歳まで持ったシミュレーションのうち、ちょうど半分はこの金額より多く、半分はこれより少なく残ります（今の物価に直した{primary.name}）。',
	},
	tipEndHigh: {
		en: (age) =>
			'Of the paths that last to ' + age + ', the richest tenth finish with this or more, in today’s {primary.name}.',
		ja: (age) =>
			age + '歳まで持ったシミュレーションのうち、成績が良いほうの1割は、最後にこの金額以上残ります（今の物価に直した{primary.name}）。',
	},
	tipDryEarly: {
		en: 'Of the paths that run out, the earliest tenth are empty by this age.',
		ja: '資金が尽きたシミュレーションのうち、早いほうの1割は、この年齢までに空になります。',
	},
	tipDryMid: {
		en:
			'Of the paths that run out, half are empty before this age and half after. ' +
			'This says nothing about the paths that last — those are the row above.',
		ja:
			'資金が尽きたシミュレーションのうち、半分はこの年齢より前に、半分はこれより後に空になります。' +
			'これは最後まで持ったシミュレーションについては何も言っていません — そちらは上の行です。',
	},
	tipDryLate: {
		en:
			'Of the paths that run out, the latest tenth hold on past this age. ' +
			'Nine in ten are already empty before it.',
		ja:
			'資金が尽きたシミュレーションのうち、遅いほうの1割は、この年齢を過ぎても持ちこたえます。' +
			'10のうち9はそれより前に空になっています。',
	},

	/* ---- sensitivity panel ---- */
	panelSensitivity: {
		en: 'Sensitivity — minimum portfolio over the horizon',
		ja: '感度分析 — 期間中の資産の底値',
	},
	noteSensitivity: {
		en: (volatility, drag) =>
			'Both axes are centred on your inputs — the outlined cell is the plan exactly as ' +
			'configured, and the rest is the return being 1 or 2 points off and the {primary.name} landing ' +
			'up to 30% either side. Each cell is a single run with volatility switched off, so the ' +
			'volatility drag is taken off both equity sleeves inside the run — ' +
			drag +
			' points on the {secondary.code} sleeve at your ' +
			volatility +
			' volatility. A row is therefore directly comparable ' +
			'with the mean return you entered. Red = the portfolio ' +
			'depletes; deeper green = larger surviving buffer. This is the deterministic ' +
			'“corners” view that complements the probabilistic one above.',
		ja: (volatility, drag) =>
			'縦と横どちらの軸もあなたの入力を中心に置いてあります。枠で囲んだマスがそのままの計画で、' +
			'その周りは利回りが1〜2ポイントずれた場合、そして{primary.name}が上下30％まで動いた場合です。' +
			'各マスは値動きのぶれを止めて1回だけ計算したものなので、その代わりに株式ふたつの' +
			'「ぶれによる目減り」を計算の中で差し引いてあります — あなたの入力した' +
			volatility +
			'という変動の大きさでは、{secondary.country}資産で' +
			drag +
			'ポイントぶんです。' +
			'ですから各行の数字は、あなたが入力した平均利回りとそのまま見比べられます。' +
			'赤は資産が尽きること、緑が濃いほど余裕が大きいことを表します。' +
			'上の「確率で見る」分析に対して、こちらは決め打ちで四隅を見る分析です。',
	},
	gridNote: {
		en:
			'min portfolio value ({primary.bigUnit.label}) · rows = {secondary.code} mean return · ' +
			'columns = flat FX ({primary.symbol}/{secondary.symbol}) · outlined cell = your inputs',
		ja:
			'資産の底値（{primary.bigUnit.label}{primary.name}）・縦 = {secondary.name}資産の平均利回り・' +
			'横 = 一定とした為替レート（{primary.name}/{secondary.name}）・枠のマス = あなたの入力',
	},
	gridCorner: { en: 'ret \\ FX', ja: '利回り \\ 為替' },
	gridDepletes: { en: 'depletes', ja: '尽きる' },

	/* ---- notes & assumptions ---- */
	panelNotes: { en: 'Notes & assumptions', ja: '補足と前提' },
	noteAssumptions: {
		en: [
			'Withdrawals follow a waterfall: earned income and pension income (each taxed at its own ' +
			'effective rate) reduce the need first; any scheduled draw on the {secondary.country} ' +
			'retirement account comes next; then the taxable pool ({secondary.country} brokerage + ' +
			'{primary.country} brokerage) is sold and grossed up for the {primary.adjective} ' +
			'capital-gains rate; then the {secondary.country} retirement account at the ordinary rate; ' +
			'then the {primary.country} one. {primary.country} is the country of residence, so its ' +
			'capital-gains tax is assumed to bind and the other side to be credited via the foreign tax ' +
			'credit. Required Minimum Distributions are enforced where the {secondary.country} ' +
			'retirement account is configured with them: from the RMD age on — for a US Traditional IRA ' +
			'that is 75, per SECURE Act 2.0, for anyone born in 1960 or after — it must ' +
			'distribute at least the amount its divisor table gives, and any forced distribution beyond ' +
			'what spending needs is taxed at the ordinary rate and reinvested into the ' +
			'{secondary.country} brokerage as fresh cost basis. In any year income exceeds spending — ' +
			'semi-retirement, typically — the surplus is likewise invested in the {primary.country} ' +
			'brokerage as fresh cost basis rather than discarded. Returns are drawn from correlated ' +
			'normal distributions; FX follows a log-random-walk with the volatility you set. Every ' +
			'amount you enter is in today’s money and is carried forward at the inflation rate ' +
			'internally, so returns stay nominal and capital-gains tax falls on the nominal gain; ' +
			'pensions are indexed, and the mortgage, being a fixed contract, is not. ',
			{
				strong:
					'All figures shown — metrics, charts and the sensitivity grid — are converted back to today’s ' +
					'{primary.name}.',
			},
			' Pension, retirement-account and FX tax treatments are ' +
			'simplifications — confirm specifics with a cross-border professional. Not financial advice.',
		],
		ja: [
			'お金を取り崩す順番は決まっています。まず働いて得た収入と年金収入（それぞれの実効税率で課税）が必要額を減らし、' +
			'次に{secondary.country}の退職・年金口座からの計画的な引き出し、' +
			'次に課税口座（{secondary.country}の証券口座＋{primary.country}の証券口座）を売り、' +
			'{primary.country}の譲渡益税ぶんを上乗せして取り崩します。それでも足りなければ{secondary.country}の退職・年金口座を通常の税率で、' +
			'最後に{primary.country}の退職・年金口座を取り崩します。住んでいるのは{primary.country}なので、' +
			'株の売却益への課税は{primary.country}の税率が効くものとし、もう一方は外国税額控除で差し引かれる前提です。' +
			'{secondary.country}の退職・年金口座に「最低引き出し義務（RMD）」が設定されている場合は、それも反映しています。' +
			'これは一定の年齢に達すると毎年決められた最低額を引き出さなければならない制度で、' +
			'米国のトラディショナルIRAなら1951〜1959年生まれは73歳、それ以外は75歳です（SECURE Act 2.0）。' +
			'最低額は設定された係数表で決まり、生活費に必要な分を超えて引き出さざるを得なかったお金は、' +
			'通常の税率で課税したうえで{secondary.country}の証券口座に入れ直します（そのときの値段が新しい取得価額になります）。' +
			'収入が支出を上回る年 — たいていはセミリタイア中です — も同じで、余った分は捨てずに{primary.country}の証券口座に積み立てます。' +
			'利回りは互いにある程度連動する正規分布から引いており、為替はあなたが設定した変動の大きさにしたがって' +
			'あてもなく上下します。入力する金額はすべて今の物価での金額で、計算の中ではインフレ率で毎年ふくらませています。' +
			'ですから利回りは物価上昇を含んだ名目のままで、譲渡益税も名目の利益にかかります。' +
			'年金は物価に合わせて増え、住宅ローンは契約で金額が決まっているので増えません。',
			{ strong: '画面に出る数字はすべて — 指標もグラフも感度分析の表も — 今の物価に直した{primary.name}に戻してあります。' },
			'年金・退職金口座・為替にかかる税の扱いは単純化したものです。個別のことは二国の国際税務にくわしい専門家に確認してください。' +
				'これは投資助言ではありません。',
		],
	},

	/* ---- banners and alerts ---- */
	bannerCannotStart: { en: 'The simulator cannot start.', ja: 'シミュレーターを起動できません。' },
	bannerFixAndReload: {
		en:
			'Every value this page uses lives in that file and there is no copy in ' +
			'the page to fall back on. Fix the file and reload.',
		ja:
			'このページが使う値はすべてそのファイルの中にあり、ページ側に控えはありません。' +
			'ファイルを直してから読み込み直してください。',
	},
	configDidNotLoad: {
		en: (where) =>
			'Could not find or load the configuration — neither retirement_setup.js nor ' +
			'retirement_plan.js reached the page. Looked in: ' + where + '\n' +
			'If the files are sitting there, something between the page and them refused the ' +
			'request — a preview server, or a sandboxed viewer. The browser console names it.',
		ja: (where) =>
			'設定を見つけられないか、読み込めませんでした。retirement_setup.js も retirement_plan.js も' +
			'ページに届いていません。探した場所: ' + where + '\n' +
			'そこにファイルがあるなら、ページとファイルのあいだで要求が拒否されています。' +
			'プレビュー用のサーバーや、サンドボックスの中で開いた場合などです。' +
			'理由はブラウザのコンソールに出ます。',
	},
	configFileMissing: {
		en: (which, url) => '  retirement_' + which + '.js — could not find or load: ' + url,
		ja: (which, url) => '  retirement_' + which + '.js — 見つからないか、読み込めません: ' + url,
	},
	configIncomplete: {
		en: 'The configuration is incomplete:',
		ja: '設定の内容が足りません:',
	},
	configUnusable: {
		en: (path) => '  ' + path + ' — missing or not usable',
		ja: (path) => '  ' + path + ' — ありません、または使えない値です',
	},
	configFieldsOutOfRange: {
		en: (names) => '  values the field cannot hold: ' + names,
		ja: (names) => '  その項目には入れられない値です: ' + names,
	},
	configFieldsMissing: {
		en: (names) => '  input fields missing: ' + names,
		ja: (names) => '  入力項目がありません: ' + names,
	},
	bannerRefreshed: { en: 'Figures refreshed.', ja: '値を更新しました。' },
	refreshApplied: {
		en: (n) => '  ' + n + ' value' + (n === 1 ? '' : 's') + ' updated, each with the date it was checked',
		ja: (n) => '  ' + n + '件の値を、確認日とあわせて更新しました',
	},
	refreshRefused: {
		en: 'Not applied — a refresh may only set the figures that are copied from elsewhere, and only to values this page could start on:',
		ja: '反映していません。更新ファイルで変えられるのは「ほかから写してきた値」だけで、しかもこのページが起動できる値である必要があります:',
	},
	bannerPartlyIgnored: {
		en: 'Some of that file was ignored.',
		ja: '読み込んだファイルの一部は無視されました。',
	},
	loadUnlisted: {
		en: 'Not among the configured options, so the first was chosen:',
		ja: '選択肢にない値だったため、先頭の選択肢にした項目:',
	},
	loadUnplaceable: {
		en: 'No field in this version, so dropped:',
		ja: 'このバージョンに該当する項目がないため、捨てた項目:',
	},
	planFileUnreadable: {
		en: 'Could not read that file as a plan.',
		ja: 'そのファイルを計画として読み込めませんでした。',
	},
};
