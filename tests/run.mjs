#!/usr/bin/env node
/* Runs every suite and exits non-zero if anything failed.

     node tests/run.mjs              all suites
     node tests/run.mjs median form  just those
     node tests/run.mjs --parallel   all at once (each gets its own browser)

   Individual suites also run on their own: node tests/median.mjs */

import { runSuite } from './harness.mjs';

const SUITES = ['form', 'median', 'outcomes', 'sensitivity', 'survival', 'contrast', 'language', 'hygiene', 'startup'];

const args = process.argv.slice(2);
const parallel = args.includes('--parallel');
const wanted = args.filter((a) => !a.startsWith('--'));
const names = wanted.length ? wanted : SUITES;

const unknown = names.filter((n) => !SUITES.includes(n));
if (unknown.length) {
	console.error('unknown suite(s): ' + unknown.join(', ') + '\nknown: ' + SUITES.join(', '));
	process.exit(2);
}

const loaded = await Promise.all(names.map(async (n) => (await import(`./${n}.mjs`)).default));

const started = Date.now();
const results = parallel
	? await Promise.all(loaded.map(runSuite))
	: await loaded.reduce(async (acc, s) => [...(await acc), await runSuite(s)], Promise.resolve([]));

let pass = 0,
	fail = 0;
results.forEach((t, i) => {
	console.log(`\n── ${t.name} — ${loaded[i].description}`);
	t.lines.forEach((l) => console.log(l));
	pass += t.pass;
	fail += t.fail;
});

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${'─'.repeat(60)}`);
results.forEach((t) => console.log(`  ${t.fail ? 'FAIL' : 'ok  '}  ${t.name.padEnd(12)} ${t.pass} passed${t.fail ? ', ' + t.fail + ' failed' : ''}`));
console.log(`\n${pass} passed, ${fail} failed in ${secs}s`);
process.exit(fail ? 1 : 0);
