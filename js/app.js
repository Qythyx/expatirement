'use strict';

/* One snapshot per document: the two files are saved separately, and saving one
   must not mark the other clean. */
const savedSnapshots = { plan: '', setup: '' };
/* A function, so the status line can be re-rendered in the other language when
   the toggle is pressed. */
let statusLabel = () => '';
let configRejected = false;
let planSource = '';
function showBanner(kind, headline, lines) {
	const box = document.getElementById('banner');
	box.className = { stop: 'banner', warn: 'banner warning', ok: 'banner success' }[kind];
	box.setAttribute('role', kind === 'stop' ? 'alert' : 'status');
	box.replaceChildren(el('b', {}, headline), lines.join('\n'));
	box.hidden = false;
}
function hideBanner() {
	document.getElementById('banner').hidden = true;
}
/* Checked by everything that simulates or draws: on a page stopped by a bad
   configuration, an edit would otherwise reach simulate() and throw on the
   absent settings. */
let configReady = false;
const snapshot = {
	plan: () => (configReady ? JSON.stringify(planDocument()) : ''),
	setup: () => JSON.stringify(documents.setup),
};
function dirtyDocs() {
	return ['plan', 'setup'].filter((d) => snapshot[d]() !== savedSnapshots[d]);
}
function isDirty() {
	return dirtyDocs().length > 0;
}
function updateStatus() {
	const statusLine = document.getElementById('save-status');
	const dirty = dirtyDocs();
	let msg = dirty.length
		? translate(dirty.length === 2 ? UI.dirtyBoth : dirty[0] === 'setup' ? UI.dirtySetup : UI.dirty)
		: statusLabel();
	if (configRejected) {
		msg += translate(UI.configRejectedSuffix);
	}
	statusLine.textContent = msg;
	statusLine.classList.toggle('danger', dirty.length > 0);
}
function markClean(label, which) {
	for (const d of which && which !== 'both' ? [which] : ['plan', 'setup']) {
		savedSnapshots[d] = snapshot[d]();
	}
	if (label != null) {
		statusLabel = label;
	}
	updateStatus();
}
const STATUS_LABELS = {
	saved: () => translate(UI.cleanSaved),
	setupSaved: () => translate(UI.cleanSetupSaved),
	loaded: () => translate(UI.cleanLoaded),
	loadedIgnoring: (n) => () => translate(UI.cleanLoadedIgnored)(n),
	defaults: () => translate(UI.cleanDefaults)(planSource),
	noFiles: () => {
		const missing = ['setup', 'plan']
			.filter((d) => !Object.keys(documents[d]).length)
			.map(configPath);
		return missing.length ? translate(UI.cleanNoFiles)(missing) : translate(UI.cleanBadConfig);
	},
};

function runMonteCarlo() {
	if (!configReady) {
		return;
	}
	const inputs = engineInputs();
	inputs.pathCount = inputs.montecarloPaths;
	document.getElementById('success-rate').setAttribute('aria-busy', 'true');
	setTimeout(() => {
		const run = simulate(inputs);
		/* Cached on the run, so redrawing and resizing never re-simulate. The labels
		   are functions, so a language switch relabels them without a new run. */
		run.variants = [
			{
				label: () => translate(UI.survivalSpendLower)(Math.round(spendStep() * 100)),
				color: SERIES_COLORS.better,
				run: simulate({ ...inputs, annualSpending: inputs.annualSpending * (1 - spendStep()) }),
			},
			{
				label: () => translate(UI.survivalSpendHigher)(Math.round(spendStep() * 100)),
				color: SERIES_COLORS.worse,
				run: simulate({ ...inputs, annualSpending: inputs.annualSpending * (1 + spendStep()) }),
			},
		];
		run.firstAge = inputs.currentAge;
		/* Kept on the run for the caption, which describes this run even after the
		   form has moved on. */
		run.paths = inputs.montecarloPaths;
		run.endAge = inputs.horizonEndAge;
		lastMonteCarlo = run;
		renderMonteCarlo();
		renderSummary();
		drawSurvival();
	}, 30);
}

/* ----------------------------- events ----------------------------- */
/* The Monte Carlo holds the page while it runs, so it waits for typing to stop;
   the cheap deterministic panels redraw sooner. */
const RENDER_DEBOUNCE_MS = 180,
	MONTE_CARLO_DEBOUNCE_MS = 400;
let renderTimer = null,
	monteCarloTimer = null;
function scheduleMonteCarlo(delay) {
	if (!configReady) {
		return;
	}
	clearTimeout(monteCarloTimer);
	monteCarloTimer = setTimeout(runMonteCarlo, delay === undefined ? MONTE_CARLO_DEBOUNCE_MS : delay);
}
function onInput() {
	/* Outside the debounce: the unsaved marker must not lag the edit. */
	updateStatus();
	clearTimeout(renderTimer);
	renderTimer = setTimeout(() => {
		renderSummary();
		renderSensitivity();
	}, RENDER_DEBOUNCE_MS);
	scheduleMonteCarlo();
}
/* Restores savedSnapshots — the last save, load or open — so the restore point is
   the point the dirty flag is measured against. */
document.getElementById('discard-changes').onclick = () => {
	if (!savedSnapshots.plan) {
		return;
	}
	documents.plan = JSON.parse(savedSnapshots.plan);
	documents.setup = JSON.parse(savedSnapshots.setup);
	Object.assign(BASE_PLAN, structuredClone(documents.plan));
	writeForm(BASE_PLAN);
	hideBanner();
	lastMonteCarlo = null;
	settingsChanged();
	renderAll();
	markClean(STATUS_LABELS.defaults, 'both');
};
function planDocument() {
	const o = readForm();
	for (const path of PLAN_ONLY_PATHS) {
		const v = configValue(path);
		if (v !== undefined) {
			setPath(o, path, v);
		}
	}
	return o;
}
function downloadFile(name, text, mime) {
	el('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name }).click();
}
/* Written as a script so that, renamed to plan.js, it loads through
   <script src> — the only way a file:// page can read a sibling file. */
function savePlan() {
	const today = new Date().toISOString().slice(0, 10);
	planSource = 'plan_' + today + '.js';
	downloadFile(
		planSource,
		'/* A plan saved by ' + APP_NAME + ' on ' + today + '.\n' +
			'   Rename to plan.js and put it beside setup.js to make\n' +
			'   it the state the page opens in. */\n' +
			'window.RETIREMENT_PLAN = ' + JSON.stringify(planDocument(), null, 2) + ';\n',
		'text/javascript',
	);
	markClean(STATUS_LABELS.saved, 'plan');
}
function saveSetup() {
	const today = new Date().toISOString().slice(0, 10);
	downloadFile(
		'setup_' + today + '.js',
		'/* Simulator setup saved on ' + today + '.\n' +
			'   Rename to setup.js and put it beside plan.js to make\n' +
			'   it the configuration the page reads. */\n' +
			'window.RETIREMENT_SETUP = ' + JSON.stringify(documents.setup, null, 2) + ';\n',
		'text/javascript',
	);
	markClean(STATUS_LABELS.setupSaved, 'setup');
}
document.getElementById('save-plan').onclick = savePlan;
document.getElementById('settings-save-plan').onclick = savePlan;
document.getElementById('settings-save-setup').onclick = saveSetup;
/* Loading a document runs it; the `window` parameter is not a sandbox. That is
   the trust the page already extends to the configuration it executes from disk
   on every open, and these are files it wrote or an AI wrote to its prompt. */
function readDocument(name, text) {
	if (!/\.js$/i.test(name)) {
		throw new Error('not a .js document');
	}
	const box = {};
	new Function('window', text)(box);
	if (box.RETIREMENT_REFRESH) {
		return { kind: 'refresh', doc: box.RETIREMENT_REFRESH };
	}
	const doc = box.RETIREMENT_PLAN;
	if (!doc) {
		throw new Error('not a plan or refresh document');
	}
	return { kind: 'plan', doc };
}
/* A divisor table's first row is the age its rule begins at, and an authority
   publishes the table for every cohort, so an incoming table is trimmed to the
   current first row — whole, it would start distributions years early. A hand
   edit is the user choosing that age, so it is not trimmed. */
function trimIncoming(path, value) {
	if (!path.endsWith('.compulsory') || !value || value.kind !== 'rmd') {
		return value;
	}
	const mine = compulsoryRule(path.split('.')[0]);
	if (!mine || mine.kind !== 'rmd' || !isDivisorTable(value.divisors)) {
		return value;
	}
	const from = Math.min(...Object.keys(mine.divisors).map(Number));
	const divisors = {};
	for (const age of Object.keys(value.divisors)) {
		if (Number(age) >= from) {
			divisors[age] = value.divisors[age];
		}
	}
	return Object.keys(divisors).length ? { ...value, divisors } : value;
}
/* A refresh comes from a third party, so an entry is applied only if its path is
   a sourced one; its value is, for a field, a finite number in the field's range
   and, for anything else, one the start-up check accepts; and its url and asOf
   make a source record the start-up check accepts. A refused entry changes nothing. */
function applyRefresh(patch) {
	const applied = [], refused = [];
	for (const [path, entry] of Object.entries(patch || {})) {
		const { value, url, asOf } = entry || {};
		const source = { url, asOf: asOf || today() };
		const allowed = sourcedPathFor(path) === path;
		const usable = FIELD_IDS.includes(path) ? Number.isFinite(value) && fieldInRange(path, value) : settingValid(path, value);
		if (!allowed || value === undefined || !usable || !SPEC_BY_PATH.sources({ [path]: source })) {
			refused.push(path);
			continue;
		}
		if (FIELD_IDS.includes(path)) {
			setPath(MODEL, path, value);
		} else {
			setPath(documents.plan, path, trimIncoming(path, value));
		}
		if (!documents.plan.sources) {
			documents.plan.sources = {};
		}
		documents.plan.sources[path] = source;
		applied.push(path);
	}
	return { applied, refused };
}
document.getElementById('load-plan').onclick = () => document.getElementById('plan-file').click();
document.getElementById('plan-file').onchange = (e) => {
	const file = e.target.files[0];
	if (!file) {
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		try {
			const read = readDocument(file.name, reader.result);
			if (read.kind === 'plan') {
				planSource = file.name;
			}
			if (read.kind === 'refresh') {
				const { applied, refused } = applyRefresh(read.doc);
				for (const id of FIELD_IDS) {
					paintField(id);
				}
				settingsChanged();
				const lines = [translate(UI.refreshApplied)(applied.length)];
				if (refused.length) {
					lines.push('', translate(UI.refreshRefused), '  ' + refused.join(', '));
				}
				showBanner(refused.length ? 'warn' : 'ok', translate(UI.bannerRefreshed), lines);
				lastMonteCarlo = null;
				renderAll();
				scheduleMonteCarlo(0);
				return;
			}
			const plan = read.doc;
			for (const path of PLAN_ONLY_PATHS) {
				const v = getPath(plan, path);
				if (v !== undefined) {
					setPath(documents.plan, path, v);
				}
			}
			const given = Object.keys(flatten(plan));
			const unplaceable = given.filter((k) => FIELD_IDS.indexOf(k) < 0 && !isConfigPath(k));
			writeForm(plan);
			refreshClaimFields();
			paintSettings();
			paintSources();
			/* After writeForm: an age the list does not offer has been snapped to the
			   first on offer, and reading the control back is what detects it. */
			const unlisted = Object.keys(CLAIM_FIELDS).filter(
				(id) =>
					getPath(plan, id) != null &&
					readNumber(document.getElementById(id)) !== getPath(plan, id),
			);
			const lines = [];
			if (unlisted.length) {
				lines.push(translate(UI.loadUnlisted));
				for (const id of unlisted) {
					lines.push('  ' + id + ' = ' + getPath(plan, id));
				}
			}
			if (unplaceable.length) {
				if (lines.length) {
					lines.push('');
				}
				lines.push(translate(UI.loadUnplaceable));
				lines.push('  ' + unplaceable.join(', '));
			}
			const count = unlisted.length + unplaceable.length;
			markClean(count ? STATUS_LABELS.loadedIgnoring(count) : STATUS_LABELS.loaded, 'plan');
			if (count) {
				showBanner('warn', translate(UI.bannerPartlyIgnored), lines);
			} else {
				hideBanner();
			}
			lastMonteCarlo = null;
			renderAll();
			scheduleMonteCarlo(0);
		} catch (err) {
			showBanner('stop', translate(UI.planFileUnreadable), []);
		}
	};
	reader.readAsText(file);
};
window.addEventListener('resize', () => {
	drawMain();
	drawSurvival();
});
function survivalNote() {
	const inputs = engineInputs();
	if (survivalView === 'sequence') {
		return translate(UI.noteSequence)(inputs.currentAge + sequenceYears());
	}
	return translate(UI.noteCompare)(inputs.horizonEndAge, Math.round(spendStep() * 100));
}
/* On the container, which is never replaced: the buttons are rebuilt with the
   table on every run. */
document.getElementById('outcomes').addEventListener('click', (e) => {
	const b = e.target.closest('button[data-view]');
	if (!b || b.dataset.view === survivalView) {
		return;
	}
	survivalView = b.dataset.view;
	document
		.querySelectorAll('#outcomes button[data-view]')
		.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === survivalView)));
	drawSurvival();
});

(function wireChartHover() {
	const canvas = document.getElementById('path-chart');
	canvas.addEventListener('mousemove', (e) => {
		if (!hoverGeom) {
			return;
		}
		const box = canvas.getBoundingClientRect();
		const x = e.clientX - box.left;
		const { xmin, xmax, width, pad, count } = hoverGeom;
		let next = null;
		if (x >= pad.l - 8 && x <= width - pad.r + 8) {
			const span = xmax - xmin || 1;
			const i = Math.round(((x - pad.l) / (width - pad.l - pad.r)) * span);
			next = Math.max(0, Math.min(count - 1, i));
		}
		if (next !== hoverIndex) {
			hoverIndex = next;
			drawMain();
		}
	});
	canvas.addEventListener('mouseleave', () => {
		if (hoverIndex !== null) {
			hoverIndex = null;
			drawMain();
		}
	});
})();
window.addEventListener('beforeunload', (e) => {
	if (isDirty()) {
		e.preventDefault();
		e.returnValue = '';
	}
});

function renderAll() {
	renderSummary();
	renderSensitivity();
	if (!lastMonteCarlo) {
		document.getElementById('success-rate').textContent = SYMBOLS.noValue;
		document.getElementById('outcomes').replaceChildren();
		document.getElementById('survival-chart').getContext('2d').clearRect(0, 0, 9999, 9999);
	}
}

/* ----------------------------- language ----------------------------- */
/* The one thing remembered between visits — inputs are saved to a file on
   purpose. The reads and writes are wrapped because a file:// page cannot always
   reach localStorage. */
const LANGUAGE_STORAGE_KEY = 'retsim.lang';
/* Which notes fold, and whether one starts open, is read from the markup: the
   `hidden` attribute is the resting state. A heading's text sits in a span of
   its own because applyLanguage replaces the children of every data-i18n
   element and would take the button with it. */
const infoToggles = [];
function wireInfoToggles() {
	[...document.querySelectorAll('.panel:not(#notes-panel)')]
		.map((panel) => [panel.querySelector(':scope > h2'), panel.querySelector(':scope > .note')])
		.concat([[document.querySelector('.title-block h1'), document.querySelector('.title-block .note')]])
		.filter(([heading, note]) => heading && note)
		.forEach(([heading, note], i) => {
			if (!note.id) {
				note.id = 'note' + i;
			}
			const btn = el('button', { type: 'button', className: 'icon', 'aria-controls': note.id }, SYMBOLS.info);
			btn.show = (hidden) => {
				note.hidden = hidden;
				btn.setAttribute('aria-expanded', String(!hidden));
				btn.setAttribute('aria-label', translate(hidden ? UI.infoShow : UI.infoHide));
				btn.title = btn.getAttribute('aria-label');
			};
			btn.show(note.hidden);
			btn.onclick = () => btn.show(!note.hidden);
			heading.appendChild(btn);
			infoToggles.push(btn);
		});
}

/* Nothing but its explanation, so it cannot fold in place like the other panels
   without leaving an empty one on screen. */
function wireNotesPanel() {
	const panel = document.getElementById('notes-panel');
	const entry = el('div', { id: 'notes-entry', className: 'caps' }, el('span', { dataset: { i18n: 'panelNotes' } }));
	sidebar.appendChild(entry);
	const show = (open) => {
		panel.hidden = !open;
		entry.hidden = open;
		if (open) {
			panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	};
	for (const [host, open] of [
		[entry, true],
		[panel.querySelector('h2'), false],
	]) {
		const btn = el(
			'button',
			{ type: 'button', className: 'icon', 'aria-controls': 'notes-panel', 'aria-expanded': String(!open) },
			SYMBOLS.info,
		);
		btn.relabel = () => {
			btn.setAttribute('aria-label', translate(open ? UI.infoShow : UI.infoHide));
			btn.title = btn.getAttribute('aria-label');
		};
		btn.relabel();
		btn.onclick = () => show(open);
		host.appendChild(btn);
		infoToggles.push(btn);
	}
	show(false);
}

function applyLanguage(next) {
	language = next === 'ja' ? 'ja' : 'en';
	document.documentElement.lang = language;
	document.title = APP_NAME + SYMBOLS.titleSeparator + translate(UI.tagline);
	const btn = document.getElementById('language-toggle');
	btn.textContent = translate(UI.languageButton);
	btn.lang = language === 'en' ? 'ja' : 'en';
	/* Before the data-i18n pass: wireNotesPanel adds an element that pass fills
	   in. The name goes in before wireInfoToggles puts a button beside it. The
	   placeholder goes in here because a page stopped by its configuration never
	   reaches renderAll. */
	if (!infoToggles.length) {
		document.querySelector('.title-block h1').textContent = APP_NAME;
		document.getElementById('success-rate').textContent = SYMBOLS.noValue;
		wireInfoToggles();
		wireNotesPanel();
	} else {
		for (const btn of infoToggles) {
			btn.show ? btn.show(btn.getAttribute('aria-expanded') === 'false') : btn.relabel();
		}
	}
	for (const node of document.querySelectorAll('[data-i18n]')) {
		node.replaceChildren(...richText(translate(UI[node.dataset.i18n])));
	}
	relabelForm();
	relabelSettings();
	paintSources();
	paintPrompts();
	refreshClaimFields();
	updateStatus();
	if (configReady) {
		/* After the data-i18n pass, which has just put the pre-run placeholder back
		   into #success-caption. renderAll does not redraw the survival chart, whose
		   curve labels are prose too. */
		renderMonteCarlo();
		renderAll();
		drawSurvival();
	}
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
	} catch {}
}
document.getElementById('language-toggle').onclick = () => applyLanguage(language === 'en' ? 'ja' : 'en');

/* ----------------------------- init ----------------------------- */
/* configUrl is the resolved URL — where the browser actually looked, for the
   failure banner; configPath is the src as written, which is how the file is
   named everywhere else. */
const configUrl = (which) => (document.querySelector('script[src$="/' + which + '.js"]') || {}).src || '';
const configPath = (which) =>
	(document.querySelector('script[src$="/' + which + '.js"]') || {}).getAttribute?.('src') || '';
function configProblems() {
	const empty = (d) => !Object.keys(documents[d]).length;
	if (empty('setup') && empty('plan')) {
		return [translate(UI.configDidNotLoad)(configUrl('setup').replace(/[^/]*$/, ''))];
	}
	const bad = [];
	for (const d of ['setup', 'plan']) {
		if (empty(d)) {
			bad.push(translate(UI.configFileMissing)(d, configUrl(d)));
		}
	}
	for (const [path, usable] of CONFIG_SPEC) {
		if (!usable(configValue(path))) {
			bad.push(translate(UI.configUnusable)(path));
		}
	}
	const fields = documents.plan,
		absent = FIELD_IDS.filter((k) => {
			const v = getPath(fields, k);
			return NULLABLE_FIELDS.has(k) ? v !== null && !isFinite(v) : !isFinite(v);
		});
	if (absent.length) {
		bad.push(translate(UI.configFieldsMissing)(absent.join(', ')));
	}
	const outOfRange = FIELD_IDS.filter((k) => {
		const v = getPath(fields, k);
		return isFinite(v) && !fieldInRange(k, v);
	});
	if (outOfRange.length) {
		bad.push(translate(UI.configFieldsOutOfRange)(outOfRange.join(', ')));
	}
	return bad.length ? [translate(UI.configIncomplete)].concat(bad) : [];
}
(function init() {
	/* Before anything writes text, including the failure banner. */
	let storedLanguage = null;
	try {
		storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
	} catch {}
	applyLanguage(storedLanguage || 'en');
	const problems = configProblems();
	if (problems.length) {
		configRejected = true;
		showBanner(
			'stop',
			translate(UI.bannerCannotStart),
			problems.concat(['', translate(UI.bannerFixAndReload)]),
		);
		Object.assign(BASE_PLAN, structuredClone(documents.plan));
		writeForm(BASE_PLAN);
		markClean(STATUS_LABELS.noFiles, 'both');
		return;
	}
	Object.assign(BASE_PLAN, structuredClone(documents.plan));
	planSource = configPath('plan');
	configReady = true;
	writeForm(BASE_PLAN);
	markClean(STATUS_LABELS.defaults, 'both');
	/* After the plan is in: a prompt quotes what it holds. */
	paintPrompts();
	document.getElementById('survival-note').replaceChildren(...richText(survivalNote()));
	renderAll();
	runMonteCarlo();
})();
