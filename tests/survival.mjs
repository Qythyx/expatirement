/* The survival panel's prose: the captions and legend must describe each group of
   paths in plain words, because the two readings show disjoint groups that
   otherwise look like a contradiction. */

import { main, isMain } from './harness.mjs';

const suite = {
	name: 'survival',
	description: 'survival panel captions and legend stay in plain language',
	window: { width: 1460, height: 1500 },

	async run(t, { js, wait }) {
		const note = () =>
			js("return document.getElementById('survival-note').textContent.replace(/\\s+/g,' ').trim();");
		const legend = () =>
			js("return [...document.querySelectorAll('#survival-legend span')].map(e=>e.textContent).join(' / ');");

		const compare = await note();
		t.log('COMPARE: ' + compare);
		t.ok(
			compare.includes('20% lower') && compare.includes('20% higher'),
			'compare caption names the ±20% spending step',
		);
		t.ok(
			await js("return document.getElementById('survival-note').textContent.includes(String(engineInputs().horizonEndAge));"),
			'compare caption keeps the age reference',
		);

		await js("document.querySelector('#outcomes button[data-view=sequence]').click(); return 1;");
		await wait(350);
		const badStart = await note();
		t.log('BAD START: ' + badStart);
		t.ok(!/exogenous|sequence risk|circular|p\d\d/i.test(badStart), 'no jargon in the bad-start caption');
		const splitAge = (await js('return engineInputs({}).currentAge;')) + 10;
		t.ok(badStart.includes('age ' + splitAge), 'bad-start caption states the split age', 'currentAge + 10 = ' + splitAge);
		t.ok((await legend()).includes('of starts'), 'legend labels say what the groups are', await legend());

		/* the split age is currentAge + 10, so it has to follow the input */
		await js(`const el=document.getElementById('plan.currentAge');
			el.focus(); el.value='50'; el.dispatchEvent(new Event('input',{bubbles:true})); el.blur(); return 1;`);
		await wait(700);
		await js('document.getElementById("survival-note").replaceChildren(...richText(survivalNote())); return 1;');
		t.ok((await note()).includes('age 60'), 'split age follows currentAge', (await note()).match(/age \d+/)[0]);

		await js('writeForm(BASE_PLAN); return 1;');
		await js("document.querySelector('#outcomes button[data-view=compare]').click(); return 1;");
		await wait(300);
		t.ok(
			await js("return document.getElementById('survival-note').textContent.includes(String(engineInputs().horizonEndAge));"),
			'age reference restored on toggle back',
		);
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
