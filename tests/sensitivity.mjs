/* The sensitivity grid. Both axes are centred on the inputs, so the configured
   values are always in it, and the run behind each cell has the volatility drag
   removed, so a row label means the same as the field it came from. */

import { main, isMain } from './harness.mjs';

const suite = {
	name: 'sensitivity',
	description: 'sensitivity grid axes follow the inputs and label honestly',
	window: { width: 1500, height: 1400 },

	async run(t, { js, wait }) {
		const grid = () =>
			js(`const tb=document.querySelector('table.grid');
				return JSON.stringify({
					rows: [...tb.querySelectorAll('tr')].map(r=>[...r.children].map(c=>c.textContent.trim())),
					hereCount: tb.querySelectorAll('.as-configured').length,
					hereCell: (tb.querySelector('td.as-configured')||{}).textContent,
					hereRowLabel: [...tb.querySelectorAll('th.as-configured')].map(h=>h.textContent),
				});`);

		let g = JSON.parse(await grid());
		t.log(g.rows.map((r) => r.map((c) => c.padStart(9)).join('')).join('\n'));

		t.ok(g.rows.length === 6, '5 return rows plus a header', g.rows.length + ' rows');
		t.ok(g.rows[0].length === 8, '7 FX columns plus a corner', g.rows[0].length + ' columns');

		const f = JSON.parse(
			await js("const o=readForm(); return JSON.stringify([o.secondary.returnMeanPct, o.fx.rate]);"),
		);
		t.ok(
			g.rows[3][0] === f[0].toFixed(1) + '%',
			'middle row is the configured mean return',
			g.rows[3][0] + ' vs input ' + f[0] + '%',
		);
		t.ok(
			g.rows[0][4] === String(Math.round(f[1])),
			'middle column is the configured exchange rate',
			g.rows[0][4] + ' vs input ' + f[1],
		);

		t.ok(g.hereCount === 3, 'centre cell plus both axis headers are marked', g.hereCount + ' marked');
		t.ok(!!g.hereCell, 'the centre cell exists', g.hereCell);
		t.ok(
			(await js("return getComputedStyle(document.querySelector('table.grid td.as-configured')).outlineWidth;")) === '2px',
			'centre cell is outlined',
		);

		/* the drag comes off inside the run, so the row label matches the input
		   field rather than the rate the cell actually compounds at */
		const expected = await js(`const b=engineInputs({}), p=engineInputs({});
			p.pathCount=1; p.secondaryReturnVolatilityPct=0; p.primaryReturnVolatilityPct=0; p.fxVolatilityPct=0;
			p.secondaryReturnMeanPct = b.secondaryReturnMeanPct - Math.pow(b.secondaryReturnVolatilityPct,2)/2;
			p.primaryReturnMeanPct = b.primaryReturnMeanPct - Math.pow(b.primaryReturnVolatilityPct,2)/2;
			p.fxRate = Math.round(b.fxRate);
			return (simulate(p).minPortfolio[0]/1e8).toFixed(1);`);
		t.ok(g.hereCell === expected, 'centre cell runs at the mean less the drag on both sleeves', g.hereCell + ' = ' + expected);
		const undragged = await js(`const b=engineInputs({}), p=engineInputs({});
			p.pathCount=1; p.secondaryReturnVolatilityPct=0; p.primaryReturnVolatilityPct=0; p.fxVolatilityPct=0;
			p.fxRate = Math.round(b.fxRate);
			return (simulate(p).minPortfolio[0]/1e8).toFixed(1);`);
		t.ok(Number(undragged) > Number(expected), 'the drag adjustment is doing something', undragged + ' undragged vs ' + expected);

		const note = () => js("return document.getElementById('sensitivity-note').textContent;");
		t.ok(
			(await note()).includes('17.0%') && (await note()).includes('1.4'),
			'note reports the live volatility and its drag',
		);

		/* ---- and it all follows an edit ---- */
		/* Through whichever view a field has: the exchange rate is in the sidebar, the
		   mean return only in the settings sheet. VIEWS is the list either way. */
		await js(`for (const [id,v] of [['fx.rate',120],['secondary.returnMeanPct',5]]) {
			const el=VIEWS[id][0]; setField(el,v); el.dispatchEvent(new Event('input',{bubbles:true}));
		} return 1;`)
		await wait(1500);
		g = JSON.parse(await grid());
		t.ok(g.rows[3][0] === '5.0%', 'return axis re-centres on the new mean', g.rows.slice(1).map((r) => r[0]).join(' '));
		t.ok(g.rows[0][4] === '120', 'FX axis re-centres on the new rate', g.rows[0].slice(1).join(' '));
		t.ok((await note()).includes('1.4'), 'drag figure unchanged when only the mean moves');
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
