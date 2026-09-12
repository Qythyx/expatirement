/* Everything on the charts and in the metric tiles is read off the simulated
   paths. A single volatility-free run compounds at the full arithmetic mean, sits
   far above the median by the horizon and understates the withdrawal rate, so
   these assertions check that nothing reads from one. */

import { main, isMain } from './harness.mjs';

const suite = {
	name: 'median',
	description: 'metric tiles and both chart axes read from the simulated paths',
	window: { width: 1400, height: 1200 },

	async run(t, { js, wait }) {
		t.ok(
			await js("return typeof central === 'undefined' && typeof renderDet === 'undefined';"),
			'central() and renderDet() are gone',
		);
		t.ok(await js("return typeof renderSummary === 'function';"), 'renderSummary replaced them');

		/* ---- metric tiles ---- */
		const tile = (i) => js(`return document.querySelectorAll('#path-metrics .metric')[${i}].querySelector('.figure').textContent;`);
		t.ok(
			(await js("return document.querySelector('#path-metrics .metric .caps').textContent;")) ===
				'Min portfolio (median path)',
			'min-portfolio tile relabelled',
			await tile(0),
		);
		t.ok(
			(await tile(0)) === (await js('return formatLargeMoney(percentile(lastMonteCarlo.minPortfolio, 0.5));')),
			'min tile is the median of each path’s own low point',
			await tile(0),
		);
		t.ok(
			(await tile(1)) === (await js('return formatLargeMoney(percentile(lastMonteCarlo.endPortfolio, 0.5));')),
			'ending tile is the median ending value',
			await tile(1),
		);
		/* the distinction that makes the first tile worth having: the typical
		   path's worst moment is not the worst moment of the median band */
		t.ok(
			await js(`const m=lastMonteCarlo;
				return Math.abs(percentile(m.minPortfolio,0.5) - Math.min(...m.bands[50])) > 1e7;`),
			'median-of-minima differs from the low point of the median band',
			await js(`const m=lastMonteCarlo;
				return formatLargeMoney(percentile(m.minPortfolio,0.5))+' vs '+formatLargeMoney(Math.min(...m.bands[50]));`),
		);

		/* ---- derived per-year series ---- */
		t.ok(
			await js('return lastMonteCarlo.startMedian[0] === lastMonteCarlo.initialPortfolio;'),
			'start-of-year at t=0 is the opening balance',
		);
		t.ok(
			await js(`const m=lastMonteCarlo;
				return m.startMedian.slice(1).every((v,i)=>v === m.bands[50][i]);`),
			'start-of-year is the previous year-end (nothing moves in between)',
		);
		t.ok(
			await js(`const m=lastMonteCarlo;
				return m.spendByYear.length===m.years
					&& m.afterByYear.length===m.years
					&& m.afterByYear[0].length===m.pathFunded.length;`),
			'per-year diagnostics sized for every path',
		);
		/* drawn is the median of each path's own drawdown, not the gap between
		   two medians — recompute it from scratch and compare */
		t.ok(
			(await js(`const m=lastMonteCarlo, n=m.pathFunded.length, one=new Float64Array(n);
				for (let t=0; t<m.years; t++) {
					const prev = t===0 ? null : m.portfolioByYear[t-1];
					for (let s=0; s<n; s++) {
						const start = prev ? prev[s] : m.initialPortfolio;
						one[s] = Math.max(0, start - m.afterByYear[t][s]);
					}
					if (Math.abs(percentile(one,0.5) - m.drawnMedian[t]) > 1) return 'mismatch at t=' + t;
				}
				return true;`)) === true,
			'drawn is the median of each path’s own drawdown',
		);

		/* ---- a drawdown is the spending plus the tax on selling for it ---- */
		/* On a plan of its own: income, pensions and compulsory draws pay part of the
		   spending before anything is sold, so whether the drawdown exceeds the spending
		   in the configured plan depends on how much they pay. */
		const [spent, drawn] = JSON.parse(
			await js(`const r = simulate(Object.assign(engineInputs(), {
					pathCount: 300, currentAge: 70, horizonEndAge: 80,
					primaryBrokerage: 300000000, primaryBrokerageGainPct: 0.5, secondaryBrokerage: 0,
					capitalGainsTaxPct: 0.2, annualSpending: 5000000, annualSpendingChangePct: 0,
					earnedIncome: 0, mortgageAnnual: 0, primaryPensionAnnual: 0, secondaryPensionAnnual: 0,
					secondaryScheduledDraw: 0, primaryCompulsoryAge: Infinity, secondaryCompulsoryAge: Infinity,
				}));
				const t = 5, n = r.pathFunded.length, one = new Float64Array(n);
				for (let s = 0; s < n; s++) one[s] = r.portfolioByYear[t - 1][s] - r.afterByYear[t][s];
				return JSON.stringify([r.spendByYear[t], percentile(one, 0.5)]);`),
		);
		t.ok(
			drawn > spent,
			'with no income or pension, the drawdown exceeds spending (tax on sales)',
			Math.round(drawn) + ' drawn vs ' + Math.round(spent) + ' spent',
		);

		/* ---- no copy describes a central or dashed line ---- */
		const legend = await js("return document.getElementById('path-legend').innerText.replace(/\\s+/g,' ');");
		t.ok(!/central|dashed/i.test(legend), 'legend has no central entry', legend);
		t.ok(
			await js(`return !/dashed|central/i.test(
				document.getElementById('path-chart').closest('.panel').querySelector('.note').textContent);`),
			'chart caption drops the dashed-line explanation',
		);
		t.ok(
			await js("return !/central/i.test(document.getElementById('success-caption').textContent);"),
			'success caption drops the central-line clause',
		);
		t.ok(
			(await js(`return document.getElementById('path-chart').closest('.panel')
				.querySelector('h2 span').textContent;`)) === 'Portfolio path',
			'panel heading renamed',
		);

		/* ---- with no run for these ages there is nothing to draw but the frame ---- */
		t.ok(
			await js(`lastMonteCarlo = null;
				try { drawMain(); renderSummary(); } catch (e) { return 'THREW ' + e.message; }
				return document.getElementById('path-legend').childElementCount === 0
					&& document.querySelectorAll('#path-metrics .figure')[0].textContent === '—';`),
			'no-run state draws a bare frame instead of throwing',
		);
		/* put the page back so the shared no-console-errors check is meaningful */
		await js('runMonteCarlo(); return 1;');
		await wait(1200);
	},
};

export default suite;

if (isMain(import.meta.url)) await main(suite);
