/* The English/Japanese toggle. The structural assertions walk every pair table for
   a missing half, or English left in a `ja` slot, which reads fine on screen. The
   behavioural ones press the button and look for text built once and cached,
   which stays in English while everything around it switches. */

import { main, isMain } from './harness.mjs';

/* kana and CJK ideographs. The configured big-unit suffix is deliberately not
   enough on its own — 億 is 億 in both languages, so only labels are tested with
   this, never a value. */
const JA = /[぀-ヿ一-龯]/;

const suite = {
	name: 'language',
	description: 'the English/Japanese toggle reaches every string',
	window: { width: 1500, height: 1400 },

	async run(t, { js, wait, reload }) {
		const toggle = async () => {
			await js("document.getElementById('language-toggle').click(); return 1;");
			await wait(1500);
		};

		/* ---- every pair carries both halves ---- */
		const gaps = JSON.parse(
			await js(`const bad = [];
				const check = (name, v) => {
					if (!v || typeof v !== 'object' || Array.isArray(v)) return bad.push(name + ': not a pair');
					if (v.en === undefined) bad.push(name + ': no en');
					if (v.ja === undefined) bad.push(name + ': no ja');
					if (typeof v.en === 'string' && v.en === v.ja) bad.push(name + ': ja is the English');
				};
				for (const k of Object.keys(UI)) check('UI.' + k, UI[k]);
				for (const section of FIELDS) {
					check('section ' + section.title.en, section.title);
					for (const field of section.fields) {
						check(field.id + ' label', field.label);
						check(field.id + ' tip', field.tip);
					}
				}
				for (const k of Object.keys(CLAIM_FMT)) check('CLAIM_FMT.' + k, CLAIM_FMT[k]);
				for (const k of Object.keys(PAIRED_TIPS)) check('PAIRED_TIPS.' + k, PAIRED_TIPS[k]);
				for (const k of Object.keys(CHOICE_LABELS)) check('CHOICE_LABELS.' + k, CHOICE_LABELS[k]);
				for (const c of ROLE_COLS) check('ROLE_COLS', c);
				for (const [k, p] of Object.entries(PROMPTS)) for (const part of ['title', 'blurb', 'body']) check(\`PROMPTS.\${k}.\${part}\`, p[part]);
				for (const sec of SETTINGS) {
					check('SETTINGS title', sec.title);
					check(sec.title.en + ' note', sec.note);
					for (const row of sec.rows) {
						const cells = Array.isArray(row) ? row.slice(0, 2) : [row];
						if (Array.isArray(row)) {
							check(sec.title.en + ' paired label', row[2]);
							if (row[3]) check(sec.title.en + ' paired tip', row[3]);
						}
						for (const cell of cells) {
							if (typeof cell === 'object') {
								check((cell.path || cell.prop) + ' label', cell.label);
								check((cell.path || cell.prop) + ' tip', cell.tip);
							}
						}
					}
				}
				/* The configured currency names, countries and adjectives are pairs too: a
				   missing half puts English into the middle of a Japanese sentence. */
				const currencies = documents.setup.currencies;
				for (const role of ['primary', 'secondary'])
					for (const k of ['name', 'country', 'adjective'])
						check('currencies.' + role + '.' + k, currencies[role][k]);
				return JSON.stringify(bad);`),
		);
		t.ok(!gaps.length, 'every translatable string has both halves', gaps.slice(0, 4).join('; '));

		/* A token naming something not configured is left standing on purpose, so it
		   can be seen; this is what sees it. Swept in both languages, because a token
		   in a Japanese string is only resolved while that half is on screen. */
		const tokens = (where) =>
			js(`return JSON.stringify((document.body.innerText.match(/\\{(primary|secondary)\\.[\\w.]+\\}/g) || [])
				.concat([...document.querySelectorAll('[data-tip]')].flatMap((e) =>
					e.dataset.tip.match(/\\{(primary|secondary)\\.[\\w.]+\\}/g) || [])));`).then(JSON.parse);
		const leftEn = await tokens();
		t.ok(!leftEn.length, 'every currency token resolves in English', leftEn.join(', '));
		/* A check that no Japanese tooltip is a stub, not a length rule. */
		const shortest = JSON.parse(
			await js(`const tips = [];
				for (const section of FIELDS) for (const field of section.fields) tips.push([field.tip.ja.length, field.id]);
				tips.sort((a, b) => a[0] - b[0]);
				return JSON.stringify(tips[0]);`),
		);
		t.ok(shortest[0] >= 15, 'no Japanese tooltip is a stub', shortest[1] + ' is ' + shortest[0] + ' chars');

		/* ---- English is what it loads in ---- */
		t.ok(
			(await js('return document.documentElement.lang;')) === 'en',
			'page loads in English with no stored preference',
		);
		t.ok(
			(await js("return document.getElementById('language-toggle').textContent;")) === '日本語',
			'the button offers the other language, not the current one',
		);
		const english = JSON.parse(
			await js(`return JSON.stringify({
				h1: document.querySelector('h1').textContent,
				successCaption: document.getElementById('success-caption').textContent.replace(/\\s+/g, ' ').trim(),
				legend: document.getElementById('path-legend').textContent,
				survivalLegend: document.getElementById('survival-legend').textContent,
				tiles: [...document.querySelectorAll('#path-metrics .metric .caps')].map((e) => e.textContent).join('|'),
			});`),
		);

		/* ---- and it all changes together ---- */
		await toggle();
		t.ok((await js('return document.documentElement.lang;')) === 'ja', 'html lang follows the toggle');
		t.ok(JA.test(await js('return document.title;')), 'the document title is translated too');
		t.ok(
			(await js("return document.getElementById('language-toggle').textContent;")) === 'English',
			'the button now offers English',
		);
		t.ok(
			(await js("return document.getElementById('language-toggle').lang;")) === 'en',
			'and carries the lang of its own label, which is the other one',
		);

		/* Everything with a visible label, in one sweep: a string built too early to
		   be re-read would stay in English at any of these. */
		const spots = {
			tagline: "document.querySelector('.tagline').textContent",
			sub: "document.querySelector('.title-block .note').textContent",
			'panel headings': "[...document.querySelectorAll('h2')].map((e) => e.textContent).join('|')",
			'toolbar buttons': "[...document.querySelectorAll('.toolbar button, #open-settings')].map((e) => e.textContent).join('|')",
			'save banner': "document.getElementById('save-status').textContent",
			'section headings': "[...document.querySelectorAll('th[scope=rowgroup]')].map((e) => e.textContent).join('|')",
			'field labels': "[...document.querySelectorAll('table.fields label')].map((e) => e.textContent).join('|')",
			'field tooltips': "[...document.querySelectorAll('label[data-tip]')].map((e) => e.dataset.tip).join('|')",
			'age unit column': "[...document.querySelectorAll('td.unit')].map((e) => e.textContent).join('')",
			'claim-age options': "[...document.querySelectorAll('select[data-claim] option')].map((e) => e.textContent).join('|')",
			'metric tile labels': "[...document.querySelectorAll('#path-metrics .metric .caps')].map((e) => e.textContent).join('|')",
			'chart legend': "document.getElementById('path-legend').textContent",
			'survival legend': "document.getElementById('survival-legend').textContent",
			'survival caption': "document.getElementById('survival-note').textContent",
			'headline caption': "document.getElementById('success-caption').textContent",
			'outcome column heads': "[...document.querySelectorAll('table.outcomes thead th')].map((e) => e.textContent).join('|')",
			'outcome row heads': "[...document.querySelectorAll('table.outcomes tbody th')].map((e) => e.textContent).join('|')",
			'outcome view buttons': "[...document.querySelectorAll('#outcomes button')].map((e) => e.textContent).join('|')",
			'outcome cell tooltips': "[...document.querySelectorAll('table.outcomes td[data-tip]')].map((e) => e.dataset.tip).join('|')",
			'sensitivity caption': "document.getElementById('sensitivity-note').textContent",
			'grid caption': "document.querySelector('#sensitivity-grid .note').textContent",
			'grid corner': "document.querySelector('table.grid th').textContent",
			'assumptions': "document.querySelector('[data-i18n=noteAssumptions]').textContent",
		};
		for (const [what, expr] of Object.entries(spots)) {
			const got = await js('return ' + expr + ';');
			t.ok(JA.test(got), what + ' translated', String(got).replace(/\s+/g, ' ').slice(0, 46));
		}
		/* the canvas has no DOM to inspect, so assert the axis label at its source */
		t.ok(JA.test(await js('return translate(UI.axisAge);')), 'chart axis label translated');
		/* the sensitivity caption is the one piece of prose with live figures spliced
		   into it, so both halves have to quote them */
		t.ok(
			await js(`const note = document.getElementById('sensitivity-note').textContent;
				return note.includes(formatPercent(100 * engineInputs().secondaryReturnVolatilityPct)) && note.includes('1.4');`),
			'the figures the sensitivity caption quotes survive the swap',
		);
		t.ok(
			await js("return document.getElementById('survival-note').textContent.includes(String(engineInputs().horizonEndAge));"),
			'so does the age reference',
		);

		/* ---- the other reading of the survival panel ---- */
		await js("document.querySelector('#outcomes button[data-view=sequence]').click(); return 1;");
		await wait(400);
		t.ok(JA.test(await js("return document.getElementById('survival-note').textContent;")), 'bad-start caption translated');
		t.ok(
			JA.test(await js("return document.getElementById('survival-legend').textContent;")),
			'and the quartile legend with it',
			await js("return document.getElementById('survival-legend').textContent;"),
		);
		await js("document.querySelector('#outcomes button[data-view=compare]').click(); return 1;");
		await wait(400);

		/* ---- a typed value is not a string, and must not be touched ---- */
		await js(`const el = document.getElementById('plan.annualSpending');
			el.value = '12,345,678'; el.dispatchEvent(new Event('input', { bubbles: true })); return 1;`);
		await wait(900);
		await toggle();
		t.ok(
			(await js("return document.getElementById('plan.annualSpending').value;")) === '12,345,678',
			'switching language leaves an edited field alone, separators and all',
			await js("return document.getElementById('plan.annualSpending').value;"),
		);
		t.ok(
			(await js('return readForm().plan.annualSpending;')) === 12345678,
			'and the engine still reads it',
		);
		t.ok(
			!JA.test(await js("return document.getElementById('save-status').textContent;")) &&
				(await js("return document.getElementById('save-status').textContent.includes('unsaved');")),
			'the unsaved-changes banner came back in English',
		);

		/* ---- back in English, nothing has drifted ---- */
		await js('writeForm(BASE_PLAN); markClean(STATUS_LABELS.defaults); return 1;');
		await js('runMonteCarlo(); return 1;');
		await wait(2500);
		const back = JSON.parse(
			await js(`return JSON.stringify({
				h1: document.querySelector('h1').textContent,
				successCaption: document.getElementById('success-caption').textContent.replace(/\\s+/g, ' ').trim(),
				legend: document.getElementById('path-legend').textContent,
				survivalLegend: document.getElementById('survival-legend').textContent,
				tiles: [...document.querySelectorAll('#path-metrics .metric .caps')].map((e) => e.textContent).join('|'),
			});`),
		);
		for (const k of Object.keys(english)) {
			t.ok(back[k] === english[k], 'English ' + k + ' round-trips unchanged', back[k].slice(0, 46));
		}

		/* ---- and the choice outlives a reload ---- */
		await toggle();
		await reload();
		t.ok(
			(await js('return document.documentElement.lang;')) === 'ja',
			'the language chosen is remembered across a reload',
		);
		t.ok(
			JA.test(await js("return document.getElementById('success-caption').textContent;")),
			'and the first run after the reload comes out in it',
		);
		const leftJa = await tokens();
		t.ok(!leftJa.length, 'and every currency token resolves in Japanese too', leftJa.join(', '));
		/* leave the page in English so the next assertion someone adds is not surprised */
		await toggle();
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
