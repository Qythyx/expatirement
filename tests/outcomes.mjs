/* The outcomes table under the headline figure, and the two view buttons in its
   first column. Button centres are measured against row centres, because a
   button can look right alone and sit off its row. */

import { main, isMain } from './harness.mjs';

const suite = {
	name: 'outcomes',
	description: 'outcome table shape, view buttons, tooltips',
	window: { width: 1460, height: 1400 },

	async run(t, { js, wait }) {
		t.log(
			await js(`const tb=document.querySelector('table.outcomes');
				const cells=r=>[...r.children].map(c=>c.textContent.trim());
				return 'HEAD  '+JSON.stringify(cells(tb.querySelector('thead tr')))+'\\n'+
					[...tb.querySelectorAll('tbody tr')].map(r=>'ROW   '+JSON.stringify(cells(r))).join('\\n');`),
		);

		const geom = JSON.parse(
			await js(`const tb=document.querySelector('table.outcomes');
				const rows=[...tb.querySelectorAll('tbody tr')];
				const mid=el=>{const r=el.getBoundingClientRect(); return +(r.top+r.height/2).toFixed(1);};
				return JSON.stringify({
					rowMids: rows.map(mid),
					btnMids: rows.map(r=>mid(r.querySelector('button'))),
					btnLeft: rows.map(r=>+r.querySelector('button').getBoundingClientRect().left.toFixed(1)),
					labelLeft: rows.map(r=>+r.querySelector('th').getBoundingClientRect().left.toFixed(1)),
					headEmpty: [...tb.querySelectorAll('thead th')].slice(0,2).every(h=>h.textContent===''),
					cols: tb.querySelector('thead tr').children.length,
				});`),
		);
		t.ok(
			geom.btnLeft.every((v, i) => v < geom.labelLeft[i]),
			'button column comes before the row label',
		);
		t.ok(geom.headEmpty, 'no heading over the button column');
		t.ok(geom.cols === 5, '5 columns', String(geom.cols));
		geom.rowMids.forEach((m, i) =>
			t.ok(
				Math.abs(geom.btnMids[i] - m) < 1.5,
				`button ${i + 1} is centred in its row`,
				geom.btnMids[i] + ' vs ' + m,
			),
		);

		const on = (view) =>
			js(`return document.querySelector('#outcomes button[data-view=${view}]').getAttribute('aria-pressed') === 'true';`);
		t.ok(await on('compare'), 'compare view is active to begin with');

		await js("document.querySelector('#outcomes button[data-view=sequence]').click(); return 1;");
		await wait(400);
		t.ok(await js("return survivalView === 'sequence';"), 'clicking switches the view');
		t.ok((await on('sequence')) && !(await on('compare')), 'active state moves with it');

		/* the table is rebuilt wholesale on every run, so the buttons in it are
		   new elements each time — state and handlers have to survive that */
		await js('runMonteCarlo(); return 1;');
		await wait(2500);
		t.ok(
			(await js("return document.querySelectorAll('#outcomes button[data-view]').length;")) === 2 &&
				(await on('sequence')),
			'buttons survive a re-render and keep their state',
		);
		t.ok(
			await js(`document.querySelector('#outcomes button[data-view=compare]').click();
				return survivalView === 'compare';`),
			'still clickable after a re-render',
		);
		await wait(300);

		t.ok(
			await js(`const td=document.querySelector('table.outcomes td[data-tip]');
				td.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
				const shown=document.getElementById('tooltip').classList.contains('show');
				td.dispatchEvent(new MouseEvent('mouseout',{bubbles:true}));
				return shown;`),
			'cell tooltips still fire',
		);
		t.ok(
			await js("return document.querySelector('table.outcomes td[data-tip]').tabIndex === 0;"),
			'and the cells can be tabbed to, so the keyboard reaches the tooltip',
		);
		t.ok(
			(await js("return getComputedStyle(document.querySelector('table.outcomes td:first-child')).cursor;")) !== 'help',
			'the button cell does not inherit the help cursor',
		);
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
