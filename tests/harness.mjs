/* Shared plumbing for the browser tests. Chrome is driven over the DevTools
   Protocol with the WebSocket and fetch that Node ships — nothing is installed. */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PAGE_URL = pathToFileURL(path.join(HERE, '..', 'simulator.html')).href;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export { wait };

/* The Playwright cache is globbed, not pinned: its directory is named after a
   build number that moves. */
export function findChrome() {
	const candidates = [];
	const pw = path.join(os.homedir(), 'Library/Caches/ms-playwright');
	if (fs.existsSync(pw)) {
		for (const dir of fs.readdirSync(pw).filter((d) => d.startsWith('chromium')).sort().reverse()) {
			candidates.push(
				path.join(pw, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
				path.join(pw, dir, 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
				path.join(pw, dir, 'chrome-linux/chrome'),
			);
		}
	}
	candidates.push(
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium',
	);
	const found = candidates.find((c) => fs.existsSync(c));
	if (!found) throw new Error('no Chrome found — looked in ' + candidates.join(', '));
	return found;
}

/* Port 0, read back from the profile directory, so suites can run in parallel. */
async function readDevToolsPort(profile, timeoutMs) {
	const file = path.join(profile, 'DevToolsActivePort');
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const [port] = fs.readFileSync(file, 'utf8').split('\n');
			if (port && port.trim()) return Number(port.trim());
		} catch {}
		await wait(80);
	}
	throw new Error('Chrome never reported a debugging port');
}

export async function open({ width = 1460, height = 1400, focus = false, url = PAGE_URL } = {}) {
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'retsim-'));
	const chrome = spawn(
		findChrome(),
		[
			'--headless=new',
			'--disable-gpu',
			'--no-sandbox',
			'--hide-scrollbars',
			'--remote-debugging-port=0',
			'--user-data-dir=' + profile,
			`--window-size=${width},${height}`,
			'about:blank',
		],
		{ stdio: 'ignore' },
	);
	const port = await readDevToolsPort(profile, 20000);

	let ws;
	for (let i = 0; i < 50 && !ws; i++) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
			const page = list.find((t) => t.type === 'page');
			if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
		} catch {}
		if (!ws) await wait(120);
	}
	if (!ws) throw new Error('could not attach to a page');
	await new Promise((resolve, reject) => {
		ws.onopen = resolve;
		ws.onerror = reject;
	});

	let id = 0;
	const pending = new Map();
	const waiting = [];
	const errors = [];
	ws.onmessage = (e) => {
		const m = JSON.parse(e.data);
		if (pending.has(m.id)) {
			pending.get(m.id)(m);
			pending.delete(m.id);
		}
		for (let i = waiting.length - 1; i >= 0; i--) {
			if (waiting[i].method === m.method) waiting.splice(i, 1)[0].resolve(m);
		}
		if (m.method === 'Runtime.exceptionThrown') {
			const d = m.params.exceptionDetails;
			errors.push(d.text + ' ' + ((d.exception || {}).description || ''));
		}
		if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
			errors.push(JSON.stringify(m.params.args));
		}
	};
	const cmd = (method, params = {}) =>
		new Promise((r) => {
			const i = ++id;
			pending.set(i, r);
			ws.send(JSON.stringify({ id: i, method, params }));
		});

	/* Resolves on the next event of this name. Subscribe before issuing the command
	   that causes it, or the event can arrive first and never be seen. */
	const once = (method) => new Promise((resolve) => waiting.push({ method, resolve }));

	/* Throws if the page throws: returning undefined would let an assertion on an
	   element that was never found pass. */
	const js = async (expr) => {
		const r = await cmd('Runtime.evaluate', {
			expression: `(()=>{${expr}})()`,
			returnByValue: true,
			awaitPromise: true,
		});
		const bad = r.result.exceptionDetails;
		if (bad) {
			throw new Error(
				'page threw: ' + ((bad.exception || {}).description || bad.text) + '\n  in: ' + expr.trim(),
			);
		}
		return r.result.result.value;
	};

	await cmd('Page.enable');
	await cmd('Runtime.enable');
	/* Downloads go to a directory of this run's own. Set here, not per suite, so no
	   suite that saves can write into the user's Downloads. */
	const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'retsim-dl-'));
	await cmd('Browser.setDownloadBehavior', {
		behavior: 'allow',
		downloadPath: downloads,
		eventsEnabled: true,
	});
	/* Hover styles resolve against a focused page; without this the headless
	   window is considered inactive and :hover reads back wrong. */
	if (focus) await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
	await cmd('Page.navigate', { url });

	const ready = async (timeoutMs = 30000) => {
		const deadline = Date.now() + timeoutMs;
		for (;;) {
			let done = 0;
			try {
				done = await js(`return (typeof lastMonteCarlo !== 'undefined' && lastMonteCarlo
					&& /^[0-9]/.test(document.getElementById('success-rate').textContent)) ? 1 : 0;`);
			} catch {}
			if (done) return;
			if (Date.now() > deadline) throw new Error('page never finished its first simulation');
			await wait(120);
		}
	};

	/* Page.reload resolves when Chrome acknowledges the command, not when the new
	   document exists — and ready() swallows errors while it polls, so it can be
	   satisfied by the *old* page and hand back a window mid-swap, where
	   document.documentElement is null. */
	const reload = async () => {
		const loaded = once('Page.loadEventFired');
		await cmd('Page.reload');
		await loaded;
		await ready();
	};

	const shot = async (file, clip) => {
		const r = await cmd('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
		return file;
	};

	const close = () => {
		try {
			ws.close();
		} catch {}
		chrome.kill('SIGKILL');
		for (const dir of [profile, downloads]) {
			try {
				fs.rmSync(dir, { recursive: true, force: true });
			} catch {}
		}
	};

	return { cmd, js, wait, ready, reload, shot, errors, close, port, downloads };
}

/* Buffered, so a suite's output stays in one block when suites run in parallel. */
export function recorder(name) {
	const lines = [];
	let pass = 0,
		fail = 0;
	return {
		get pass() {
			return pass;
		},
		get fail() {
			return fail;
		},
		lines,
		name,
		log(msg) {
			lines.push('     ' + String(msg).replace(/\n/g, '\n     '));
		},
		ok(cond, label, detail = '') {
			cond ? pass++ : fail++;
			lines.push(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  [' + detail + ']' : ''}`);
			return !!cond;
		},
	};
}

/* Run one suite object: { name, description, window, focus, url, startsStopped, run(t, ctx) }. */
export async function runSuite(suite) {
	const t = recorder(suite.name);
	let ctx;
	try {
		ctx = await open({ ...(suite.window || {}), focus: !!suite.focus, url: suite.url });
		if (!suite.startsStopped) {
			await ctx.ready();
		}
		await suite.run(t, ctx);
		t.ok(ctx.errors.length === 0, 'no console errors', ctx.errors.slice(0, 2).join(' | '));
	} catch (err) {
		t.ok(false, 'suite crashed', err.message);
	} finally {
		if (ctx) ctx.close();
	}
	return t;
}

export function isMain(url) {
	return !!process.argv[1] && url === pathToFileURL(process.argv[1]).href;
}

export async function main(suite) {
	const t = await runSuite(suite);
	console.log(`\n${suite.name} — ${suite.description}`);
	t.lines.forEach((l) => console.log(l));
	console.log(`\n${t.pass} passed, ${t.fail} failed`);
	process.exit(t.fail ? 1 : 0);
}
