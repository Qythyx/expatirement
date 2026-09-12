/* Static checks over the page's source, plus the two places untrusted text reaches the DOM. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, isMain } from './harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = fs.readdirSync(path.join(ROOT, 'js')).map((f) => [f, fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')]);

const suite = {
	name: 'hygiene',
	description: 'DOM is built, not parsed; untrusted text stays text',
	async run(t, { js }) {
		const parsed = scripts.flatMap(([f, src]) =>
			src.split('\n').flatMap((line, i) => (/innerHTML|outerHTML|insertAdjacentHTML/.test(line) ? [`${f}:${i + 1}`] : [])),
		);
		t.ok(!parsed.length, 'no script parses HTML from a string', parsed.join(', '));

		const created = scripts.flatMap(([f, src]) =>
			src.split('\n').flatMap((line, i) => (/document\.createElement\b/.test(line) ? [`${f}:${i + 1}`] : [])),
		);
		t.ok(
			created.length === 1 && (await js("return el.toString().includes('document.createElement(');")),
			'every element is built through el()',
			created.join(', '),
		);

		const link = JSON.parse(await js(`
			applyRefresh({ 'plan.inflationPct': { value: 2, url: 'javascript:window.__clicked=1', asOf: '2026-01-01' } });
			paintSources();
			const line = document.querySelector('[data-src="plan.inflationPct"]');
			return JSON.stringify({ anchors: line.querySelectorAll('a').length, text: line.textContent });`));
		t.ok(link.anchors === 0 && link.text.includes('javascript:'), 'a non-web source URL is shown, not linked', JSON.stringify(link));

		const banner = JSON.parse(await js(`
			showBanner('warn', 'x', ['<img src=x onerror="window.__pwned=1">']);
			const box = document.getElementById('banner');
			const out = { img: !!box.querySelector('img'), text: box.textContent.includes('<img') };
			hideBanner();
			return JSON.stringify(out);`));
		t.ok(!banner.img && banner.text, 'banner lines are text, not markup', JSON.stringify(banner));

		const markup = fs
			.readFileSync(path.join(ROOT, 'simulator.html'), 'utf8')
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<title>[\s\S]*?<\/title>/, '')
			.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '');
		const stray = [...markup.matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter(Boolean);
		t.ok(!stray.length, 'the markup carries no text of its own', stray.join(' | '));
	},
};

export default suite;
if (isMain(import.meta.url)) await main(suite);
