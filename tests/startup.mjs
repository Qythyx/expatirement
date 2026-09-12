/* A page whose configuration is missing stops before it simulates anything: a
   banner says why, the headline figure stays a placeholder, and the status line
   names the files it could not load, in either language. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { main, isMain } from './harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
/* The copy sits one level down in a fresh directory, so the ../data it reads its
   configuration from cannot exist. */
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'retsim-nocfg-'));
const copy = path.join(scratch, 'simulator');
fs.mkdirSync(copy);
for (const file of ['simulator.html', 'simulator.css']) {
	fs.copyFileSync(path.join(ROOT, file), path.join(copy, file));
}
fs.cpSync(path.join(ROOT, 'js'), path.join(copy, 'js'), { recursive: true });
process.on('exit', () => fs.rmSync(scratch, { recursive: true, force: true }));
const url = pathToFileURL(path.join(copy, 'simulator.html')).href;

const suite = {
	name: 'startup',
	description: 'a page with no configuration stops and says why',
	url,
	startsStopped: true,

	async run(t, { js, wait }) {
		for (let tries = 0; ; tries++) {
			const loaded = await js(
				`return location.href === ${JSON.stringify(url)} && document.readyState !== 'loading';`,
			).catch(() => false);
			if (loaded) {
				break;
			}
			if (tries > 100) {
				throw new Error('the copied page never finished loading');
			}
			await wait(100);
		}

		const english = JSON.parse(
			await js(`return JSON.stringify({
				bannerShown: !document.getElementById('banner').hidden,
				successRate: document.getElementById('success-rate').textContent,
				noValue: SYMBOLS.noValue,
				status: document.getElementById('save-status').textContent,
			});`),
		);
		t.ok(english.bannerShown, 'the page shows the cannot-start banner');
		t.ok(english.successRate === english.noValue, 'the headline figure is the placeholder', english.successRate);
		t.ok(
			english.status === 'could not load ../data/setup.js and ../data/plan.js · not running',
			'the status line names both files it could not load',
			english.status,
		);

		const japanese = await js(
			"document.getElementById('language-toggle').click(); return document.getElementById('save-status').textContent;",
		);
		t.ok(
			japanese === '../data/setup.jsと../data/plan.js を読み込めませんでした・停止しています',
			'and names them in Japanese, joined without an English "and"',
			japanese,
		);
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
