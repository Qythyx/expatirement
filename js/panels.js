'use strict';

/* A canvas takes strings, so the palette is read off the stylesheet once, and
   every chart role — line, band, legend swatch — derives from it here. */
const readCssVariable = (name) =>
	getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
const PALETTE = Object.fromEntries(
	['paper', 'ink', 'muted', 'rule', 'accent', 'success', 'warning', 'danger'].map((name) => [name, readCssVariable(name)]),
);
const canvasFont = readCssVariable('size-chart') + ' ' + readCssVariable('font-mono');
/* A canvas cannot resolve var() and silently ignores a colour that uses it, so a
   palette colour at an opacity is built here from the resolved hex — as rgba(),
   which every canvas takes; color-mix() is unchecked in Safari's. */
const withAlpha = (hex, alpha) => {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
	return `rgba(${r},${g},${b},${alpha})`;
};
const SERIES_COLORS = {
	median: PALETTE.accent,
	bandInner: withAlpha(PALETTE.accent, 0.2),
	bandOuter: withAlpha(PALETTE.accent, 0.1),
	spendRate: PALETTE.warning,
	drawn: PALETTE.danger,
	better: PALETTE.success,
	worse: PALETTE.danger,
	axis: PALETTE.ink,
	gridline: withAlpha(PALETTE.rule, 0.5),
	label: PALETTE.muted,
	hoverGuide: withAlpha(PALETTE.ink, 0.35),
	readoutBackground: withAlpha(PALETTE.ink, 0.92),
	readoutLabel: withAlpha(PALETTE.paper, 0.62),
	readoutValue: PALETTE.paper,
};

wireTips(document.getElementById('outcomes'));

/* ----------------------------- charts (canvas) ----------------------------- */
/* Sizing the bitmap overwrites the height attribute, so the markup's value is
   kept on the dataset the first time through and every draw starts from it. */
function setupCanvas(canvas) {
	canvas.dataset.height ??= canvas.getAttribute('height');
	const dpr = window.devicePixelRatio || 1;
	const r = canvas.getBoundingClientRect();
	canvas.width = r.width * dpr;
	canvas.height = canvas.dataset.height * dpr;
	const ctx = canvas.getContext('2d');
	ctx.scale(dpr, dpr);
	return { ctx, width: r.width, height: canvas.height / dpr };
}
function axes(ctx, width, height, pad, xmin, xmax, ymax, xlab, r2, leftFmt) {
	ctx.fillStyle = SERIES_COLORS.label;
	ctx.lineWidth = 1;
	ctx.font = canvasFont;
	ctx.textBaseline = 'middle';
	for (let i = 0; i <= 4; i++) {
		const y = pad.t + ((height - pad.t - pad.b) * i) / 4;
		const val = ymax * (1 - i / 4);
		ctx.beginPath();
		ctx.moveTo(pad.l, y);
		ctx.lineTo(width - pad.r, y);
		ctx.strokeStyle = i === 4 ? SERIES_COLORS.axis : SERIES_COLORS.gridline;
		ctx.stroke();
		ctx.textAlign = 'right';
		ctx.fillStyle = SERIES_COLORS.label;
		ctx.fillText((leftFmt || formatLargeMoney)(val), pad.l - 8, y);
		if (r2) {
			ctx.textAlign = 'left';
			ctx.fillStyle = r2.color;
			ctx.fillText(formatPercent(r2.max * (1 - i / 4)), width - pad.r + 8, y);
		}
	}
	ctx.fillStyle = SERIES_COLORS.label;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	const span = xmax - xmin;
	const step = span <= 20 ? 5 : 10;
	for (let a = Math.ceil(xmin / step) * step; a <= xmax; a += step) {
		const x = pad.l + ((width - pad.l - pad.r) * (a - xmin)) / span;
		ctx.fillText(a, x, height - pad.b + 6);
	}
	ctx.save();
	ctx.fillStyle = SERIES_COLORS.label;
	ctx.font = canvasFont;
	ctx.textAlign = 'center';
	ctx.fillText(xlab, (pad.l + width - pad.r) / 2, height - 12);
	ctx.restore();
}
function xPos(a, xmin, xmax, width, pad) {
	return pad.l + ((width - pad.l - pad.r) * (a - xmin)) / (xmax - xmin);
}
function yPos(v, ymax, height, pad) {
	return pad.t + (height - pad.t - pad.b) * (1 - v / ymax);
}

let lastMonteCarlo = null;
let hoverIndex = null;
let hoverGeom = null;
/* A run belongs to the ages it was made at: after an age edit it is the wrong
   length, and indexing it per year would run off the end. */
function monteCarloForAges(years, firstAge) {
	const run = lastMonteCarlo;
	return run && run.years === years && run.firstAge === firstAge ? run : null;
}
let survivalView = 'compare';
/* Read on use: the settings sheet can change these while the page is open. */
const spendStep = () => configValue('comparison.spendStepPct') / 100;
const sequenceYears = () => configValue('comparison.sequenceYears');
/* The hover readout box: inset, row height, distance from the guide line, corner
   radius. */
const READOUT = { padding: 8, rowHeight: 15, offset: 12, radius: 3 };
const legendItem = (color, label) => el('span', {}, el('i', { style: { background: color } }), label);
/* A function, so the labels follow the language. */
const rateLegend = () =>
	el(
		'span',
		{ className: 'legend-group end' },
		legendItem(SERIES_COLORS.spendRate, translate(UI.legendSpendRate)),
		legendItem(SERIES_COLORS.drawn, translate(UI.legendDrawn)),
	);
function drawMain() {
	if (!configReady) {
		return;
	}
	const canvas = document.getElementById('path-chart');
	const { ctx, width, height } = setupCanvas(canvas);
	ctx.clearRect(0, 0, width, height);
	const pad = { l: 62, r: 52, t: 14, b: 34 };
	const inputs = engineInputs();
	const firstAge = inputs.currentAge,
		years = inputs.horizonEndAge - inputs.currentAge + 1;
	const ages = [];
	for (let t = 0; t < years; t++) {
		ages.push(firstAge + t);
	}
	const xmin = ages[0],
		xmax = ages[ages.length - 1];
	const run = monteCarloForAges(years, firstAge);
	if (!run) {
		axes(ctx, width, height, pad, xmin, xmax, 1, translate(UI.axisAge));
		document.getElementById('path-legend').replaceChildren();
		hoverGeom = null;
		return;
	}
	/* Cached on the run: five percentiles per year, each a sort of every path, is
	   the dominant cost of a redraw, and hover redraws on every mousemove. */
	if (!run.bands) {
		run.bands = {};
		[10, 25, 50, 75, 90].forEach(
			(q) => (run.bands[q] = ages.map((a, t) => percentile(run.portfolioByYear[t], q / 100))),
		);
		run.startMedian = ages.map((a, t) => (t === 0 ? run.initialPortfolio : run.bands[50][t - 1]));
		/* The median of each path's own drawdown, not a difference of medians: the
		   two diverge once paths fail. */
		const paths = run.pathFunded.length,
			perPath = new Float64Array(paths);
		run.drawnMedian = ages.map((a, t) => {
			const opening = t === 0 ? null : run.portfolioByYear[t - 1];
			for (let s = 0; s < paths; s++) {
				const start = opening ? opening[s] : run.initialPortfolio;
				perPath[s] = Math.max(0, start - run.afterByYear[t][s]);
			}
			return percentile(perPath, 0.5);
		});
	}
	const bands = run.bands;
	let ymax = 0;
	bands[90].forEach((v) => (ymax = Math.max(ymax, v)));
	ymax *= 1.08;
	if (ymax <= 0) {
		ymax = 1;
	}
	/* Both right-axis series over the median start-of-year portfolio, so the two
	   are comparable. null where that is gone: dividing by it would spike the line,
	   and null breaks it. */
	const pctOf = (num) =>
		ages.map((a, t) => (run.startMedian[t] > 0 ? (100 * num(t)) / run.startMedian[t] : null));
	const cost = pctOf((t) => run.spendByYear[t]);
	const drawn = pctOf((t) => run.drawnMedian[t]);
	const finite = cost.concat(drawn).filter((v) => v !== null);
	const NICE = [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 60, 80, 100];
	const peak = finite.length ? Math.max(...finite) : 0;
	const rateAxisMax = NICE.find((v) => v >= peak * 1.08) || 100; // capped; lines peg at the top above this
	axes(ctx, width, height, pad, xmin, xmax, ymax, translate(UI.axisAge), { max: rateAxisMax, color: SERIES_COLORS.spendRate });
	const area = (hi, lo, fill) => {
		ctx.beginPath();
		ages.forEach((a, i) => {
			const x = xPos(a, xmin, xmax, width, pad),
				y = yPos(hi[i], ymax, height, pad);
			i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
		});
		for (let i = ages.length - 1; i >= 0; i--) {
			const x = xPos(ages[i], xmin, xmax, width, pad),
				y = yPos(lo[i], ymax, height, pad);
			ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fillStyle = fill;
		ctx.fill();
	};
	area(bands[90], bands[10], SERIES_COLORS.bandOuter);
	area(bands[75], bands[25], SERIES_COLORS.bandInner);
	ctx.beginPath();
	ages.forEach((a, i) => {
		const x = xPos(a, xmin, xmax, width, pad),
			y = yPos(bands[50][i], ymax, height, pad);
		i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
	});
	ctx.strokeStyle = SERIES_COLORS.median;
	ctx.lineWidth = 2;
	ctx.stroke();
	const rateLine = (series, color, lineWidth) => {
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;
		ctx.beginPath();
		let drawing = false;
		series.forEach((v, i) => {
			if (v === null) {
				drawing = false;
				return;
			}
			const x = xPos(ages[i], xmin, xmax, width, pad),
				y = yPos(Math.min(v, rateAxisMax), rateAxisMax, height, pad);
			drawing ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
			drawing = true;
		});
		ctx.stroke();
	};
	rateLine(cost, SERIES_COLORS.spendRate, 1.5);
	rateLine(drawn, SERIES_COLORS.drawn, 2);
	hoverGeom = { xmin, xmax, width, pad, count: ages.length };
	if (hoverIndex !== null && hoverIndex < ages.length) {
		const i = hoverIndex;
		const hoverX = xPos(ages[i], xmin, xmax, width, pad);
		ctx.strokeStyle = SERIES_COLORS.hoverGuide;
		ctx.lineWidth = 1;
		ctx.setLineDash([3, 3]);
		ctx.beginPath();
		ctx.moveTo(hoverX, pad.t);
		ctx.lineTo(hoverX, height - pad.b);
		ctx.stroke();
		ctx.setLineDash([]);
		const dot = (y, color) => {
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(hoverX, y, 3, 0, Math.PI * 2);
			ctx.fill();
		};
		dot(yPos(bands[50][i], ymax, height, pad), SERIES_COLORS.median);
		if (cost[i] !== null) {
			dot(yPos(Math.min(cost[i], rateAxisMax), rateAxisMax, height, pad), SERIES_COLORS.spendRate);
		}
		if (drawn[i] !== null) {
			dot(yPos(Math.min(drawn[i], rateAxisMax), rateAxisMax, height, pad), SERIES_COLORS.drawn);
		}
		const spendNow = run.spendByYear[i];
		const drawnNow = run.drawnMedian[i];
		const rows = [
			[translate(UI.hoverAge), String(ages[i])],
			[translate(UI.hoverMedian), formatLargeMoney(bands[50][i])],
			[SYMBOLS.bandOuter, SYMBOLS.range(formatLargeMoney(bands[10][i]), formatLargeMoney(bands[90][i]))],
		];
		rows.push([translate(UI.hoverSpending), formatMoney(spendNow) + (cost[i] === null ? '' : '  ' + formatPercent(cost[i]))]);
		rows.push([translate(UI.hoverDrawn), formatMoney(drawnNow) + (drawn[i] === null ? '' : '  ' + formatPercent(drawn[i]))]);
		ctx.font = canvasFont;
		const keyW = Math.max(...rows.map((r) => ctx.measureText(r[0]).width));
		const valW = Math.max(...rows.map((r) => ctx.measureText(r[1]).width));
		const { padding, rowHeight, offset, radius } = READOUT;
		const boxWidth = keyW + valW + padding * 3, // inset each side, and the gap between the columns
			boxHeight = rows.length * rowHeight + padding * 2;
		let boxX = hoverX + offset;
		if (boxX + boxWidth > width - pad.r) {
			boxX = hoverX - offset - boxWidth;
		}
		const boxY = Math.min(pad.t + padding, height - pad.b - boxHeight);
		ctx.fillStyle = SERIES_COLORS.readoutBackground;
		ctx.beginPath();
		ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
		ctx.fill();
		ctx.textBaseline = 'middle';
		rows.forEach((r, k) => {
			const ry = boxY + padding + (k + 0.5) * rowHeight;
			ctx.fillStyle = SERIES_COLORS.readoutLabel;
			ctx.textAlign = 'left';
			ctx.fillText(r[0], boxX + padding, ry);
			ctx.fillStyle = SERIES_COLORS.readoutValue;
			ctx.textAlign = 'right';
			ctx.fillText(r[1], boxX + boxWidth - padding, ry);
		});
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
	}
	document.getElementById('path-legend').replaceChildren(
		el(
			'span',
			{ className: 'legend-group' },
			legendItem(SERIES_COLORS.median, translate(UI.legendMedian)),
			legendItem(SERIES_COLORS.bandInner, SYMBOLS.bandInner),
			legendItem(SERIES_COLORS.bandOuter, SYMBOLS.bandOuter),
		),
		rateLegend(),
	);
}
function survivalOf(run, subset) {
	const n = run.failedAt.length,
		out = [];
	for (let t = 0; t < run.years; t++) {
		let live = 0,
			seen = 0;
		for (let i = 0; i < (subset ? subset.length : n); i++) {
			const pathIndex = subset ? subset[i] : i;
			seen++;
			if (run.failedAt[pathIndex] < 0 || run.failedAt[pathIndex] > t) {
				live++;
			}
		}
		out.push(seen ? (100 * live) / seen : 0);
	}
	return out;
}
/* Ranked by the balance at the split age: ranked by ending wealth, a failed path
   would sort by its own failure. */
function firstDecadeQuartiles(run) {
	const n = run.failedAt.length,
		t = Math.min(sequenceYears(), run.years - 1);
	const order = Array.from({ length: n }, (_, i) => i).sort(
		(a, b) => run.portfolioByYear[t][a] - run.portfolioByYear[t][b],
	);
	const cut = (lo, hi) => order.slice(Math.floor(n * lo), Math.floor(n * hi));
	return [
		{ label: translate(UI.survivalWorstStarts), color: SERIES_COLORS.worse, subset: cut(0, 0.25) },
		{ label: translate(UI.survivalMiddle), color: SERIES_COLORS.median, subset: cut(0.25, 0.75) },
		{ label: translate(UI.survivalBestStarts), color: SERIES_COLORS.better, subset: cut(0.75, 1) },
	];
}
function drawSurvival() {
	if (!configReady) {
		return;
	}
	/* The caption quotes a setting and the current age, so it is rewritten on
	   every draw. */
	document.getElementById('survival-note').replaceChildren(...richText(survivalNote()));
	const canvas = document.getElementById('survival-chart');
	const { ctx, width, height } = setupCanvas(canvas);
	ctx.clearRect(0, 0, width, height);
	const legendEl = document.getElementById('survival-legend');
	const firstAge = engineInputs().currentAge;
	const run = monteCarloForAges(engineInputs().horizonEndAge - firstAge + 1, firstAge);
	if (!run) {
		legendEl.replaceChildren();
		return;
	}
	const pad = { l: 52, r: 16, t: 14, b: 34 };
	const ages = [];
	for (let t = 0; t < run.years; t++) {
		ages.push(firstAge + t);
	}
	const xmin = ages[0],
		xmax = ages[ages.length - 1];

	/* the primary series last, so it draws on top */
	let series;
	if (survivalView === 'sequence') {
		series = firstDecadeQuartiles(run).map((q) => ({
			label: q.label,
			color: q.color,
			width: 2,
			values: survivalOf(run, q.subset),
		}));
	} else {
		series = (run.variants || []).map((v) => ({
			label: v.label(),
			color: v.color,
			width: 1.5,
			values: survivalOf(v.run),
		}));
		series.push({
			label: translate(UI.survivalAsConfigured),
			color: SERIES_COLORS.median,
			width: 2,
			values: survivalOf(run),
		});
	}

	/* Pinned to 0–100: a fitted probability axis would make a strong plan and a
	   weak one look alike. */
	axes(ctx, width, height, pad, xmin, xmax, 100, translate(UI.axisAge), null, (v) => v.toFixed(0) + '%');
	const px = (i) => xPos(ages[i], xmin, xmax, width, pad);
	for (const ser of series) {
		const py = (i) => yPos(ser.values[i], 100, height, pad);
		ctx.beginPath();
		ages.forEach((a, i) => (i ? ctx.lineTo(px(i), py(i)) : ctx.moveTo(px(i), py(i))));
		ctx.strokeStyle = ser.color;
		ctx.lineWidth = ser.width;
		ctx.stroke();
		const last = ages.length - 1;
		ctx.fillStyle = ser.color;
		ctx.beginPath();
		ctx.arc(px(last), py(last), 3, 0, Math.PI * 2);
		ctx.fill();
		ctx.font = canvasFont;
		ctx.textAlign = 'right';
		ctx.textBaseline = 'bottom';
		ctx.fillText(ser.values[last].toFixed(1) + '%', px(last) - 6, py(last) - 5);
	}
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';
	legendEl.replaceChildren(
		...series
			.slice()
			.reverse()
			.map((ser) => legendItem(ser.color, ser.label)),
	);
}

/* ----------------------------- run + render ----------------------------- */
function renderSummary() {
	if (!configReady) {
		return;
	}
	const inputs = engineInputs();
	/* Year one has no uncertainty in it, so its figures are computed from the
	   inputs; the horizon figures come from the run. */
	const fx = inputs.fxRate;
	const secondaryValue = inputs.secondaryBrokerage * fx,
		taxablePool = secondaryValue + inputs.primaryBrokerage,
		taxablePoolBasis =
			inputs.secondaryBrokerage * fx * (1 - inputs.secondaryBrokerageGainPct) +
			inputs.primaryBrokerage * (1 - inputs.primaryBrokerageGainPct);
	const gainRatio = (taxablePool - taxablePoolBasis) / taxablePool;
	let spend = inputs.annualSpending + (inputs.currentAge < inputs.mortgagePayoffAge ? inputs.mortgageAnnual : 0);
	const pensionGross = (inputs.currentAge >= inputs.secondaryPensionStartAge ? inputs.secondaryPensionAnnual * fx : 0) + (inputs.currentAge >= inputs.primaryPensionStartAge ? inputs.primaryPensionAnnual : 0);
	const earnedIncomeNet = inputs.currentAge < inputs.earnedIncomeEndAge ? inputs.earnedIncome * (1 - inputs.earnedIncomeTaxPct) : 0;
	const fromPortfolio = Math.max(0, spend - pensionGross * (1 - inputs.pensionTaxPct) - earnedIncomeNet);
	const saleGross = fromPortfolio / (1 - gainRatio * inputs.capitalGainsTaxPct);
	const tax = saleGross * gainRatio * inputs.capitalGainsTaxPct;
	const taxableGain = saleGross * gainRatio;
	const startingPortfolio = inputs.secondaryBrokerage * fx + inputs.secondaryRetirement * fx + inputs.primaryBrokerage + inputs.primaryRetirement;
	/* The median of each path's own low point, not the low point of the median
	   band — the two differ. */
	const run = monteCarloForAges(inputs.horizonEndAge - inputs.currentAge + 1, inputs.currentAge);
	const medianMinimum = run ? percentile(run.minPortfolio, 0.5) : null,
		medianEnd = run ? percentile(run.endPortfolio, 0.5) : null;
	const forcedNow =
		(inputs.currentAge >= inputs.secondaryCompulsoryAge
			? (inputs.secondaryRetirement * fx) / inputs.secondaryCompulsoryDivisor(inputs.currentAge)
			: 0) +
		(inputs.currentAge >= inputs.primaryCompulsoryAge
			? inputs.primaryRetirement / inputs.primaryCompulsoryDivisor(inputs.currentAge)
			: 0);
	const forcedFrom = Math.min(inputs.primaryCompulsoryAge, inputs.secondaryCompulsoryAge);
	const tiles = [
		[translate(UI.metricMinPortfolio), medianMinimum === null ? SYMBOLS.noValue : formatLargeMoney(medianMinimum), medianMinimum !== null && medianMinimum <= 0 ? 'danger' : ''],
		[translate(UI.metricMedianAtEnd)(inputs.horizonEndAge), medianEnd === null ? SYMBOLS.noValue : formatLargeMoney(medianEnd), ''],
		[translate(UI.metricSell), formatMoney(saleGross), ''],
		[translate(UI.metricTax), formatMoney(tax), ''],
		[translate(UI.metricTaxableIncome), formatMoney(taxableGain), ''],
		[translate(UI.metricWithdrawalRate), formatPercent((100 * saleGross) / startingPortfolio), ''],
		[
			translate(UI.metricForced),
			!isFinite(forcedFrom)
				? SYMBOLS.noValue
				: forcedNow > 0
					? formatMoney(forcedNow)
					: translate(UI.fromAge)(forcedFrom),
			'',
		],
	];
	document.getElementById('path-metrics').replaceChildren(
		...tiles.map(([label, value, tone]) =>
			el(
				'div',
				{ className: 'metric' },
				el('div', { className: 'caps' }, label),
				el('div', { className: tone ? 'figure ' + tone : 'figure' }, value),
			),
		),
	);
	document.getElementById('sensitivity-note').replaceChildren(
		...richText(
			translate(UI.noteSensitivity)(
				formatPercent(100 * inputs.secondaryReturnVolatilityPct),
				((inputs.secondaryReturnVolatilityPct ** 2 / 2) * 100).toFixed(1),
			),
		),
	);
	drawMain();
}

/* The headline figure, its caption and the outcome table, drawn from
   lastMonteCarlo so a language switch can redraw them without re-simulating. */
function renderMonteCarlo() {
	const run = lastMonteCarlo;
	if (!run) {
		return;
	}
	const verdict =
		run.successPct >= configValue('successThresholdsPct.good')
			? 'success'
			: run.successPct >= configValue('successThresholdsPct.fair')
				? 'warning'
				: 'danger';
	document.getElementById('success-rate').className = 'figure figure-large ' + verdict;
	document.getElementById('success-rate').textContent = run.successPct.toFixed(1) + '%';
	document.getElementById('success-rate').removeAttribute('aria-busy');
	document.getElementById('success-caption').replaceChildren(...richText(translate(UI.successCaption)(run.paths, run.endAge)));
	/* Two populations: pooling them would put the failed paths' zeros into the
	   bequest percentiles. */
	const survived = [],
		ranDry = [];
	for (let pathIndex = 0; pathIndex < run.failedAt.length; pathIndex++) {
		if (run.pathFunded[pathIndex]) {
			survived.push(run.endPortfolio[pathIndex]);
		} else {
			ranDry.push(run.firstAge + run.failedAt[pathIndex]);
		}
	}
	survived.sort((a, b) => a - b);
	ranDry.sort((a, b) => a - b);
	const at = (arr, q) => (arr.length ? arr[Math.floor((arr.length - 1) * q)] : 0);
	const end = run.endAge;
	const pct = (k) => ((100 * k) / run.failedAt.length).toFixed(1) + '%';
	const money = (q) => (survived.length ? formatLargeMoney(at(survived, q)) : SYMBOLS.noValue);
	const age = (q) => (ranDry.length ? String(at(ranDry, q)) : SYMBOLS.noValue);
	const rows = [
		[
			'compare',
			translate(UI.outcomeCompareButton),
			translate(UI.outcomeLastTo)(pct(survived.length), end),
			[
				[money(0.1), translate(UI.tipEndLow)(end)],
				[money(0.5), translate(UI.tipEndMid)(end)],
				[money(0.9), translate(UI.tipEndHigh)(end)],
			],
		],
		[
			'sequence',
			translate(UI.outcomeSequenceButton),
			translate(UI.outcomeRanOut)(pct(ranDry.length)),
			[
				[age(0.1), translate(UI.tipDryEarly)],
				[age(0.5), translate(UI.tipDryMid)],
				[age(0.9), translate(UI.tipDryLate)],
			],
		],
	];
	document.getElementById('outcomes').replaceChildren(
		el(
			'table',
			{ className: 'outcomes' },
			el(
				'thead',
				{},
				el(
					'tr',
					{},
					el('th'),
					el('th'),
					[translate(UI.outcomeWorstTenth), translate(UI.outcomeMiddle), translate(UI.outcomeBestTenth)].map((c) => el('th', {}, c)),
				),
			),
			el(
				'tbody',
				{},
				rows.map(([view, btn, head, cells]) =>
					el(
						'tr',
						{},
						el('td', {}, el('button', { className: 'segment', 'aria-pressed': String(survivalView === view), dataset: { view } }, btn)),
						el('th', {}, head),
						/* focusable, so the tooltip is reachable from the keyboard */
						cells.map(([value, tip]) => el('td', { dataset: { tip }, tabIndex: 0 }, value)),
					),
				),
			),
		),
	);
}
/* Read on use, like spendStep: the settings sheet can change them. */
const returnSteps = () => configValue('sensitivity.returnStepsPct') || [];
const fxSteps = () => (configValue('sensitivity.fxStepsPct') || []).map((v) => v / 100);
function renderSensitivity() {
	if (!configReady) {
		return;
	}
	const base = engineInputs();
	/* With volatility off a sleeve compounds at the full arithmetic mean, so the
	   volatility drag comes off inside the run and a row label stays in the units
	   of the field. Both sleeves, not only the one on the axis. */
	const drag = Math.pow(base.secondaryReturnVolatilityPct, 2) / 2;
	const primaryDrag = Math.pow(base.primaryReturnVolatilityPct, 2) / 2;
	const steps = returnSteps(),
		fxStepList = fxSteps();
	const rets = steps.map((d) => base.secondaryReturnMeanPct + d / 100);
	const fxs = fxStepList.map((d) => Math.round(base.fxRate * (1 + d)));
	const hereRow = steps.indexOf(0),
		hereCol = fxStepList.indexOf(0);
	let vals = [],
		maxv = 0;
	rets.forEach((meanReturn) => {
		const row = [];
		fxs.forEach((fxRate) => {
			const inputs = engineInputs();
			inputs.pathCount = 1;
			inputs.secondaryReturnVolatilityPct = 0;
			inputs.primaryReturnVolatilityPct = 0;
			inputs.fxVolatilityPct = 0;
			inputs.secondaryReturnMeanPct = meanReturn - drag;
			inputs.primaryReturnMeanPct = base.primaryReturnMeanPct - primaryDrag;
			inputs.fxRate = fxRate;
			const v = simulate(inputs).minPortfolio[0];
			row.push(v);
			maxv = Math.max(maxv, v);
		});
		vals.push(row);
	});
	document.getElementById('sensitivity-grid').replaceChildren(
		el('div', { className: 'note' }, translate(UI.gridNote)),
		el(
			'table',
			{ className: 'grid' },
			el(
				'tbody',
				{},
				el(
					'tr',
					{},
					el('th', {}, translate(UI.gridCorner)),
					fxs.map((fxRate, j) => el('th', { className: j === hereCol ? 'as-configured' : '' }, String(fxRate))),
				),
				rets.map((meanReturn, i) =>
					el(
						'tr',
						{},
						el('th', { className: i === hereRow ? 'as-configured' : '' }, (meanReturn * 100).toFixed(1) + '%'),
						vals[i].map((v, j) => {
							let background,
								textColor = PALETTE.ink;
							if (v <= 0) {
								background = withAlpha(PALETTE.danger, 0.85);
								textColor = PALETTE.paper;
							} else {
								const t = Math.min(v / maxv, 1);
								background = withAlpha(PALETTE.accent, (0.12 + t * 0.66).toFixed(3));
								if (t > 0.6) {
									textColor = PALETTE.paper;
								}
							}
							const here = i === hereRow && j === hereCol ? 'as-configured' : '';
							return el('td', { className: here, style: { background, color: textColor } }, v <= 0 ? translate(UI.gridDepletes) : toLargeUnit(v, 1));
						}),
					),
				),
			),
		),
	);
}
