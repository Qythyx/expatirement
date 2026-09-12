/* Button legibility, at rest and on hover, measured as a contrast ratio: a
   specificity accident that paints a button's text in its background colour is
   caught whatever causes it. */

import { main, isMain } from './harness.mjs';

const RESTING_BG = 'rgb(246,241,231)';

const luminance = (css) => {
	const [r, g, b] = css.match(/\d+/g).slice(0, 3).map((v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
	const [l1, l2] = [luminance(a), luminance(b)];
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const suite = {
	name: 'contrast',
	description: 'buttons stay readable resting and hovered',
	window: { width: 1460, height: 1400 },
	focus: true, // :hover only resolves in a focused page

	async run(t, { js, cmd, wait }) {
		/* `settle` is how long to let the pointer move take effect. The four probes
		   below keep the generous default because nothing checks their aim; the sweep
		   asserts :hover matched, so it can pass a short one. */
		const probe = async (sel, label, hovered, settle = 260) => {
			const box = JSON.parse(
				await js(`const r=document.querySelector("${sel}").getBoundingClientRect();
					return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2});`),
			);
			await cmd('Input.dispatchMouseEvent', {
				type: 'mouseMoved',
				x: hovered ? box.x : 5,
				y: hovered ? box.y : 5,
			});
			await wait(settle);
			const c = JSON.parse(
				await js(`const s=getComputedStyle(document.querySelector("${sel}"));
					return JSON.stringify({color:s.color, bg:s.backgroundColor});`),
			);
			const bg = c.bg === 'rgba(0, 0, 0, 0)' ? RESTING_BG : c.bg;
			const r = ratio(c.color, bg);
			t.log(`${label.padEnd(26)} text ${c.color.padEnd(20)} on ${bg.padEnd(20)} = ${r.toFixed(2)}:1`);
			return r;
		};

		const compare = '#outcomes button[data-view=compare]';
		const sequence = '#outcomes button[data-view=sequence]';
		const inactiveRest = await probe(sequence, 'inactive, resting', false);
		const inactiveHover = await probe(sequence, 'inactive, HOVERED', true);
		const activeRest = await probe(compare, 'active, resting', false);
		const activeHover = await probe(compare, 'active, HOVERED', true);
		t.ok(inactiveHover >= 4.5, 'inactive button readable on hover', inactiveHover.toFixed(2) + ':1');
		t.ok(activeHover >= 4.5, 'active button readable on hover', activeHover.toFixed(2) + ':1');
		t.ok(
			inactiveRest >= 4.5 && activeRest >= 4.5,
			'both readable at rest',
			inactiveRest.toFixed(2) + ' / ' + activeRest.toFixed(2),
		);

		/* the toolbar buttons are the base rule itself, so a fix there must not undo
		   their deliberate fill-on-hover */
		await probe('#save-plan', 'toolbar button, resting', false);
		const toolbarHover = await probe('#save-plan', 'toolbar button, HOVERED', true);
		t.ok(toolbarHover >= 4.5, 'toolbar button legible on hover', toolbarHover.toFixed(2) + ':1');
		t.ok(
			(await js("return getComputedStyle(document.getElementById('save-plan')).backgroundColor;")) !==
				'rgba(0, 0, 0, 0)',
			'toolbar button still fills on hover',
		);

		/* Every button, so one added later is covered too. Two passes, because the
		   settings sheet is modal: with it open the pointer cannot reach the page
		   behind, and a probe there would read the resting colour twice. Each probe
		   confirms the element really is :hover. */
		const sweep = async (selector, where) => {
			const buttons = JSON.parse(
				await js(`document.querySelectorAll('button').forEach((b, i) => (b.dataset.probe = i));
					return JSON.stringify([...document.querySelectorAll("${selector}")]
						.filter((b) => b.offsetParent !== null && b.getBoundingClientRect().width > 0)
						.map((b) => ({ i: b.dataset.probe, name: (b.id || b.className || 'button') + ' “' + b.textContent.trim().slice(0, 14) + '”' })));`),
			);
			t.log(`sweeping ${buttons.length} buttons — ${where}`);
			const bad = [];
			for (const b of buttons) {
				const sel = `button[data-probe='${b.i}']`;
				await js(`document.querySelector("${sel}").scrollIntoView({ block: 'center' }); return 1;`);
				const rest = await probe(sel, b.name.slice(0, 26), false, 40);
				const hover = await probe(sel, b.name.slice(0, 26) + ' HOVER', true, 40);
				const reached = await js(`return document.querySelector("${sel}").matches(':hover');`);
				if (!reached) bad.push(`${b.name} never hovered`);
				else if (rest < 4.5 || hover < 4.5) bad.push(`${b.name} ${rest.toFixed(2)}/${hover.toFixed(2)}`);
			}
			return bad;
		};

		await js('closeSettings(); return 1;');
		const onPage = await sweep('button', 'the page');
		await js(`openSettings();
			for (const d of document.querySelectorAll('#settings-body details')) d.open = true;
			return 1;`);
		const inSheet = await sweep('#settings-sheet button', 'the settings sheet');
		await js('closeSettings(); return 1;');
		t.ok(
			!onPage.length && !inSheet.length,
			'every button is legible at rest and on hover, and every one was reached',
			onPage.concat(inSheet).join('; '),
		);
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
