/* The input side: the field table, the field names, digit grouping, the
   claim-age dropdowns, and the chart's hover readout. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, isMain } from './harness.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
/* The two documents, and which top-level keys belong to each. Spelled out here so
   a key moving between files fails. Compared as sets: key order is not a
   contract, and `sources` only exists once something has a recorded source. */
const SETUP_EXPECTED = ['currencies', 'comparison', 'sensitivity', 'successThresholdsPct', 'simulation', 'staleAfterMonths'];
const PLAN_EXPECTED = ['primary', 'secondary', 'fx', 'correlations', 'plan'];
const PLAN_OPTIONAL = ['sources'];
const sameKeys = (got, want, optional = []) =>
	got.every((k) => want.includes(k) || optional.includes(k)) && want.every((k) => got.includes(k));

const suite = {
	name: 'form',
	description: 'input table, field names, claim-age fields, chart hover',
	window: { width: 1500, height: 1300 },
	focus: true,

	async run(t, { js, cmd, wait, downloads }) {
		/* ---- layout ---- */
		const layout = JSON.parse(
			await js(`const tb=document.querySelector('table.fields');
				return JSON.stringify({
					rows: tb.querySelectorAll('tr').length,
					sections: tb.querySelectorAll('th[scope="rowgroup"]').length,
					inputs: tb.querySelectorAll('input').length,
					claims: tb.querySelectorAll('tr.claim').length,
					claimSels: tb.querySelectorAll('select[data-claim]').length,
					asideW: Math.round(document.querySelector('aside').getBoundingClientRect().width),
					details: tb.querySelectorAll('details').length,
					sheetSections: document.querySelectorAll('#settings-body details').length,
				});`),
		);
		t.log('layout: ' + JSON.stringify(layout));
		/* 16 number boxes and 2 claim-age dropdowns in the sidebar; the other nineteen
		   fields live only in the settings sheet, and are asserted there. */
		t.ok(layout.inputs === 16, 'the sidebar keeps its sixteen number boxes', layout.inputs + ' inputs');
		t.ok(layout.sections === 4, '4 section headers, three of them untouched', String(layout.sections));
		t.ok(
			layout.rows === 4 + 16 + 2,
			'and no heading is left standing over an empty section',
			layout.rows + ' rows for 4 headings, 16 boxes and 2 dropdowns',
		);
		const reach = await js(`const side = [...document.querySelectorAll('table.fields [data-fieldrow]')].map((r) => r.dataset.fieldrow);
			const panel = [...document.querySelectorAll('#settings-body [id^="set:"]')].map((el) => el.id.slice(4));
			return JSON.stringify({
				side: side.length,
				panel: panel.length,
				fields: panel.filter((id) => FIELD_IDS.includes(id)).length,
				unreachable: FIELD_IDS.filter((id) => !side.includes(id) && !panel.includes(id)),
				sidebarNotInPanel: side.filter((id) => !panel.includes(id)),
			});`);
		const rc = JSON.parse(reach);
		t.ok(rc.side === 18, 'eighteen fields in the sidebar', String(rc.side));
		t.ok(!rc.unreachable.length, 'and no field reachable from neither place', rc.unreachable.join(', '));
		t.ok(
			!rc.sidebarNotInPanel.length && rc.fields === 37,
			'the panel is the complete set, the sidebar a subset of it',
			rc.fields + ' fields among ' + rc.panel + ' boxes in the panel',
		);
		t.ok(layout.claims === 2, '2 claim-age rows', String(layout.claims));
		t.ok(layout.claimSels === 2, 'each is a dropdown, not a number box', String(layout.claimSels));
		t.ok(layout.details === 0, 'the sidebar table has no collapsibles');
		t.ok(layout.sheetSections >= 8, 'the settings sheet does fold', layout.sheetSections + ' sections');
		t.ok(
			layout.asideW > 200 && layout.asideW < 520,
			'sidebar auto-sized',
			'aside ' + layout.asideW + 'px',
		);
		t.log(
			'column widths (label|unit|input): ' +
				(await js(`const r=document.querySelector('table.fields tr:not(.claim):has(input)');
					return JSON.stringify([...r.children].map(c=>Math.round(c.getBoundingClientRect().width)));`)),
		);

		/* ---- the simulation ran by itself ---- */
		const succ = await js("return document.getElementById('success-rate').textContent.trim();");
		t.ok(/^\d+(\.\d+)?%$/.test(succ), 'Monte Carlo ran on load', succ);
		const cells = await js("return document.querySelectorAll('table.outcomes tbody td[data-tip]').length;");
		t.ok(cells === 6, 'outcome table populated', cells + ' figure cells');
		t.ok(
			await js("return document.getElementById('path-legend').textContent.includes('median');"),
			'percentile bands drawn',
		);

		/* ---- hover ---- */
		const ink = () =>
			js(`const cv=document.getElementById('path-chart');
				return cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.reduce((a,b)=>a+b,0);`);
		const before = await ink();
		const idx = await js(`const cv=document.getElementById('path-chart'), b=cv.getBoundingClientRect();
			cv.dispatchEvent(new MouseEvent('mousemove',{clientX:b.left+b.width*0.55, clientY:b.top+80, bubbles:true}));
			return hoverIndex;`);
		t.ok(typeof idx === 'number' && idx > 0, 'hover maps x to a year index', 'index ' + idx);
		t.ok(before !== (await ink()), 'hover repaints the chart');
		const [age, startAge, endAge] = JSON.parse(
			await js('const p = engineInputs({}); return JSON.stringify([p.currentAge + hoverIndex, p.currentAge, p.horizonEndAge]);'),
		);
		t.ok(age >= startAge && age <= endAge, 'hovered age is inside the horizon', 'age ' + age);
		t.ok(
			(await js(`const cv=document.getElementById('path-chart'), b=cv.getBoundingClientRect();
				cv.dispatchEvent(new MouseEvent('mousemove',{clientX:b.left+2, clientY:b.top+80, bubbles:true}));
				return hoverIndex;`)) === null,
			'outside the plot area clears hover',
		);
		t.ok(
			(await js(`const cv=document.getElementById('path-chart'), b=cv.getBoundingClientRect();
				cv.dispatchEvent(new MouseEvent('mousemove',{clientX:b.left+b.width*0.5, clientY:b.top+80, bubbles:true}));
				cv.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true}));
				return hoverIndex;`)) === null,
			'mouseleave clears hover',
		);

		/* ---- field names ---- */
		/* readForm returns the nested shape, one sub-object per currency plus the
		   plan and the two things that join them. The field ids are the paths into
		   it, so flattening it has to give back exactly FIELD_IDS — that is the
		   invariant the save file, the plan file and the form all rest on. */
		const shape = JSON.parse(await js('return JSON.stringify(Object.keys(readForm()));'));
		t.ok(
			JSON.stringify(shape) ===
				JSON.stringify(['secondary', 'primary', 'fx', 'plan', 'correlations']),
			'readForm is grouped by currency',
			shape.join(', '),
		);
		const leaves = JSON.parse(await js('return JSON.stringify(Object.keys(flatten(readForm())).sort());'));
		const declared = JSON.parse(await js('return JSON.stringify(FIELD_IDS.slice().sort());'));
		t.ok(
			JSON.stringify(leaves) === JSON.stringify(declared) && leaves.length === 37,
			'its leaves are exactly the field ids',
			leaves.length + ' leaves, ' + declared.length + ' ids',
		);
		t.ok(
			leaves.includes('secondary.brokerage') && leaves.includes('plan.annualSpending'),
			'and they are paths, not currency-in-the-name',
			leaves.slice(0, 3).join(', '),
		);
		/* A key this version has no field for is reported, not dropped in silence —
		   including one inside a currency, which only shows up as a leaf because the
		   shape is nested */
		const stray = await js(`return JSON.stringify(Object.keys(flatten({plan: { currentAge: 57 }, strayKey: 1,
				primary: { brokrage: 2 }})).filter(
				(k) => FIELD_IDS.indexOf(k) < 0 && !isConfigPath(k)).sort());`);
		t.ok(
			stray === '["primary.brokrage","strayKey"]',
			'an unplaceable key is detectable, not silently dropped',
			stray,
		);

		/* ---- claim-age dropdowns and formatting ---- */
		const chosen = await js(`return [...document.querySelectorAll('table.fields select[data-claim]')]
			.map(s=>s.options[s.selectedIndex].textContent).join(' / ');`);
		t.ok(
			/Age \d+ — \$/.test(chosen) && /Age \d+ — ¥/.test(chosen),
			'each dropdown shows an age and its amount',
			chosen,
		);
		/* The amount is not an input, so there is nothing to customise. */
		t.ok(!chosen.includes('Custom'), 'no Custom option remains', chosen);
		/* the claim-age rows are their own markup, so their labels have to opt into the
		   shared tooltip delegation the same way an ordinary field label does */
		const claimTips = await js(`return JSON.stringify([...document.querySelectorAll('tr.claim label')]
			.map((l) => !!l.dataset.tip && l.getAttribute('for')));`);
		t.ok(
			claimTips === '["secondary.pensionStartAge","primary.pensionStartAge"]',
			'claim-age labels carry tooltips and point at their control',
			claimTips,
		);
		const derived = await js(`const p = engineInputs();
			const opt = CLAIM_FIELDS['secondary.pensionStartAge'].opts
				.find((o) => o[0] === readForm().secondary.pensionStartAge);
			return (p.secondaryPensionAnnual === opt[1]) + '/' + p.secondaryPensionAnnual;`);
		t.ok(derived.startsWith('true'), 'the engine gets the amount for the chosen age', derived);
		/* Against the loaded configuration: claim-age literals in the page would pass
		   everything above and fail here, and editing a benefit figure in
		   retirement_plan.js does not break the test. */
		const fromCfg = await js(`const d = documents.plan;
			const ages = [...d.secondary.pensionOptions, ...d.primary.pensionOptions].map(o=>o.startAge);
			const shown = [...document.querySelectorAll('select[data-claim] option')].map(o=>o.textContent);
			return JSON.stringify({
				counts: [...document.querySelectorAll('table.fields select[data-claim]')].map(s=>s.options.length),
				want: [d.secondary.pensionOptions.length, d.primary.pensionOptions.length],
				sheetCounts: [...document.querySelectorAll('#settings-body select[data-claim]')].map(s=>s.options.length),
				missing: ages.filter((a,i)=>!(shown[i]||'').startsWith('Age '+a)),
			});`);
		const cfg = JSON.parse(fromCfg);
		t.log('claim-age options from config: ' + fromCfg);
		t.ok(
			JSON.stringify(cfg.counts) === JSON.stringify(cfg.want),
			'each selector offers exactly the configured options',
			cfg.counts + ' vs ' + cfg.want,
		);
		t.ok(!cfg.missing.length, 'every configured claim age appears in order', cfg.missing.join(','));
		t.ok(
			JSON.stringify(cfg.sheetCounts) === JSON.stringify(cfg.counts),
			'and the settings sheet offers the same options as the sidebar',
			cfg.sheetCounts + ' vs ' + cfg.counts,
		);
		/* Both compulsory-distribution rules are configured, so nothing may read an age
		   or a divisor back from a literal. */
		const compulsory = await js(`const sec = documents.plan.secondary.compulsory;
			const pri = documents.plan.primary.compulsory;
			return JSON.stringify({
				kinds: [pri.kind, sec.kind],
				ages: [
					compulsoryAge('primary') === pri.startAge,
					compulsoryAge('secondary') === Math.min(...Object.keys(sec.divisors).map(Number)),
					sec.startAge === undefined,
				],
				rmd: [
					compulsoryDivisorFn('secondary')(73) === sec.divisors['73'],
					compulsoryDivisorFn('secondary')(999) === sec.divisors['120'],
				],
				payout: [0, 1, 19, 25].map((k) => compulsoryDivisorFn('primary')(pri.startAge + k)),
				overYears: pri.overYears,
			});`);
		const cr = JSON.parse(compulsory);
		t.log('compulsory rules: ' + compulsory);
		t.ok(JSON.stringify(cr.kinds) === '["payout","rmd"]',
			'each currency configures its own kind of rule', JSON.stringify(cr.kinds));
		t.ok(cr.ages.every(Boolean),
			'a payout starts at its own age and an rmd at its table\'s first row, with no second copy',
			JSON.stringify(cr.ages));
		t.ok(cr.rmd.every(Boolean),
			'an rmd divisor is the configured table, clamped at its top end', JSON.stringify(cr.rmd));
		t.ok(
			JSON.stringify(cr.payout) ===
				JSON.stringify([cr.overYears, cr.overYears - 1, 1, 1]),
			'a payout divisor counts the term down and clamps at 1, so the last year takes the rest',
			JSON.stringify(cr.payout),
		);
		const noRule = await js(`const keep = {
				primary: documents.plan.primary.compulsory,
				secondary: documents.plan.secondary.compulsory,
			};
			delete documents.plan.primary.compulsory;
			delete documents.plan.secondary.compulsory;
			const ages = [compulsoryAge('primary'), compulsoryAge('secondary')].join(',');
			renderSummary();
			const tile = [...document.querySelectorAll('#path-metrics .metric')].pop().querySelector('.figure').textContent;
			documents.plan.primary.compulsory = keep.primary;
			documents.plan.secondary.compulsory = keep.secondary;
			renderSummary();
			return ages + '/' + tile;`);
		t.ok(noRule === 'Infinity,Infinity/—',
			'with no rule configured on either side, nothing is ever forced out', noRule);
		/* 'none' must mean the same as no rule, or choosing it in the settings sheet
		   would keep the previous rule in force. */
		const kindNone = await js(`const keep = JSON.parse(JSON.stringify(documents.plan.secondary.compulsory));
			documents.plan.secondary.compulsory.kind = 'none';
			const out = compulsoryAge('secondary');
			documents.plan.secondary.compulsory = keep;
			return String(out);`);
		t.ok(kindNone === 'Infinity', 'and kind "none" means the same as no rule at all', kindNone);

		/* ---- the folded explanations ---- */
		/* Each panel's explanation starts folded behind the ⓘ in its heading. Folded,
		   not dropped: it is the only place the page explains itself. */
		const folded = await js(`const btns = [...document.querySelectorAll('.panel:not(#notes-panel) button.icon, .title-block button.icon')];
			const noteOf = (b) => document.getElementById(b.getAttribute('aria-controls'));
			const out = {
				count: btns.length,
				allFolded: btns.every((b) => noteOf(b).hidden && b.getAttribute('aria-expanded') === 'false'),
				allExplain: btns.every((b) => noteOf(b).textContent.trim().length > 60),
				labelled: btns.every((b) => (b.getAttribute('aria-label') || '').length > 3),
				/* the grid's axis caption is a key to reading the grid, not an
				   explanation of it, so it stays on screen */
				gridCaptionShown: !document.querySelector('#sensitivity-grid .note').hidden,
			};
			const b = btns[0], n = noteOf(b);
			b.click();
			out.opens = !n.hidden && b.getAttribute('aria-expanded') === 'true';
			b.click();
			out.closes = n.hidden;
			return JSON.stringify(out);`);
		const fd = JSON.parse(folded);
		t.log('folded explanations: ' + folded);
		t.ok(fd.count === 4, 'every panel note and the page subtitle folds behind a ⓘ', String(fd.count));
		t.ok(fd.allFolded, 'and each starts folded');
		t.ok(fd.allExplain, 'with its text kept in the page rather than dropped');
		t.ok(fd.labelled, 'each toggle carries a label of its own, not just the glyph');
		t.ok(fd.gridCaptionShown, 'the sensitivity grid keeps the caption naming its axes');
		t.ok(fd.opens && fd.closes, 'clicking one opens it and clicking again folds it', folded);

		/* Computed display, not the hidden property: a rule that sets display beats
		   [hidden], and the property would pass while the line stayed on screen. */
		const moved = await js(`const entry = document.getElementById('notes-entry');
			const panel = document.getElementById('notes-panel');
			const shown = (el) => getComputedStyle(el).display !== 'none';
			const out = {
				entryLast: document.querySelector('#sidebar').lastElementChild === entry,
				atRest: { entry: shown(entry), panel: !shown(panel) },
				/* the line is added after the page's first language pass has already
				   run, so it is the one labelled element that pass can miss */
				entryLabel: entry.querySelector('span').textContent.trim(),
			};
			entry.querySelector('button.icon').click();
			out.opened = { entry: !shown(entry), panel: shown(panel),
				text: panel.querySelector('.note').textContent.trim().length > 200 };
			panel.querySelector('h2 button.icon').click();
			out.closed = { entry: shown(entry), panel: !shown(panel) };
			return JSON.stringify(out);`);
		const mv = JSON.parse(moved);
		t.log('notes panel: ' + moved);
		t.ok(mv.entryLast, 'the sidebar ends with the notes line, below the fields');
		t.ok(mv.entryLabel === 'Notes & assumptions',
			'and the line is named, not left as a bare glyph', JSON.stringify(mv.entryLabel));
		t.ok(mv.atRest.entry && mv.atRest.panel,
			'at rest the line is in the sidebar and the panel is not on screen');
		t.ok(mv.opened.entry && mv.opened.panel && mv.opened.text,
			'opening it shows the panel in the main column and takes the line away', moved);
		t.ok(mv.opened.entry, 'and the line is gone from the screen, not merely marked hidden');
		t.ok(mv.closed.entry && mv.closed.panel, 'and closing it puts the line back');

		/* ---- a claim age the list does not offer ---- */
		/* An age with no entry in the list has no amount: left standing it would pay 0
		   with the dropdown on no option, so it snaps to the first age on offer. */
		const unlisted = await js(`const id = 'secondary.pensionStartAge';
			const keep = getPath(MODEL, id);
			const offered = CLAIM_FIELDS[id].opts.map((o) => o[0]);
			const absent = Math.max(...offered) + 1;
			writeForm(setPath({ ...readForm() }, id, absent));
			refreshClaimFields();
			const sel = document.getElementById(id);
			const out = {
				offered,
				model: getPath(MODEL, id),
				selected: readNumber(sel),
				blank: sel.selectedIndex === -1,
				age: engineInputs().secondaryPensionStartAge,
				amount: engineInputs().secondaryPensionAnnual,
			};
			const list = configValue('secondary.pensionOptions');
			const kept = JSON.parse(JSON.stringify(list));
			documents.plan.secondary.pensionOptions = list.slice(1);
			refreshClaimFields();
			out.afterListEdit = getPath(MODEL, id);
			out.nowOffered = CLAIM_FIELDS[id].opts.map((o) => o[0]);
			documents.plan.secondary.pensionOptions = kept;
			refreshClaimFields();
			setPath(MODEL, id, keep);
			refreshClaimFields();
			onInput();
			return JSON.stringify(out);`);
		const ul = JSON.parse(unlisted);
		t.log('unlisted claim age: ' + unlisted);
		t.ok(ul.model === ul.offered[0],
			'an age the list does not offer becomes the first age it does', JSON.stringify(ul.model));
		t.ok(!ul.blank && ul.selected === ul.offered[0],
			'so the dropdown sits on a real option rather than none', JSON.stringify(ul.selected));
		t.ok(ul.amount > 0 && ul.age === ul.offered[0],
			'and the pension pays what that age is worth instead of nothing', JSON.stringify([ul.age, ul.amount]));
		t.ok(ul.afterListEdit === ul.nowOffered[0],
			'dropping the selected age from the list moves the selection too', unlisted);
		t.ok(
			await js("return translate(UI.loadUnlisted).includes('the first was chosen');"),
			'and the load report says the first was chosen, not that a default was kept',
			await js('return translate(UI.loadUnlisted);'),
		);

		/* ---- a refresh may not move where distributions begin ---- */
		/* An authority publishes its divisor table for every birth cohort, starting
		   below the age that applies here; taken whole, it would start distributions
		   years early. */
		const trimmed = await js(`const keep = JSON.parse(JSON.stringify(configValue('secondary.compulsory')));
			const keepSources = documents.plan.sources ? JSON.parse(JSON.stringify(documents.plan.sources)) : undefined;
			const before = compulsoryAge('secondary');
			/* what the IRS actually publishes: the same table, three rows lower */
			const full = { kind: 'rmd', divisors: { 72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 120: 2 } };
			const { applied } = applyRefresh({
				'secondary.compulsory': { value: full, url: 'https://irs', asOf: '2026-08-02' },
			});
			const now = configValue('secondary.compulsory');
			const out = {
				applied,
				before,
				after: compulsoryAge('secondary'),
				lowestRow: Math.min(...Object.keys(now.divisors).map(Number)),
				updated: now.divisors['75'] === 24.6 && now.divisors['120'] === 2,
			};
			documents.plan.secondary.compulsory = keep;
			if (keepSources) documents.plan.sources = keepSources; else delete documents.plan.sources;
			paintSettings();
			paintSources();
			return JSON.stringify(out);`);
		const tr = JSON.parse(trimmed);
		t.log('trimmed refresh: ' + trimmed);
		t.ok(tr.applied.includes('secondary.compulsory'), 'the refresh is applied', tr.applied.join(', '));
		t.ok(tr.after === tr.before && tr.after === 75,
			'and does not move the age distributions begin at', tr.before + ' -> ' + tr.after);
		t.ok(tr.lowestRow === 75, 'the rows below it are dropped rather than kept unused', String(tr.lowestRow));
		t.ok(tr.updated, 'while the rows that do apply take the refreshed values');

		/* ---- choosing a scheme in the settings sheet ---- */
		/* A part the chosen kind does not use goes away, but its cell keeps its column:
		   hidden outright, the surviving cell slides under the other country's heading,
		   which reads as correct and is not. */
		const schemes = await js(`openSettings();
			/* every section opened so the rows can be measured, and put back afterwards:
			   which of them start open is asserted further down */
			const wasOpen = [...document.querySelectorAll('#settings-body details')].map((d) => d.open);
			for (const d of document.querySelectorAll('#settings-body details')) d.open = true;
			const cellOf = (path) => document.getElementById('set:' + path).closest('.setting-control');
			const shown = (path) => !cellOf(path).classList.contains('not-applicable');
			const col = (path) => Math.round(cellOf(path).getBoundingClientRect().left);
			const pick = (role, kind) => {
				const sel = document.getElementById('set:' + role + '.compulsory.kind');
				sel.value = kind;
				sel.dispatchEvent(new Event('change', { bubbles: true }));
			};
			const keep = {
				primary: JSON.parse(JSON.stringify(configValue('primary.compulsory'))),
				secondary: JSON.parse(JSON.stringify(configValue('secondary.compulsory'))),
			};
			const out = { asConfigured: {
				primaryTerm: shown('primary.compulsory.overYears'),
				primaryDivisors: shown('primary.compulsory.divisors'),
				secondaryDivisors: shown('secondary.compulsory.divisors'),
				secondaryTerm: shown('secondary.compulsory.overYears'),
			} };
			out.divisorsInOwnColumn = col('secondary.compulsory.divisors') === col('secondary.compulsory.kind');
			/* the start-age row has no US box, so it must not carry a US source line */
			const ageRow = document.getElementById('set:primary.compulsory.startAge').closest('.setting-row');
			out.sourceFollowsCell =
				!ageRow.querySelector('[data-src="secondary.compulsory"]').hidden === false &&
				ageRow.querySelector('[data-src="primary.compulsory"]').hidden === false;

			pick('primary', 'rmd');
			out.afterSwitch = {
				kind: configValue('primary.compulsory.kind'),
				divisors: shown('primary.compulsory.divisors'),
				term: shown('primary.compulsory.overYears'),
				age: String(compulsoryAge('primary')),
			};
			/* the other direction, which is not the same code path: a payout needs a start
			   age and a term, and both boxes only appear once the kind is payout */
			pick('secondary', 'payout');
			out.toPayout = {
				kind: configValue('secondary.compulsory.kind'),
				rejected: document.getElementById('set:secondary.compulsory.kind').getAttribute('aria-invalid') === 'true',
				startAge: shown('secondary.compulsory.startAge'),
				term: shown('secondary.compulsory.overYears'),
				divisors: shown('secondary.compulsory.divisors'),
				age: String(compulsoryAge('secondary')),
			};
			pick('secondary', 'rmd');
			out.backToRmd = {
				kind: configValue('secondary.compulsory.kind'),
				age: String(compulsoryAge('secondary')),
			};

			pick('primary', 'none');
			out.afterNone = {
				startAge: shown('primary.compulsory.startAge'),
				age: String(compulsoryAge('primary')),
			};
			documents.plan.primary.compulsory = keep.primary;
			documents.plan.secondary.compulsory = keep.secondary;
			settingsChanged();
			[...document.querySelectorAll('#settings-body details')].forEach((d, i) => (d.open = wasOpen[i]));
			closeSettings();
			return JSON.stringify(out);`);
		const sc = JSON.parse(schemes);
		t.log('schemes: ' + schemes);
		t.ok(
			sc.asConfigured.primaryTerm &&
				!sc.asConfigured.primaryDivisors &&
				sc.asConfigured.secondaryDivisors &&
				!sc.asConfigured.secondaryTerm,
			'each column shows only the parts its own kind of rule uses',
			JSON.stringify(sc.asConfigured),
		);
		t.ok(sc.divisorsInOwnColumn,
			'and the part that stays keeps its column, rather than sliding under the other country');
		t.ok(sc.sourceFollowsCell,
			'a source line goes with the box it describes, not the row it sits in',
			JSON.stringify(sc.sourceFollowsCell));
		t.ok(sc.afterSwitch.kind === 'rmd' && sc.afterSwitch.divisors && !sc.afterSwitch.term,
			'switching kind applies and swaps which parts are on offer', JSON.stringify(sc.afterSwitch));
		t.ok(sc.afterSwitch.age === 'Infinity',
			'and a kind whose part is not filled in yet forces nothing', sc.afterSwitch.age);
		t.ok(!sc.afterNone.startAge && sc.afterNone.age === 'Infinity',
			'choosing none takes every part away and stops the rule', JSON.stringify(sc.afterNone));
		t.ok(
			sc.toPayout.kind === 'payout' && !sc.toPayout.rejected,
			'switching the other way is accepted too, though its parts are not filled in yet',
			JSON.stringify(sc.toPayout),
		);
		t.ok(sc.toPayout.startAge && sc.toPayout.term && !sc.toPayout.divisors,
			'and it offers the boxes that kind needs', JSON.stringify(sc.toPayout));
		t.ok(sc.toPayout.age === 'Infinity',
			'forcing nothing until they are', sc.toPayout.age);
		t.ok(sc.backToRmd.kind === 'rmd' && sc.backToRmd.age === '75',
			'switching back finds the table still there, so nothing was lost',
			JSON.stringify(sc.backToRmd));

		/* ---- the forced payout, in the engine ---- */
		/* The 'payout' kind is the only thing in the model that empties an account.
		   The primary retirement account gets far more than the plan can spend, so only
		   the rule moves money out of it, and a null growth rate, so it rides the same
		   market return as the brokerage it is forced into. What is left is the income
		   tax the forced draw pays, so the estate is smaller with the rule; equal
		   figures would mean the block never fired. */
		const drained = await js(`const base = Object.assign(engineInputs(), {
				pathCount: 300, currentAge: 50, horizonEndAge: 95,
				primaryRetirement: 200000000, primaryRetirementGrowthPct: null,
				annualSpending: 3000000, mortgageAnnual: 0, secondaryScheduledDraw: 0,
			});
			const median = (r) => percentile(r.endPortfolio, 0.5);
			const withRule = median(simulate(Object.assign({}, base, { primaryCompulsoryAge: 75 })));
			const without = median(simulate(Object.assign({}, base, { primaryCompulsoryAge: Infinity })));
			return JSON.stringify({ withRule: Math.round(withRule), without: Math.round(without) });`);
		const dr = JSON.parse(drained);
		t.log('forced payout, median estate: ' + drained);
		t.ok(
			dr.withRule < dr.without,
			'forcing the account out costs tax the untouched account never pays',
			dr.withRule + ' vs ' + dr.without,
		);

		/* ---- a field refuses a number it cannot mean ---- */
		/* An out-of-range number is still a number, and would be simulated silently and
		   wrongly, so the box refuses it and the previous value stays in force. */
		const ranges = await js(`const type = (id, text) => {
				/* a field has a box in the settings sheet always and in the sidebar only if
				   it is one of the handful kept there */
				const el = document.getElementById(id) || document.getElementById('set:' + id);
				el.focus(); el.value = text;
				el.dispatchEvent(new Event('input', { bubbles: true })); el.blur();
				/* the computed border, not the attribute: a more specific rule can keep a
				   marked box looking untouched */
				const red = getComputedStyle(el).borderTopColor === 'rgb(156, 66, 33)';
				return { stored: getPath(MODEL, id), marked: red };
			};
			const out = {};
			const keepSpend = getPath(MODEL, 'plan.annualSpending');
			out.negativeBalance = type('plan.annualSpending', '-1000');
			out.keptPrevious = getPath(MODEL, 'plan.annualSpending') === keepSpend;
			out.recovers = type('plan.annualSpending', String(keepSpend));
			type('plan.annualSpending', '-1000');
			const red = (el) => getComputedStyle(el).borderTopColor === 'rgb(156, 66, 33)';
			out.markedInBothBoxes =
				red(document.getElementById('plan.annualSpending')) &&
				red(document.getElementById('set:plan.annualSpending'));
			type('plan.annualSpending', String(keepSpend));

			const keepSmile = getPath(MODEL, 'plan.annualSpendingChangePct');
			out.spendingSmile = type('plan.annualSpendingChangePct', '-1');
			setPath(MODEL, 'plan.annualSpendingChangePct', keepSmile);
			const keepInfl = getPath(MODEL, 'plan.inflationPct');
			out.deflation = type('plan.inflationPct', '-0.5');
			setPath(MODEL, 'plan.inflationPct', keepInfl);
			const keepGain = getPath(MODEL, 'primary.brokerageGainPct');
			out.underwater = type('primary.brokerageGainPct', '-15');
			setPath(MODEL, 'primary.brokerageGainPct', keepGain);

			const keepCorr = getPath(MODEL, 'correlations.secondaryPrimary');
			out.negativeCorr = type('correlations.secondaryPrimary', '-0.4');
			setPath(MODEL, 'correlations.secondaryPrimary', keepCorr);
			out.impossibleCorr = type('correlations.secondaryPrimary', '4');
			setPath(MODEL, 'correlations.secondaryPrimary', keepCorr);

			for (const id of FIELD_IDS) markFieldBad(id, false);
			for (const id of FIELD_IDS) paintField(id);
			onInput();
			return JSON.stringify(out);`);
		const rg = JSON.parse(ranges);
		t.log('field ranges: ' + ranges);
		t.ok(rg.negativeBalance.marked && rg.keptPrevious,
			'a negative balance is refused and the previous value stays in force', JSON.stringify(rg.negativeBalance));
		t.ok(!rg.recovers.marked, 'and the mark clears when the value is valid again');
		t.ok(rg.markedInBothBoxes,
			'and it is marked in the sidebar as well as the panel, not only in one of them',
			JSON.stringify(rg.markedInBothBoxes));
		t.ok(!rg.spendingSmile.marked && rg.spendingSmile.stored === -1,
			'a negative spending change is allowed — it is the retirement spending smile',
			JSON.stringify(rg.spendingSmile));
		t.ok(!rg.deflation.marked && rg.deflation.stored === -0.5,
			'and negative inflation, which is deflation', JSON.stringify(rg.deflation));
		t.ok(!rg.underwater.marked && rg.underwater.stored === -15,
			'and a negative gain ratio, which is a holding under water', JSON.stringify(rg.underwater));
		t.ok(!rg.negativeCorr.marked && rg.negativeCorr.stored === -0.4,
			'a correlation may be negative', JSON.stringify(rg.negativeCorr));
		t.ok(rg.impossibleCorr.marked, 'but not greater than 1', JSON.stringify(rg.impossibleCorr));

		/* ---- a run stays interactive ---- */
		/* Every edit re-runs the simulation, so a run must stay fast. The bound is far
		   above a normal run, so a slow machine cannot trip it; it catches work moving
		   into the per-path, per-year loop, such as resolving the compulsory rule on
		   every divisor lookup. */
		const runMs = await js(`const p10k = Object.assign(engineInputs(), { pathCount: 10000 });
			simulate(p10k);
			const t0 = performance.now();
			for (let i = 0; i < 3; i++) simulate(p10k);
			return (performance.now() - t0) / 3;`);
		t.log('10,000-path run: ' + runMs.toFixed(0) + 'ms');
		t.ok(runMs < 300, 'a 10,000-path run stays well inside a keystroke', runMs.toFixed(0) + 'ms');

		/* ---- discarding changes ---- */
		/* Discarding restores the settings that have no field as well as the fields,
		   and goes back to the last save, not to the file the page opened on. */
		const discard = await js(`const beforeSpend = readForm().plan.annualSpending;
			const beforeSymbol = configValue('currencies.primary.symbol');
			const out = {};

			setPath(MODEL, 'plan.annualSpending', beforeSpend + 1000000);
			setPath(documents.setup, 'currencies.primary.symbol', 'Z');
			settingsChanged();
			out.bothChanged = readForm().plan.annualSpending !== beforeSpend && configValue('currencies.primary.symbol') === 'Z';

			document.getElementById('discard-changes').click();
			out.field = readForm().plan.annualSpending === beforeSpend;
			out.setting = configValue('currencies.primary.symbol') === beforeSymbol;
			out.said = document.getElementById('save-status').textContent;
			out.clean = !isDirty();
			/* the label is built from the currencies, so a stale copy of them would
			   show up here as the old symbol still on a box */
			out.relabelled = ![...document.querySelectorAll('.unit')].some((u) => u.textContent === 'Z');

			setPath(MODEL, 'plan.annualSpending', beforeSpend + 2000000);
			onInput();
			savePlan();
			setPath(MODEL, 'plan.annualSpending', beforeSpend + 3000000);
			onInput();
			document.getElementById('discard-changes').click();
			out.backToSave = readForm().plan.annualSpending === beforeSpend + 2000000;
			out.saidAfterSave = document.getElementById('save-status').textContent;

			setPath(MODEL, 'plan.annualSpending', beforeSpend);
			onInput();
			markClean(STATUS_LABELS.saved, 'plan');
			return JSON.stringify(out);`);
		const dc = JSON.parse(discard);
		t.log('discard: ' + discard);
		t.ok(dc.bothChanged, 'a field and a settings-only value can both be edited', discard);
		t.ok(dc.field, 'discarding puts the field back');
		t.ok(dc.setting, 'and the setting that has no field, which it used to leave changed');
		t.ok(dc.relabelled, 'and the page is relabelled from the restored currencies');
		t.ok(dc.clean, 'and nothing is left reading as unsaved', dc.said);
		t.ok(/retirement_plan\.js/.test(dc.said),
			'with the status back to naming the file the page opened on', dc.said);
		t.ok(dc.backToSave, 'a save moves the restore point, so a discard stops there', discard);
		t.ok(/^showing retirement_plan_\d{4}-\d\d-\d\d\.js$/.test(dc.saidAfterSave),
			'and the status names the file it went back to, not the one the page opened on',
			dc.saidAfterSave);
		/* A sidebar unit cell carries the field id and reaches its unit through
		   FIELD_BY_ID; a sheet unit span carries the UNITS key itself. hasOwn, not
		   truthiness: UNITS.num is ''. Counted as well as checked, so an attribute
		   that went missing everywhere could not pass this vacuously: the 16 sidebar
		   boxes each have a cell, and every non-claim field has a span in the sheet. */
		const units = JSON.parse(
			await js(`const cells = [...document.querySelectorAll('[data-unit]')];
				return JSON.stringify({
					sidebar: cells.filter((u) => u.matches('table.fields td')).length,
					sheet: cells.filter((u) => u.matches('#settings-body span')).length,
					unknown: cells
						.map((u) => (u.matches('table.fields td') ? (FIELD_BY_ID[u.dataset.unit] || {}).unit : u.dataset.unit))
						.filter((key) => !Object.hasOwn(UNITS, key)),
				});`),
		);
		t.ok(!units.unknown.length, 'every unit cell and unit span names a key UNITS has', units.unknown.join(', '));
		t.ok(
			units.sidebar === 16 && units.sheet >= 35,
			'and there is one on every sidebar box and every non-claim field in the sheet',
			units.sidebar + ' cells, ' + units.sheet + ' spans',
		);

		/* ---- the settings sheet ---- */
		/* The sidebar holds only a handful of fields, so that the sheet covers every
		   one has to be asserted. */
		const sheet = await js(`const cells = [...document.querySelectorAll('#settings-body [id^="set:"]')].map((el) => el.id.slice(4));
			return JSON.stringify({
			display: getComputedStyle(document.getElementById('settings-sheet')).display,
			rows: cells.filter((p) => FIELD_IDS.includes(p)),
			sections: [...document.querySelectorAll('#settings-body details')].map((d) => ({
				open: d.open,
				rows: d.querySelectorAll('.setting-row').length,
			})),
			described: [...document.querySelectorAll('#settings-body .setting-row')]
				.map((r) => document.getElementById(r.querySelector('[aria-describedby]').getAttribute('aria-describedby')))
				.filter((p) => p.textContent.length > 20).length,
			labelled: [...document.querySelectorAll('#settings-body .setting-row > label')].filter((l) => l.textContent.length).length,
			settings: cells.filter((p) => !FIELD_IDS.includes(p)),
			allRows: document.querySelectorAll('#settings-body .setting-row').length,
			paired: document.querySelectorAll('#settings-body .setting-row > .setting-control:nth-of-type(2)').length,
		});`);
		const sh = JSON.parse(sheet);
		t.ok(sh.display === 'none', 'the sheet is closed until asked for', sh.display);
		t.ok(
			JSON.stringify(sh.rows.slice().sort()) === JSON.stringify(declared),
			'it holds every field exactly once',
			sh.rows.length + ' rows for ' + declared.length + ' fields',
		);
		t.ok(
			sh.settings.length === 35 && sh.rows.length + sh.settings.length === sh.allRows + sh.paired,
			'and every setting that is not a field',
			sh.settings.length + ' settings, ' + sh.allRows + ' rows holding ' +
				(sh.rows.length + sh.settings.length) + ' boxes, ' + sh.paired + ' of them paired',
		);
		t.ok(
			sh.described === sh.allRows && sh.labelled === sh.allRows,
			'each with its label and its full description, not a tooltip',
			sh.described + ' described, ' + sh.labelled + ' labelled, of ' + sh.allRows,
		);
		/* Checked against the documents, not a count. A source record has no box; its
		   line under the row stands for it. */
		const covered = await js(`const shown = new Set(
				[...document.querySelectorAll('#settings-body [id^="set:"]')].map((el) => el.id.slice(4)),
			);
			for (const line of document.querySelectorAll('#settings-body [data-src]'))
				shown.add('sources.' + sourcedPathFor(line.dataset.src));
			const leaves = (o, p) => Object.entries(o).flatMap(([k, v]) => {
				const path = p ? p + '.' + k : k;
				return v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, path) : [path];
			});
			const missing = [...leaves(documents.setup, ''), ...leaves(documents.plan, '')]
				.filter((path) => ![...shown].some((s) => path === s || path.startsWith(s + '.')));
			return JSON.stringify(missing);`);
		t.ok(JSON.parse(covered).length === 0, 'and nothing in either document is unreachable', covered);
		const open = sh.sections.filter((x) => x.open).length;
		t.ok(open === 2 && sh.sections.length === 10,
			'open on the sections that change, closed on the ones that do not',
			open + ' of ' + sh.sections.length + ' open');

		const onOpen = await js(`const before = document.getElementById('plan.annualSpending').value;
			openSettings();
			const sheetVal = document.getElementById('set:plan.annualSpending').value;
			const focused = document.activeElement.id;
			closeSettings();
			return JSON.stringify({ before, sheetVal, focused, grouped: sheetVal.includes(',') });`);
		const oo = JSON.parse(onOpen);
		t.ok(oo.grouped && oo.sheetVal === oo.before,
			'and opens showing the same grouped figure the sidebar has', JSON.stringify(oo));
		t.ok(oo.focused === 'settings-sheet', 'focus lands on the sheet, not on a field', oo.focused);

		/* Escape and the backdrop both close it. Real input through the protocol,
		   because a native dialog answers to the browser's own key and pointer
		   handling: a synthetic KeyboardEvent does not close it, and a click on the
		   backdrop is a click at a point outside the dialog's box. */
		const isOpen = () => js("return document.getElementById('settings-sheet').open === true;");
		await js('openSettings(); return 1;');
		const opens = await isOpen();
		for (const type of ['keyDown', 'keyUp']) {
			await cmd('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
		}
		const openAfterEscape = await isOpen();
		await js('openSettings(); return 1;');
		for (const type of ['mousePressed', 'mouseReleased']) {
			await cmd('Input.dispatchMouseEvent', { type, x: 5, y: 5, button: 'left', clickCount: 1 });
		}
		const openAfterBackdrop = await isOpen();
		t.ok(
			opens && !openAfterEscape && !openAfterBackdrop,
			'Escape and the backdrop close it',
			'open ' + opens + ', after Escape ' + openAfterEscape + ', after backdrop ' + openAfterBackdrop,
		);
		t.ok(
			await js("return document.getElementById('settings-save-plan').onclick === document.getElementById('save-plan').onclick;"),
			'the sheet\'s Save is the toolbar\'s Save, not a second one to keep in step',
		);

		/* ---- the prompts, and the refresh they ask for ---- */
		const prompts = JSON.parse(await js(`return JSON.stringify({
			keys: [...document.querySelectorAll('[data-prompt]')].map((b) => b.dataset.prompt),
			statute: promptText('statute'),
			measured: promptText('measured'),
			assumptions: promptText('assumptions'),
			buttons: [...document.querySelectorAll('.prompt button')].map((b) => b.textContent),
			unresolved: [...document.querySelectorAll('.prompt textarea')]
				.flatMap((t) => t.value.match(/\\{[a-z][\\w.]*\\}/gi) || []),
		});`));
		t.ok(
			JSON.stringify(prompts.keys) === '["measured","assumptions","statute"]',
			'a prompt sits in the section whose figures it refreshes',
			prompts.keys.join(', '),
		);
		t.ok(!prompts.unresolved.length,
			'and every placeholder in it is filled from the config', prompts.unresolved.join(', '));
		t.ok(
			prompts.statute.includes('resident of Japan') && prompts.statute.includes('pre-tax US retirement'),
			'the statute prompt names both jurisdictions',
		);
		t.ok(
			prompts.statute.includes('20.315') && /\d\d-row divisor table running from age 75/.test(prompts.statute),
			'quotes what the plan holds, summarising the table rather than pasting fifty rows',
		);
		t.ok(
			prompts.measured.includes('USD/JPY') && prompts.measured.includes('the window'),
			'the measured prompt insists on being told the estimation window',
		);
		/* The assumptions prompt must not turn a choice into a lookup: institutions
		   disagree by about the two points on a mean return that decide a plan. */
		t.ok(
			/do not tell me which to use/i.test(prompts.assumptions) &&
				/not average the institutions/i.test(prompts.assumptions) &&
				/arithmetic or geometric/i.test(prompts.assumptions),
			'the assumptions prompt asks for the spread, declines to pick, and pins down the mean',
		);
		t.ok(prompts.statute !== prompts.assumptions, 'the three are not one prompt in three places');
		/* A refused clipboard write must leave the reader something to do. The refusal
		   is forced: the real key and pointer input above has given the page the user
		   gesture that would let a write through. A successful copy goes first, so the
		   refusal has a success tone to take away. */
		const copied = await js(`openSettings();
			const view = PROMPT_VIEWS.find((v) => v.key === 'statute');
			view.copyButton.closest('details').open = true;
			const copy = (write) => new Promise((r) => {
				navigator.clipboard.writeText = write;
				view.copyButton.click();
				setTimeout(() => r(view.copyStatus.classList.contains('success')), 300);
			});
			return copy(() => Promise.resolve()).then((copiedAsSuccess) =>
				copy(() => Promise.reject(new Error('refused'))).then((refusedAsSuccess) => {
					delete navigator.clipboard.writeText;
					const out = {
						copiedAsSuccess,
						refusedAsSuccess,
						said: view.copyStatus.textContent,
						selected: document.activeElement === view.prompt,
					};
					closeSettings();
					return JSON.stringify(out);
				}),
			);`);
		const cp = JSON.parse(copied);
		t.ok(
			cp.said.length > 10 && cp.selected,
			'a refused clipboard write selects the text and says to press ⌘C',
			cp.said,
		);
		t.ok(
			cp.copiedAsSuccess && !cp.refusedAsSuccess,
			'and only a copy that went through is shown as a success',
			'copied ' + cp.copiedAsSuccess + ', refused ' + cp.refusedAsSuccess,
		);
		const unloaded = ['statute', 'measured', 'assumptions'].flatMap((k) =>
			prompts[k]
				.split('\n')
				.filter((l) => /undefined|NaN/.test(l))
				.map((l) => k + ': ' + l.trim()),
		);
		t.ok(!unloaded.length, 'no prompt quotes a value the page had not loaded yet',
			unloaded.join(' | '));
		/* An AI answers in prose around a code block, so the paste must survive the
		   whole answer, fences and commentary included. */
		const pasted = await js(`const view = PROMPT_VIEWS.find((v) => v.key === 'statute');
			const ta = view.paste;
			const before = readForm().plan.capitalGainsTaxPct;
			const keepSources = documents.plan.sources ? JSON.parse(JSON.stringify(documents.plan.sources)) : undefined;
			const reply = [
				'I checked both figures against the primary sources.',
				'',
				'The capital-gains rate is unchanged at 20.315%.',
				'',
				'\u0060\u0060\u0060javascript',
				'window.RETIREMENT_REFRESH = {',
				'  "plan.capitalGainsTaxPct": { "value": 22.5, "url": "https://www.nta.go.jp/x", "asOf": "2026-09-01" }',
				'};',
				'\u0060\u0060\u0060',
				'',
				'Let me know if you want the full table too.',
			].join(String.fromCharCode(10));
			ta.value = reply;
			view.applyButton.click();
			const out = {
				value: readForm().plan.capitalGainsTaxPct,
				said: view.applyStatus.textContent,
				cleared: ta.value === '',
				asOf: configValue('sources')['plan.capitalGainsTaxPct'].asOf,
			};
			ta.value = 'Sorry, I could not verify either figure.';
			view.applyButton.click();
			out.refusedText = view.applyStatus.textContent;
			out.refusedMarked = view.applyStatus.classList.contains('danger');
			out.stillThere = ta.value !== '';
			ta.value = '';
			setPath(MODEL, 'plan.capitalGainsTaxPct', before);
			if (keepSources) documents.plan.sources = keepSources; else delete documents.plan.sources;
			for (const id of FIELD_IDS) paintField(id);
			paintSources();
			return JSON.stringify(out);`);
		const pd = JSON.parse(pasted);
		t.log('pasted reply: ' + pasted);
		t.ok(pd.value === 22.5, 'a whole AI reply — prose, code fences and all — applies', String(pd.value));
		t.ok(pd.asOf === '2026-09-01', 'and brings its date with it', pd.asOf);
		t.ok(/1 value updated/.test(pd.said) && pd.cleared, 'says what it did and clears the box', pd.said);
		t.ok(
			pd.refusedMarked && pd.stillThere && /could not find/.test(pd.refusedText),
			'a reply with no document in it is refused, and the text is left to try again',
			pd.refusedText,
		);
		/* Applying a refresh re-runs the simulation, and that run blocks the thread for
		   about half a second — long enough to eat the next assertion's debounce if we
		   do not wait for it here. */
		await wait(1200);

		/* A refresh document may only touch the copied figures, and only with values the
		   page could start on. Everything else is reported, not applied — otherwise a
		   statutory refresh could quietly reset a balance. */
		const refresh = await js(`const before = {
				cgt: readForm().plan.capitalGainsTaxPct,
				spend: readForm().plan.annualSpending,
				rmdStart: configValue('secondary.compulsory').startAge,
			};
			const keepSources = documents.plan.sources ? JSON.parse(JSON.stringify(documents.plan.sources)) : undefined;
			const keepRmd = JSON.parse(JSON.stringify(configValue('secondary.compulsory')));
			/* With no sources record yet, a refused entry that created an empty one would
			   change the document too. */
			delete documents.plan.sources;
			const untouched = JSON.stringify([MODEL, documents.plan]);
			const unusable = applyRefresh({
				'correlations.secondaryFx': { value: 4, url: 'https://x', asOf: '2026-08-01' },
				'plan.inflationPct': { value: '', url: 'https://x', asOf: '2026-08-01' },
				'fx.volatilityPct': { value: '3', url: 'https://x', asOf: '2026-08-01' },
				'primary.returnVolatilityPct': { value: null, url: 'https://x', asOf: '2026-08-01' },
				'secondary.returnVolatilityPct': { value: 12, url: 'https://x', asOf: 'last week' },
				'primary.returnMeanPct': { value: 5, url: 5, asOf: '2026-08-01' },
			});
			const unusableChangedNothing = JSON.stringify([MODEL, documents.plan]) === untouched;
			const { applied, refused } = applyRefresh({
				'plan.capitalGainsTaxPct': { value: 21.5, url: 'https://nta', asOf: '2026-08-01' },
				'secondary.compulsory': { value: { kind: 'rmd', startAge: 74, divisors: { 72: 27.4, 120: 2 } }, url: 'https://irs', asOf: '2026-08-02' },
				'plan.annualSpending': { value: 1, url: 'x', asOf: '2026-08-01' },
				'secondary.returnMeanPct': { value: 'not a number', url: 'x', asOf: '2026-08-01' },
				'primary.pensionOptions': { value: [{ startAge: 65 }], url: 'x', asOf: '2026-08-01' },
			});
			for (const id of FIELD_IDS) paintField(id);
			const out = {
				applied: applied.sort(),
				refused: refused.sort(),
				cgt: readForm().plan.capitalGainsTaxPct,
				rmdStart: configValue('secondary.compulsory').startAge,
				spendUntouched: readForm().plan.annualSpending === before.spend,
				cgtSource: JSON.stringify(configValue('sources')['plan.capitalGainsTaxPct']),
				unusableApplied: unusable.applied,
				unusableRefused: unusable.refused.sort(),
				unusableChangedNothing,
			};
			setPath(MODEL, 'plan.capitalGainsTaxPct', before.cgt);
			documents.plan.secondary.compulsory = keepRmd;
			if (keepSources) documents.plan.sources = keepSources; else delete documents.plan.sources;
			for (const id of FIELD_IDS) paintField(id);
			paintSources();
			return JSON.stringify(out);`);
		const rf = JSON.parse(refresh);
		t.log('refresh: ' + refresh);
		t.ok(
			JSON.stringify(rf.applied) === '["plan.capitalGainsTaxPct","secondary.compulsory"]',
			'a refresh applies the copied figures it names',
			rf.applied.join(', '),
		);
		t.ok(rf.cgt === 21.5 && rf.rmdStart === 74, 'to the field and to the whole RMD block alike',
			rf.cgt + ' / ' + rf.rmdStart);
		t.ok(rf.cgtSource === '{"url":"https://nta","asOf":"2026-08-01"}',
			'each with the source and date it came with', rf.cgtSource);
		t.ok(
			JSON.stringify(rf.refused) ===
				'["plan.annualSpending","primary.pensionOptions","secondary.returnMeanPct"]',
			'and refuses a figure that is not copied, an unusable value, and a malformed list',
			rf.refused.join(', '),
		);
		t.ok(rf.spendUntouched, 'so a statutory refresh cannot reach your spending');
		t.ok(
			!rf.unusableApplied.length &&
				JSON.stringify(rf.unusableRefused) ===
					'["correlations.secondaryFx","fx.volatilityPct","plan.inflationPct","primary.returnMeanPct","primary.returnVolatilityPct","secondary.returnVolatilityPct"]',
			'it refuses a number its field cannot hold, a value that is not a number, and a date or URL that is not one',
			rf.unusableRefused.join(', ') + ' refused; ' + rf.unusableApplied.join(', ') + ' applied',
		);
		t.ok(rf.unusableChangedNothing, 'and a refused entry changes neither a field, the document nor its sources');

		const refreshDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retsim-refresh-'));
		const refreshFile = path.join(refreshDir, 'refresh.js');
		const keptInflation = await js('return readForm().plan.inflationPct;');
		const keptSources = await js('return JSON.stringify(documents.plan.sources ?? null);');
		fs.writeFileSync(
			refreshFile,
			'window.RETIREMENT_REFRESH = ' +
				JSON.stringify({
					'plan.inflationPct': { value: keptInflation + 1, url: 'https://example.org', asOf: '2026-08-01' },
				}) +
				';',
		);
		const cleanBeforeLoad = await js("markClean(STATUS_LABELS.defaults, 'both'); return !isDirty();");
		const picker = await cmd('Runtime.evaluate', { expression: "document.getElementById('plan-file')" });
		await cmd('DOM.setFileInputFiles', { files: [refreshFile], objectId: picker.result.result.objectId });
		for (let tries = 0; tries < 50; tries++) {
			if (await js(`return readForm().plan.inflationPct === ${keptInflation + 1} && lastMonteCarlo !== null;`)) {
				break;
			}
			await wait(100);
		}
		const loadedRefresh = JSON.parse(
			await js(`const banner = document.getElementById('banner');
				const out = {
					applied: readForm().plan.inflationPct === ${keptInflation + 1},
					bannerShown: !banner.hidden,
					bannerClass: banner.className,
					bannerRole: banner.getAttribute('role'),
					dirty: isDirty(),
					status: document.getElementById('save-status').textContent,
				};
				setPath(MODEL, 'plan.inflationPct', ${keptInflation});
				const sources = ${keptSources};
				if (sources) {
					documents.plan.sources = sources;
				} else {
					delete documents.plan.sources;
				}
				for (const id of FIELD_IDS) {
					paintField(id);
				}
				paintSources();
				hideBanner();
				markClean(STATUS_LABELS.defaults, 'both');
				return JSON.stringify(out);`),
		);
		fs.rmSync(refreshDir, { recursive: true, force: true });
		t.log('refresh file: ' + JSON.stringify(loadedRefresh));
		t.ok(loadedRefresh.applied && loadedRefresh.bannerShown, 'a refresh file loads through the plan picker');
		t.ok(
			loadedRefresh.bannerClass === 'banner success' && loadedRefresh.bannerRole === 'status',
			'and one with nothing refused is reported as a success, not as an alert',
			loadedRefresh.bannerClass + ' / ' + loadedRefresh.bannerRole,
		);
		t.ok(
			cleanBeforeLoad && loadedRefresh.dirty && /unsaved/.test(loadedRefresh.status),
			'and leaves the plan it changed unsaved',
			loadedRefresh.status,
		);

		/* ---- when a copied figure was last checked ---- */
		/* An out-of-date copied figure looks exactly like a current one, so the page
		   must say how old each is, and mark one past the threshold or with no date. */
		const prov = await js(`const doc = documents.plan;
			const keep = doc.sources ? JSON.parse(JSON.stringify(doc.sources)) : undefined;
			doc.sources = {
				'plan.capitalGainsTaxPct': { url: 'https://www.nta.go.jp/x', asOf: new Date().toISOString().slice(0, 10) },
				'secondary.compulsory': { url: 'https://www.irs.gov/x', asOf: '2019-01-01' },
			};
			paintSources();
			const line = (p) => {
				const el = document.querySelector('[data-src="' + sourcedPathFor(p) + '"]');
				return {
					text: el.textContent,
					stale: el.classList.contains('danger'),
					link: !!el.querySelector('a'),
					dismiss: !!el.querySelector('button.link'),
				};
			};
			const out = {
				fresh: line('plan.capitalGainsTaxPct'),
				old: line('secondary.compulsory.startAge'),
				unknown: line('primary.returnMeanPct'),
				/* one entry, four rows: every part of a compulsory-distribution rule shares
				   the one source, so a per-row count would report it four times over */
				staleCount: stalePaths().length,
				rmdRows: [...document.querySelectorAll('#settings-body [data-src]')].filter((e) => e.textContent.includes('irs.gov')).length,
				button: document.getElementById('open-settings').textContent,
				plainRow: !document
					.getElementById('set:plan.annualSpending')
					.closest('.setting-row')
					.querySelector('[data-src]'),
				named: line('primary.returnMeanPct').text.startsWith('Japan · '),
			};
			if (keep) doc.sources = keep; else delete doc.sources;
			paintSources();
			return JSON.stringify(out);`);
		const pv = JSON.parse(prov);
		t.log('source records: ' + prov);
		t.ok(!pv.fresh.stale && pv.fresh.link && pv.fresh.text.includes('nta.go.jp'),
			'a figure checked today reads as current, and links where it came from', pv.fresh.text);
		t.ok(pv.old.stale && /last checked 2019-01-01, 9\d months ago/.test(pv.old.text),
			'one from years ago is marked, with the date and how long ago', pv.old.text);
		t.ok(pv.unknown.stale && /never checked/.test(pv.unknown.text),
			'and one with no date is marked too, saying that is what is missing', pv.unknown.text);
		t.ok(pv.named, 'a paired row names which half each of its two lines is about', pv.unknown.text);
		t.ok(
			pv.old.dismiss && pv.unknown.dismiss && !pv.fresh.dismiss,
			'a warning offers a way to dismiss it, and a line that is not warning does not',
			[pv.old.dismiss, pv.unknown.dismiss, pv.fresh.dismiss].join('/'),
		);
		/* No "source" in the reader's text: nothing on the page defines the word, and
		   "from irs.gov" says it plainly. */
		t.ok(
			!/source/i.test(pv.fresh.text + pv.old.text + pv.unknown.text),
			'and none of the three uses the word "source"',
		);
		t.ok(pv.rmdRows === 4 && pv.staleCount === 13,
			'a compulsory-distribution rule shares one source across its rows, counted once',
			pv.rmdRows + ' rows, ' + pv.staleCount + ' stale paths');
		t.ok(/\(\d+\)/.test(pv.button), 'the count reaches the button that opens the panel', pv.button);
		t.ok(
			await js("return translate(UI.sourceCount)(3).includes('3 stale values') && translate(UI.sourceCount)(1).includes('1 stale value');"),
			'and a section head counts stale values, singular when there is one',
		);
		t.ok(pv.plainRow, 'a field that is nobody else’s figure has no source line');

		/* Typing over a copied figure has to move its date, or the record describes a
		   value that has been replaced. */
		const stamp = await js(`const doc = documents.plan;
			const keep = doc.sources ? JSON.parse(JSON.stringify(doc.sources)) : undefined;
			doc.sources = { 'plan.capitalGainsTaxPct': { url: 'https://x', asOf: '2019-01-01' } };
			const el = VIEWS['plan.capitalGainsTaxPct'][0];
			el.focus(); el.value = '21';
			el.dispatchEvent(new Event('input', { bubbles: true })); el.blur();
			const after = doc.sources['plan.capitalGainsTaxPct'];
			const out = { asOf: after.asOf, url: after.url, isToday: after.asOf === new Date().toISOString().slice(0, 10) };
			if (keep) doc.sources = keep; else delete doc.sources;
			return JSON.stringify(out);`);
		const st = JSON.parse(stamp);
		t.ok(st.isToday, 'hand-editing a copied figure stamps today', st.asOf);
		t.ok(st.url === 'https://x', 'and leaves the source URL alone — that is still where it should come from');
		await js("writeForm(BASE_PLAN); paintSettings(); paintSources(); markClean(STATUS_LABELS.defaults, 'both'); return 1;");

		/* ---- editing a setting, not a field ---- */
		/* Settings live in a document, not in MODEL, so they have an edit path of their
		   own to check. */
		const badValue = await js(`const el = document.getElementById('set:sensitivity.returnStepsPct');
			const keep = el.value;
			/* an axis with no 0 has no "as configured" cell to outline, which is exactly
			   what CONFIG_SPEC refuses at startup */
			el.value = '-2, -1, 1, 2';
			el.dispatchEvent(new Event('input', { bubbles: true }));
			const message = document.getElementById(el.getAttribute('aria-errormessage'));
			const out = {
				marked: el.getAttribute('aria-invalid') === 'true',
				unchanged: JSON.stringify(configValue('sensitivity.returnStepsPct')),
				said: !message.hidden && message.textContent.length > 20,
			};
			el.value = '-3, 0, 3';
			el.dispatchEvent(new Event('input', { bubbles: true }));
			out.accepted = JSON.stringify(configValue('sensitivity.returnStepsPct'));
			out.cleared = el.getAttribute('aria-invalid') !== 'true' && message.hidden;
			return JSON.stringify(out);`);
		await wait(500);
		const narrowGrid = await js("return document.querySelectorAll('table.grid tr').length;");
		await js(`const el = document.getElementById('set:sensitivity.returnStepsPct');
			el.value = '-2, -1, 0, 1, 2';
			el.dispatchEvent(new Event('input', { bubbles: true })); return 1;`);
		await wait(500);
		const bv = JSON.parse(badValue);
		t.log('bad setting: ' + badValue);
		t.ok(bv.marked && bv.said, 'a value the page could not start on is refused and says so');
		t.ok(bv.unchanged === '[-2,-1,0,1,2]', 'and the previous one stays in force', bv.unchanged);
		t.ok(bv.accepted === '[-3,0,3]' && bv.cleared, 'a good one applies and clears the mark', badValue);
		t.ok(narrowGrid === 4, 'and the grid redraws to the new axis', narrowGrid + ' rows');

		/* No label names a currency; each is built from the configured pair, so
		   renaming one must relabel the page. In the sheet the name is on the column
		   heading, not on the paired row's label. */
		const rename = await js(`const adj = document.getElementById('set:currencies.primary.adjective');
			const country = document.getElementById('set:currencies.primary.country');
			const keep = [adj.value, country.value];
			adj.value = 'Nipponese';
			adj.dispatchEvent(new Event('input', { bubbles: true }));
			country.value = 'Nippon';
			country.dispatchEvent(new Event('input', { bubbles: true }));
			const out = {
				label: document.querySelector('label[for="primary.brokerage"]').textContent,
				sheetLabel: document.querySelector('label[for="set:primary.brokerage"]').textContent,
				column: document
					.getElementById('set:primary.brokerage')
					.closest('.setting-grid')
					.querySelectorAll('.column-heads > span')[1].textContent,
			};
			adj.value = keep[0];
			adj.dispatchEvent(new Event('input', { bubbles: true }));
			country.value = keep[1];
			country.dispatchEvent(new Event('input', { bubbles: true }));
			out.restored = document.querySelector('label[for="primary.brokerage"]').textContent;
			return JSON.stringify(out);`);
		const rn = JSON.parse(rename);
		t.ok(rn.label === 'Nipponese brokerage' && rn.column === 'Nippon',
			'renaming a currency relabels the sidebar and the sheet together', JSON.stringify(rn));
		t.ok(rn.sheetLabel === 'Brokerage balance',
			'and the paired row keeps a label that names neither currency', rn.sheetLabel);
		t.ok(rn.restored === 'Japanese brokerage', 'and putting the name back restores them', rn.restored);

		const optEdit = await js(`const el = document.getElementById('set:secondary.pensionOptions');
			const keep = el.value;
			/* one line per claim age; built without escapes because this string passes
			   through a template literal on the way in */
			el.value = ['62 18000', '70 30000'].join(String.fromCharCode(10));
			el.dispatchEvent(new Event('input', { bubbles: true }));
			const out = {
				count: document.querySelector('table.fields select[data-claim]').options.length,
				first: document.querySelector('table.fields select[data-claim]').options[0].textContent,
				stored: JSON.stringify(configValue('secondary.pensionOptions')),
			};
			el.value = keep;
			el.dispatchEvent(new Event('input', { bubbles: true }));
			out.back = document.querySelector('table.fields select[data-claim]').options.length;
			return JSON.stringify(out);`);
		const oe = JSON.parse(optEdit);
		t.log('option list edit: ' + optEdit);
		t.ok(oe.count === 2 && oe.back === 3, 'editing the option list rebuilds the dropdown',
			oe.count + ' then ' + oe.back);
		t.ok(oe.stored === '[{"startAge":62,"annual":18000},{"startAge":70,"annual":30000}]',
			'and stores it as age/amount pairs', oe.stored);

		const twoDirty = await js(`markClean(STATUS_LABELS.defaults, 'both');
			const out = { clean: dirtyDocs() };
			document.getElementById('set:simulation.seed').value = '12345';
			document.getElementById('set:simulation.seed').dispatchEvent(new Event('input', { bubbles: true }));
			out.afterSetupEdit = dirtyDocs();
			out.banner = document.getElementById('save-status').textContent;
			const el = document.getElementById('plan.annualSpending');
			el.value = '19000000';
			el.dispatchEvent(new Event('input', { bubbles: true }));
			out.afterBoth = dirtyDocs().slice().sort();
			markClean(STATUS_LABELS.saved, 'plan');
			out.afterSavingPlan = dirtyDocs();
			return JSON.stringify(out);`);
		const td = JSON.parse(twoDirty);
		t.log('dirty tracking: ' + twoDirty);
		t.ok(JSON.stringify(td.clean) === '[]', 'both documents start clean');
		t.ok(JSON.stringify(td.afterSetupEdit) === '["setup"]' && td.banner.includes('setup'),
			'a setup edit dirties the setup document and the banner names it', td.banner);
		t.ok(JSON.stringify(td.afterBoth) === '["plan","setup"]', 'a field edit dirties the plan as well');
		t.ok(JSON.stringify(td.afterSavingPlan) === '["setup"]',
			'and saving the plan leaves the setup still unsaved', JSON.stringify(td.afterSavingPlan));
		await js("documents.setup.simulation.seed = 49734321; return 1;");
		await js("writeForm(BASE_PLAN); paintSettings(); markClean(STATUS_LABELS.defaults, 'both'); return 1;");

		/* ---- one store, many views ---- */
		/* A view built by hand, so the store is checked apart from how the sidebar and
		   the sheet wire their own boxes. */
		const twin = await js(`const id = 'plan.annualSpending';
			const a = document.getElementById(id);
			const b = document.createElement('input');
			b.type = 'text';
			registerView(id, b);
			b.addEventListener('input', () => fieldEdited(id, b));
			document.body.appendChild(b);
			const out = {};
			b.value = '9500000';
			b.dispatchEvent(new Event('input', { bubbles: true }));
			out.modelTookIt = getPath(MODEL, id) === 9500000;
			out.firstViewFollowed = a.value === '9,500,000';
			out.readFormAgrees = readForm().plan.annualSpending === 9500000;
			a.value = '8250000';
			a.dispatchEvent(new Event('input', { bubbles: true }));
			out.secondViewFollowed = b.value === '8,250,000';
			writeForm(BASE_PLAN);
			out.bothReset = a.value === b.value && a.value === groupDigits(documents.plan.plan.annualSpending);
			b.value = '';
			b.dispatchEvent(new Event('input', { bubbles: true }));
			out.emptyIsAbsent = getPath(MODEL, id) === undefined;
			out.emptyFallsBack = readForm().plan.annualSpending === documents.plan.plan.annualSpending;
			out.emptyShowsEmpty = a.value === '' && b.value === '';
			b.remove();
			VIEWS[id].pop();
			writeForm(BASE_PLAN);
			return JSON.stringify(out);`);
		const tw = JSON.parse(twin);
		t.log('two views: ' + twin);
		t.ok(tw.modelTookIt && tw.readFormAgrees, 'editing a view writes the store', twin);
		t.ok(tw.firstViewFollowed && tw.secondViewFollowed, 'and every other view of that field follows');
		t.ok(tw.bothReset, 'writeForm repaints all views');
		t.ok(
			tw.emptyIsAbsent && tw.emptyFallsBack && tw.emptyShowsEmpty,
			'an emptied box stays empty and resolves to the configured default',
			twin,
		);

		/* ---- the page keeps no copy of any configured value ---- */
		/* Identity, not equality: each group must be the very object the configuration
		   supplied. A merged copy would compare equal today and supply a stale half the
		   day a key is renamed or removed. */
		const shared = await js(`const roots = { setup: documents.setup, plan: documents.plan };
			const where = (k) => (SETUP_KEYS.includes(k.split('.')[0]) ? roots.setup : roots.plan);
			return ['currencies','primary.pensionOptions','secondary.pensionOptions','primary.compulsory','secondary.compulsory',
				'comparison','sensitivity','successThresholdsPct','simulation']
				.filter((k) => configValue(k) !== k.split('.').reduce((o,p)=>o[p], where(k))).join(',') || 'all shared';`);
		t.ok(shared === 'all shared', 'configValue reads through to the documents, holds no copies', shared);

		/* ---- two documents ---- */
		/* Routing, not values, is asserted: the values are the same either way, which
		   is what makes a mis-routed path invisible. */
		const routing = await js(`return JSON.stringify({
			setupKeys: Object.keys(documents.setup),
			planKeys: Object.keys(documents.plan),
			seedFromSetup: configValue('simulation.seed') === documents.setup.simulation.seed,
			ratefromPlan: configValue('fx.rate') === documents.plan.fx.rate,
			noCrossTalk: configValue('fx.rate') !== undefined && documents.setup.fx === undefined,
		});`);
		const rt = JSON.parse(routing);
		t.log('routing: ' + routing);
		t.ok(
			sameKeys(rt.setupKeys, SETUP_EXPECTED) && sameKeys(rt.planKeys, PLAN_EXPECTED, PLAN_OPTIONAL),
			'each document holds exactly its own keys',
			rt.setupKeys.join(',') + ' | ' + rt.planKeys.join(','),
		);
		t.ok(rt.seedFromSetup && rt.ratefromPlan && rt.noCrossTalk, 'configValue routes by first segment', routing);
		/* ---- Save writes a document the page can read back ---- */
		/* What Save writes must be a plan document the page can start from. Checked by
		   downloading it and reading it off disk: the blob having the right bytes is a
		   different claim. */
		/* The run's download directory is shared, and an earlier test saves into it, so
		   empty it first — "one .js file" below is a claim about this save. */
		const dl = downloads;
		for (const f of fs.readdirSync(dl)) fs.rmSync(path.join(dl, f), { force: true });
		await js(`const el = document.getElementById('plan.annualSpending');
			el.focus(); el.value = '17250000';
			el.dispatchEvent(new Event('input', { bubbles: true })); el.blur();
			document.getElementById('save-plan').click(); return 1;`);
		for (let i = 0; i < 30 && !fs.readdirSync(dl).some((f) => f.endsWith('.js')); i++) await wait(100);
		const written = fs.readdirSync(dl).filter((f) => f.endsWith('.js'));
		t.ok(written.length === 1, 'Save writes one .js file', written.join(', '));
		t.ok(/^retirement_plan_\d{4}-\d\d-\d\d\.js$/.test(written[0]), 'named and dated as a plan document', written[0]);
		const saved = fs.readFileSync(path.join(dl, written[0]), 'utf8');
		t.ok(saved.startsWith('/*') && saved.includes('window.RETIREMENT_PLAN ='),
			'with a comment header a .json file could not carry', saved.split('\n')[0]);
		/* The acid test: hand it back through the picker's own reader. */
		const round = await js(`const read = readDocument('retirement_plan_x.js', ${JSON.stringify(saved)});
			const doc = read.doc;
			if (read.kind !== 'plan') throw new Error('read back as ' + read.kind);
			const leaves = Object.keys(flatten(doc));
			const fields = leaves.filter((k) => !isConfigPath(k)).sort();
			writeForm(doc);
			const back = readForm();
			return JSON.stringify({
				fields,
				edited: back.plan.annualSpending,
				hasOptions: Array.isArray(doc.secondary.pensionOptions) && Array.isArray(doc.primary.pensionOptions),
				hasRmd: !!(doc.secondary.compulsory && doc.secondary.compulsory.divisors),
				identical: JSON.stringify(back) === JSON.stringify(readForm()),
			});`);
		const rd = JSON.parse(round);
		t.ok(
			JSON.stringify(rd.fields) === JSON.stringify(declared),
			'it carries every field and nothing stray',
			rd.fields.length + ' of ' + declared.length,
		);
		t.ok(rd.hasOptions && rd.hasRmd,
			'and the parts of the plan that have no field — pension lists, RMD rules', round);
		t.ok(rd.edited === 17250000, 'and reading it back restores the edit', String(rd.edited));
		await js('writeForm(BASE_PLAN); return 1;');
		for (const f of fs.readdirSync(dl)) fs.rmSync(path.join(dl, f), { force: true });

		/* A setup document, a bare .json object and the pre-split single document are
		   all refused, never half-applied. */
		const rejects = await js(`const out = {};
			try { readDocument('retirement_setup.js', 'window.RETIREMENT_SETUP = {currencies:{}};'); out.setup = 'accepted'; }
			catch (e) { out.setup = 'refused'; }
			try { readDocument('retirement_inputs_2026-01-01.json', '{"plan": {"currentAge": 57}}'); out.json = 'accepted'; }
			catch (e) { out.json = 'refused'; }
			try { readDocument('old.js', 'window.RETIREMENT_DEFAULTS = {plan:{currentAge: 58}};'); out.legacyJs = 'accepted'; }
			catch (e) { out.legacyJs = 'refused'; }
			out.refreshKind = readDocument('r.js', 'window.RETIREMENT_REFRESH = {"plan.inflationPct":{value:2}};').kind;
			return JSON.stringify(out);`);
		const rj = JSON.parse(rejects);
		t.ok(rj.setup === 'refused', 'a setup document is refused by the plan picker', rj.setup);
		t.ok(rj.json === 'refused', 'a .json file is refused, not read as a plan', rj.json);
		t.ok(rj.legacyJs === 'refused',
			'and the pre-split single document is refused, not half-read', rj.legacyJs);
		t.ok(rj.refreshKind === 'refresh', 'and a refresh document is recognised as its own kind', rj.refreshKind);

		/* ---- a setting edited while the page is open takes effect ---- */
		/* A setting captured at parse time would ignore an edit until a reload, which
		   looks like the edit was lost. Each is restored before the next. */
		const liveSeed = await js(`const keep = documents.setup.simulation.seed;
			const before = lastMonteCarlo.successPct;
			documents.setup.simulation.seed = keep + 1;
			const after = simulate(Object.assign(engineInputs(), { pathCount: 2000 })).successPct;
			documents.setup.simulation.seed = keep;
			const restored = simulate(Object.assign(engineInputs(), { pathCount: 2000 })).successPct;
			const withNew = (() => { documents.setup.simulation.seed = keep + 1;
				const v = simulate(Object.assign(engineInputs(), { pathCount: 2000 })).successPct;
				documents.setup.simulation.seed = keep; return v; })();
			return JSON.stringify({ after, restored, withNew, sameAgain: after === withNew });`);
		const seedRes = JSON.parse(liveSeed);
		t.ok(seedRes.after !== seedRes.restored, 'the seed is read per run, not captured at parse time',
			seedRes.after.toFixed(2) + '% vs ' + seedRes.restored.toFixed(2) + '%');
		t.ok(seedRes.sameAgain, 'and the same seed still gives the same answer');

		await js(`documents.setup.comparison.spendStepPct = 10; runMonteCarlo(); return 1;`);
		await wait(1600);
		const legend10 = await js("return document.getElementById('survival-legend').textContent;");
		t.ok(legend10.includes('10%') && !legend10.includes('20%'),
			'the spending-comparison step is read per run', legend10);
		const note10 = await js("return document.getElementById('survival-note').textContent;");
		t.ok(note10.includes('10%'), 'and the caption that quotes it follows');
		await js(`documents.setup.comparison.spendStepPct = 20; runMonteCarlo(); return 1;`);
		await wait(1600);
		t.ok(
			(await js("return document.getElementById('survival-legend').textContent;")).includes('20%'),
			'and it goes back',
		);

		const axes = await js(`const keep = documents.setup.sensitivity.returnStepsPct;
			documents.setup.sensitivity.returnStepsPct = [-1, 0, 1];
			renderSensitivity();
			const rows = document.querySelectorAll('table.grid tr').length;
			documents.setup.sensitivity.returnStepsPct = keep;
			renderSensitivity();
			return rows + '/' + document.querySelectorAll('table.grid tr').length;`);
		t.ok(axes === '4/6', 'the sensitivity axes are read per render', axes + ' rows (header included)');

		/* Emptying a list means that side has no public pension: at startup the field
		   is dropped, and emptying it here must hide the row already on screen. */
		const claims = await js(`const path = 'secondary.pensionOptions';
			const keep = JSON.parse(JSON.stringify(configValue(path)));
			const spec = CLAIM_FIELDS['secondary.pensionStartAge'];
			const shown = () => VIEWS['secondary.pensionStartAge'][0].options[0].textContent;
			const rowHidden = () => document.querySelector('[data-fieldrow="secondary.pensionStartAge"]').hidden;
			const out = { before: shown(), hiddenBefore: rowHidden() };
			configValue(path)[0].annual = 24000;
			refreshClaimFields();
			out.afterEdit = shown();
			out.keptSelection = readNumber(VIEWS['secondary.pensionStartAge'][0]) === getPath(MODEL, 'secondary.pensionStartAge');
			documents.plan.secondary.pensionOptions = [];
			refreshClaimFields();
			out.hiddenWhenEmpty = rowHidden();
			out.neverPays = engineInputs().secondaryPensionStartAge === Infinity;
			documents.plan.secondary.pensionOptions = keep;
			refreshClaimFields();
			out.restored = shown();
			out.hiddenAfter = rowHidden();
			return JSON.stringify(out);`);
		const cl = JSON.parse(claims);
		t.log('claim rebuild: ' + claims);
		t.ok(cl.afterEdit !== cl.before && cl.afterEdit.includes('2,000'),
			'editing a pension option rebuilds its dropdown', cl.before + ' -> ' + cl.afterEdit);
		t.ok(cl.keptSelection, 'and keeps the age that was chosen');
		t.ok(cl.hiddenWhenEmpty && cl.neverPays && !cl.hiddenBefore && !cl.hiddenAfter,
			'emptying the list hides the row and stops the pension paying', claims);
		t.ok(cl.restored === cl.before, 'and putting the list back restores it');

		/* An empty list drops the claim field from FIELDS before FIELD_BY_ID is built,
		   so the sheet must cope with a row naming an absent field. A throw there
		   happens at parse time, before init() can show a banner, and leaves every
		   input empty. */
		const gone = await js(`const keep = FIELD_BY_ID['primary.pensionStartAge'];
			const spec = ['primary.pensionStartAge', 'secondary.pensionStartAge', { en: 'Claim age', ja: '受給を始める年齢' }];
			const out = {};
			delete FIELD_BY_ID['primary.pensionStartAge'];
			try {
				const row = settingsRow(spec, PAIR_COLS);
				out.built = !!row;
				/* the surviving half must stay under its own column heading, so the
				   dropped one leaves its cell standing rather than shifting it left */
				out.cells = row.querySelectorAll('.setting-control').length;
				out.secondInSecondColumn = !!row.querySelectorAll('.setting-control')[1].querySelector('select');
				out.labelPointsAtSomethingReal = !!row.querySelector('label').htmlFor &&
					!row.querySelector('label').htmlFor.includes('primary.pensionStartAge');
				delete FIELD_BY_ID['secondary.pensionStartAge'];
				out.bothGone = settingsRow(spec, PAIR_COLS) === null;
			} catch (e) {
				out.threw = String(e);
			}
			FIELD_BY_ID['primary.pensionStartAge'] = keep;
			FIELD_BY_ID['secondary.pensionStartAge'] = FIELD_BY_ID['secondary.pensionStartAge'] || keep;
			return JSON.stringify(out);`);
		const gn = JSON.parse(gone);
		t.log('absent claim field: ' + gone);
		t.ok(!gn.threw, 'a paired row survives one of its fields being absent', gn.threw || 'no throw');
		t.ok(gn.built && gn.cells === 2 && gn.secondInSecondColumn,
			'and leaves the empty column standing so the other keeps its heading', gone);
		t.ok(gn.labelPointsAtSomethingReal, 'with its label pointing at a box that exists');
		t.ok(gn.bothGone, 'and the row goes entirely when neither field is there');

		/* ---- the committed example configuration ---- */
		/* Nothing loads the .example.js files, so they are checked through the page's
		   own validator: swapped into the live documents, then put back. */
		const exampleSrc = ['setup', 'plan'].map((d) =>
			fs.readFileSync(path.join(REPO, 'retirement_' + d + '.example.js'), 'utf8'),
		);
		const example = await js(`const sandbox = {};
			for (const src of ${JSON.stringify(exampleSrc)}) new Function('window', src)(sandbox);
			const keep = { setup: documents.setup, plan: documents.plan };
			documents.setup = sandbox.RETIREMENT_SETUP;
			documents.plan = sandbox.RETIREMENT_PLAN;
			let out;
			try {
				out = {
					problems: configProblems(),
					setupKeys: Object.keys(sandbox.RETIREMENT_SETUP),
					planKeys: Object.keys(sandbox.RETIREMENT_PLAN),
					leaves: Object.keys(flatten(sandbox.RETIREMENT_PLAN)).filter((k) => !isConfigPath(k)).sort(),
					age: sandbox.RETIREMENT_PLAN.plan.currentAge,
				};
			} finally {
				documents.setup = keep.setup;
				documents.plan = keep.plan;
			}
			return JSON.stringify(out);`);
		const ex = JSON.parse(example);
		t.ok(!ex.problems.length, 'the example configuration passes the startup check', ex.problems.join(' '));
		t.ok(
			sameKeys(ex.setupKeys, SETUP_EXPECTED) && sameKeys(ex.planKeys, PLAN_EXPECTED, PLAN_OPTIONAL),
			'and splits across the two files the same way the real one does',
			ex.setupKeys.join(',') + ' | ' + ex.planKeys.join(','),
		);
		t.ok(
			JSON.stringify(ex.leaves) === JSON.stringify(declared),
			'and supplies exactly the fields the form has',
			ex.leaves.length + ' vs ' + declared.length,
		);
		t.ok(ex.age === 40, 'and is written for someone turning 40', String(ex.age));

		t.ok(await js("return configReady === true;"), 'config validated at startup');
		t.ok(
			await js("return document.getElementById('banner').hidden;"),
			'no config error banner on a complete configuration',
		);
		const fellBack = await js(`const el = document.getElementById('plan.annualSpending');
			const keep = el.value;
			el.value = '';
			const got = readForm().plan.annualSpending;
			el.value = keep;
			return got + '/' + documents.plan.plan.annualSpending;`);
		const [emptied, fromFile] = fellBack.split('/');
		t.ok(emptied === fromFile, 'an emptied field falls back to the plan file', fellBack);
		const grouped = await js("return document.getElementById('plan.annualSpending').value;");
		t.ok(grouped.includes(','), 'digit grouping intact', grouped);
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
