'use strict';

/* ------------------------------------------------------------------ */
/* Paths                                                              */
/* ------------------------------------------------------------------ */
const getPath = (o, path) => {
	let v = o;
	for (const part of path.split('.')) {
		v = v == null ? undefined : v[part];
	}
	return v;
};
const setPath = (o, path, val) => {
	const parts = path.split('.');
	let t = o;
	for (const part of parts.slice(0, -1)) {
		t = t[part] || (t[part] = {});
	}
	t[parts[parts.length - 1]] = val;
	return o;
};

/* ------------------------------------------------------------------ */
/* The two documents                                                  */
/* ------------------------------------------------------------------ */
/* Which document holds a path is decided by its first segment: a top-level key
   of the setup document must be listed here, or configValue reads it from the
   plan. */
const SETUP_KEYS = ['currencies', 'comparison', 'sensitivity', 'successThresholdsPct', 'simulation', 'staleAfterMonths'];
const documents = {
	setup: window.RETIREMENT_SETUP || {},
	plan: window.RETIREMENT_PLAN || {},
};
/* Reads the loaded document on every call, so a setting edited in the sheet takes
   effect at the next read. CONFIG_SPEC, checked in init(), guarantees a read finds
   something. */
const configValue = (path) => getPath(documents[SETUP_KEYS.includes(path.split('.')[0]) ? 'setup' : 'plan'], path);

/* --------------------------- configuration --------------------------- */
/* A path a plan file may carry that is not a field must be listed here, or sit
   beneath one, or a load reports it as ignored. */
const CONFIG_PATHS = [
	'currencies',
	'sources',
	'staleAfterMonths',
	'primary.pensionOptions',
	'secondary.pensionOptions',
	'primary.compulsory',
	'secondary.compulsory',
	'comparison',
	'sensitivity',
	'successThresholdsPct',
	'simulation',
];
const isConfigPath = (k) => CONFIG_PATHS.some((c) => k === c || k.startsWith(c + '.'));
/* The parts of the plan document that have no field; Save writes them and Load
   reads them back. */
const PLAN_ONLY_PATHS = [
	'primary.pensionOptions',
	'secondary.pensionOptions',
	'primary.compulsory',
	'secondary.compulsory',
	'sources',
];
/* Both halves required; unlike UI pairs they may be identical (億 is 億 in both). */
const isPair = (v) => !!v && typeof v.en === 'string' && typeof v.ja === 'string';
const isText = (v) => typeof v === 'string' && v.length > 0;
/* No part is required for a kind: switching kind in the settings sheet is how the
   box for the new kind's part appears, so requiring the part here would make the
   switch impossible. A kind whose part is missing forces nothing — see
   compulsoryRule. */
const COMPULSORY_KINDS = ['none', 'rmd', 'payout'];
const isDivisorTable = (v) =>
	!!v &&
	Object.keys(v).length > 0 &&
	Object.keys(v).every((a) => isFinite(a) && isFinite(v[a]) && v[a] > 0);
const isCompulsory = (v) =>
	v == null ||
	v.kind === 'none' ||
	(COMPULSORY_KINDS.includes(v.kind) &&
		(v.startAge === undefined || (isFinite(v.startAge) && v.startAge > 0)) &&
		(v.overYears === undefined || (isFinite(v.overYears) && v.overYears >= 1)) &&
		(v.divisors === undefined || isDivisorTable(v.divisors)));
/* [path, is-it-usable]. init() checks every entry, so a failed start names every
   problem at once, and settingValid() applies the same predicate to an edit. */
const CONFIG_SPEC = [
	...['primary', 'secondary'].flatMap((r) => [
		['currencies.' + r + '.code', isText],
		['currencies.' + r + '.symbol', isText],
		['currencies.' + r + '.name', isPair],
		['currencies.' + r + '.country', isPair],
		['currencies.' + r + '.adjective', isPair],
		['currencies.' + r + '.bigUnit.factor', (v) => isFinite(v) && v > 0],
		['currencies.' + r + '.bigUnit.label', isPair],
		['currencies.' + r + '.bigUnit.decimals', (v) => isFinite(v) && v >= 0],
		[
			r + '.pensionOptions',
			/* Stricter than claimOptions, which silently drops a malformed entry. */
			(v) =>
				Array.isArray(v) &&
				v.every((o) => o && isFinite(o.startAge) && o.startAge > 0 && isFinite(o.annual) && o.annual >= 0),
		],
	]),
	...['primary', 'secondary'].map((r) => [r + '.compulsory', isCompulsory]),
	['comparison.spendStepPct', (v) => isFinite(v) && v > 0],
	['comparison.sequenceYears', (v) => isFinite(v) && v >= 1],
	['sensitivity.returnStepsPct', (v) => Array.isArray(v) && v.indexOf(0) >= 0],
	['sensitivity.fxStepsPct', (v) => Array.isArray(v) && v.indexOf(0) >= 0],
	['successThresholdsPct.good', (v) => isFinite(v) && v >= 0 && v <= 100],
	['successThresholdsPct.fair', (v) => isFinite(v) && v >= 0 && v <= 100],
	['simulation.seed', isFinite],
	['simulation.minPaths', (v) => isFinite(v) && v >= 1],
	['staleAfterMonths', (v) => isFinite(v) && v > 0],
	[
		'sources',
		(v) =>
			v == null ||
			(typeof v === 'object' &&
				Object.values(v).every(
					(e) =>
						e &&
						typeof e === 'object' &&
						(e.asOf === undefined || /^\d{4}-\d\d-\d\d$/.test(e.asOf)) &&
						(e.url === undefined || typeof e.url === 'string'),
				)),
	],
];

const SPEC_BY_PATH = Object.fromEntries(CONFIG_SPEC);
const documentFor = (path) => (SETUP_KEYS.includes(path.split('.')[0]) ? 'setup' : 'plan');
function specPathCovering(path) {
	let best = null;
	for (const [p] of CONFIG_SPEC) {
		if ((path === p || path.startsWith(p + '.')) && (!best || p.length > best.length)) {
			best = p;
		}
	}
	return best;
}
function settingValid(path, value) {
	const spec = specPathCovering(path);
	if (!spec) {
		return true;
	}
	const trial = JSON.parse(JSON.stringify(documents[documentFor(path)]));
	setPath(trial, path, value);
	return SPEC_BY_PATH[spec](getPath(trial, spec));
}

/* -------------------- where the copied figures came from -------------------- */
/* The figures that are copies of something — statutory rates, tables, measured
   volatilities, benefit amounts — and so can carry a source and a date. */
const SOURCED_PATHS = [
	'plan.capitalGainsTaxPct',
	'plan.inflationPct',
	'primary.compulsory',
	'secondary.compulsory',
	'secondary.returnMeanPct',
	'secondary.returnVolatilityPct',
	'primary.returnMeanPct',
	'primary.returnVolatilityPct',
	'fx.volatilityPct',
	'correlations.secondaryPrimary',
	'correlations.secondaryFx',
	'correlations.primaryFx',
	'secondary.pensionOptions',
	'primary.pensionOptions',
];
const sourcedPathFor = (path) =>
	SOURCED_PATHS.find((p) => path === p || path.startsWith(p + '.')) || null;
const today = () => new Date().toISOString().slice(0, 10);
function monthsBetween(from, to) {
	const [fy, fm, fd] = from.split('-').map(Number);
	const [ty, tm, td] = to.split('-').map(Number);
	return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}
function sourceOf(path) {
	const p = sourcedPathFor(path);
	if (!p) {
		return null;
	}
	const entry = (configValue('sources') || {})[p] || {};
	const months = entry.asOf ? monthsBetween(entry.asOf, today()) : null;
	return {
		path: p,
		url: entry.url,
		asOf: entry.asOf,
		months,
		stale: months === null || months >= configValue('staleAfterMonths'),
	};
}
/* Once per sourced path: the four rows of a compulsory rule share one source. */
const stalePaths = () => SOURCED_PATHS.filter((p) => sourceOf(p).stale);
function stampSource(path) {
	const p = sourcedPathFor(path);
	if (!p) {
		return;
	}
	const doc = documents.plan;
	if (!doc.sources) {
		doc.sources = {};
	}
	if (!doc.sources[p]) {
		doc.sources[p] = {};
	}
	doc.sources[p].asOf = today();
}

/* Half a rule — a kind chosen but its part not yet filled in — forces nothing.
   The age and the divisor are Infinity where there is no rule, so the absence
   needs no special case downstream. */
function compulsoryRule(role) {
	const c = configValue(role + '.compulsory');
	if (!c || !c.kind || c.kind === 'none') {
		return null;
	}
	if (c.kind === 'payout') {
		return isFinite(c.startAge) && isFinite(c.overYears) && c.overYears >= 1 ? c : null;
	}
	return isDivisorTable(c.divisors) ? c : null;
}
function compulsoryAge(role) {
	const c = compulsoryRule(role);
	if (!c) {
		return Infinity;
	}
	return c.kind === 'payout' ? c.startAge : Math.min(...Object.keys(c.divisors).map(Number));
}
/* Resolves the rule and measures the table once, outside the returned function:
   the engine calls that a quarter of a million times a run, and doing this work
   inside it would be most of a run's cost. */
function compulsoryDivisorFn(role) {
	const c = compulsoryRule(role);
	if (!c) {
		return () => Infinity;
	}
	if (c.kind === 'payout') {
		return (age) => Math.max(1, c.overYears - (age - c.startAge));
	}
	/* No low clamp: the rule begins at the first row. */
	const hi = Math.max(...Object.keys(c.divisors).map(Number));
	return (age) => c.divisors[Math.min(hi, age)];
}
