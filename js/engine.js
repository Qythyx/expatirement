'use strict';

/* Flat and role-named on purpose: the comparison runs build variants with
   { ...inputs, annualSpending: x }, and a nested object would half-copy. null
   survives fieldValue: it means a retirement account has no growth rate of its
   own, and null / 100 would make that a zero. */
function engineInputs() {
	const form = readForm();
	const fieldValue = (id) => {
		const raw = getPath(form, id);
		return raw != null && PERCENT_FIELDS.has(id) ? raw / 100 : raw;
	};
	/* An emptied option list means no pension: Infinity, the same as a field
	   dropped at startup. */
	const claimAge = (id) => {
		const spec = CLAIM_FIELDS[id];
		const chosen = fieldValue(id);
		return spec && spec.opts.length && isFinite(chosen) ? chosen : Infinity;
	};
	return {
		pathCount: 1,
		currentAge: fieldValue('plan.currentAge'),
		horizonEndAge: fieldValue('plan.horizonEndAge'),
		inflationPct: fieldValue('plan.inflationPct'),
		capitalGainsTaxPct: fieldValue('plan.capitalGainsTaxPct'),
		pensionTaxPct: fieldValue('plan.pensionTaxPct'),
		earnedIncome: fieldValue('plan.earnedIncome'),
		earnedIncomeTaxPct: fieldValue('plan.earnedIncomeTaxPct'),
		earnedIncomeEndAge: fieldValue('plan.earnedIncomeEndAge'),
		annualSpending: fieldValue('plan.annualSpending'),
		annualSpendingChangePct: fieldValue('plan.annualSpendingChangePct'),
		mortgageAnnual: fieldValue('plan.mortgageAnnual'),
		mortgagePayoffAge: fieldValue('plan.mortgagePayoffAge'),

		fxRate: fieldValue('fx.rate'),
		fxVolatilityPct: fieldValue('fx.volatilityPct'),

		primaryBrokerage: fieldValue('primary.brokerage'),
		primaryBrokerageGainPct: fieldValue('primary.brokerageGainPct'),
		primaryRetirement: fieldValue('primary.retirementAccount'),
		primaryRetirementTaxPct: fieldValue('primary.retirementAccountTaxPct'),
		primaryRetirementAccessAge: fieldValue('primary.retirementAccountAccessAge'),
		primaryRetirementGrowthPct: fieldValue('primary.retirementAccountGrowthPct'),
		primaryReturnMeanPct: fieldValue('primary.returnMeanPct'),
		primaryReturnVolatilityPct: fieldValue('primary.returnVolatilityPct'),

		secondaryBrokerage: fieldValue('secondary.brokerage'),
		secondaryBrokerageGainPct: fieldValue('secondary.brokerageGainPct'),
		secondaryRetirement: fieldValue('secondary.retirementAccount'),
		secondaryRetirementTaxPct: fieldValue('secondary.retirementAccountTaxPct'),
		secondaryRetirementAccessAge: fieldValue('secondary.retirementAccountAccessAge'),
		secondaryRetirementGrowthPct: fieldValue('secondary.retirementAccountGrowthPct'),
		secondaryReturnMeanPct: fieldValue('secondary.returnMeanPct'),
		secondaryReturnVolatilityPct: fieldValue('secondary.returnVolatilityPct'),
		secondaryScheduledDraw: fieldValue('secondary.scheduledRetirementDraw'),

		primaryPensionAnnual: claimAmount('primary.pensionStartAge', fieldValue('primary.pensionStartAge')),
		primaryPensionStartAge: claimAge('primary.pensionStartAge'),
		secondaryPensionAnnual: claimAmount('secondary.pensionStartAge', fieldValue('secondary.pensionStartAge')),
		secondaryPensionStartAge: claimAge('secondary.pensionStartAge'),

		primaryCompulsoryAge: compulsoryAge('primary'),
		secondaryCompulsoryAge: compulsoryAge('secondary'),
		primaryCompulsoryDivisor: compulsoryDivisorFn('primary'),
		secondaryCompulsoryDivisor: compulsoryDivisorFn('secondary'),
		/* Row and column 0 is the secondary sleeve, 1 the primary, 2 FX — the order
		   the three correlated draws come out of the Cholesky factor below. */
		correlationMatrix: [
			[1, fieldValue('correlations.secondaryPrimary'), fieldValue('correlations.secondaryFx')],
			[fieldValue('correlations.secondaryPrimary'), 1, fieldValue('correlations.primaryFx')],
			[fieldValue('correlations.secondaryFx'), fieldValue('correlations.primaryFx'), 1],
		],
		montecarloPaths: Math.max(configValue('simulation.minPaths'), Math.round(fieldValue('plan.montecarloPaths'))),
	};
}

/* ----------------------------- engine ----------------------------- */
function cholesky3x3(c) {
	const cholesky = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
	];
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j <= i; j++) {
			let s = c[i][j];
			for (let k = 0; k < j; k++) {
				s -= cholesky[i][k] * cholesky[j][k];
			}
			cholesky[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / cholesky[j][j];
		}
	}
	return cholesky;
}
/* Seeded, and reset at the start of every run: the same inputs give the same
   answer, and the comparison curves share market paths, so the gap between them
   is the spending difference alone. */
let rngState = configValue('simulation.seed');
function seedRandom(seed) {
	rngState = seed >>> 0 || 1;
	spareNormal = null; // drop any half-used Box-Muller pair from the previous run
}
function nextRandom() {
	rngState ^= rngState << 13;
	rngState >>>= 0;
	rngState ^= rngState >> 17;
	rngState ^= rngState << 5;
	rngState >>>= 0;
	return rngState / 4294967296;
}
let spareNormal = null;
function standardNormal() {
	if (spareNormal !== null) {
		const v = spareNormal;
		spareNormal = null;
		return v;
	}
	let u = 0,
		v = 0;
	while (u === 0) {
		u = nextRandom();
	}
	while (v === 0) {
		v = nextRandom();
	}
	const r = Math.sqrt(-2 * Math.log(u)),
		t = 2 * Math.PI * v;
	spareNormal = r * Math.sin(t);
	return r * Math.cos(t);
}

function simulate(inputs) {
	seedRandom(configValue('simulation.seed'));
	const years = inputs.horizonEndAge - inputs.currentAge + 1,
		n = inputs.pathCount,
		cholesky = cholesky3x3(inputs.correlationMatrix);
	const portfolioByYear = Array.from({ length: years }, () => new Float64Array(n));
	/* The year each path first fails, or -1. Not derivable from portfolio value:
	   banked pension surplus can lift a broke path back above zero. */
	const failedAt = new Int16Array(n).fill(-1);
	const pathFunded = new Uint8Array(n).fill(1),
		minPortfolio = new Float64Array(n).fill(Infinity),
		endPortfolio = new Float64Array(n);
	/* spendByYear is one row: spending is the same on every path. Start-of-year is
	   not stored: nothing moves between year-end and the next start and both are
	   deflated to the same level, so it is portfolioByYear[t-1], with
	   initialPortfolio at t=0. */
	const spendByYear = new Float64Array(years);
	const afterByYear = Array.from({ length: years }, () => new Float64Array(n));
	const initialPortfolio =
		inputs.secondaryBrokerage * inputs.fxRate +
		inputs.secondaryRetirement * inputs.fxRate +
		inputs.primaryBrokerage +
		inputs.primaryRetirement;
	const stochastic = inputs.secondaryReturnVolatilityPct || inputs.primaryReturnVolatilityPct || inputs.fxVolatilityPct ? true : false;
	for (let s = 0; s < n; s++) {
		let secondaryBrokerage = inputs.secondaryBrokerage,
			secondaryBrokerageBasis = inputs.secondaryBrokerage * inputs.fxRate * (1 - inputs.secondaryBrokerageGainPct),
			secondaryRetirement = inputs.secondaryRetirement,
			primaryBrokerage = inputs.primaryBrokerage,
			primaryBrokerageBasis = inputs.primaryBrokerage * (1 - inputs.primaryBrokerageGainPct),
			primaryRetirement = inputs.primaryRetirement,
			fx = inputs.fxRate,
			stayedFunded = true;
		for (let t = 0; t < years; t++) {
			const age = inputs.currentAge + t;
			/* Amounts are entered in today's money and carried to nominal by
			   priceLevel, so returns and capital-gains tax act on nominal figures;
			   everything stored is deflated back. The mortgage stays nominal: it is a
			   fixed contract. */
			const priceLevel = Math.pow(1 + inputs.inflationPct, t);
			const secondaryRetirementStart = secondaryRetirement * fx;
			let secondaryRetirementDrawn = 0; // gross drawn this year, in primary currency; the compulsory floor nets it off
			const primaryRetirementStart = primaryRetirement;
			let primaryRetirementDrawn = 0;
			let spend = inputs.annualSpending * priceLevel * Math.pow(1 + inputs.annualSpendingChangePct, t);
			if (age < inputs.mortgagePayoffAge) {
				spend += inputs.mortgageAnnual;
			}
			if (s === 0) {
				spendByYear[t] = spend / priceLevel;
			}
			const pensionGross = (age >= inputs.secondaryPensionStartAge ? inputs.secondaryPensionAnnual * priceLevel * fx : 0) + (age >= inputs.primaryPensionStartAge ? inputs.primaryPensionAnnual * priceLevel : 0),
				pensionNet = pensionGross * (1 - inputs.pensionTaxPct);
			const earnedIncomeNet = age < inputs.earnedIncomeEndAge ? inputs.earnedIncome * priceLevel * (1 - inputs.earnedIncomeTaxPct) : 0;
			/* left negative on purpose — a surplus is banked a few lines down */
			let fromPortfolio = spend - pensionNet - earnedIncomeNet;
			if (age >= inputs.secondaryRetirementAccessAge && inputs.secondaryScheduledDraw > 0) {
				const secondaryRetirementInPrimary = secondaryRetirement * fx,
					g = Math.min(inputs.secondaryScheduledDraw * priceLevel, secondaryRetirementInPrimary);
				secondaryRetirement = Math.max(0, secondaryRetirementInPrimary - g) / fx;
				fromPortfolio -= g * (1 - inputs.secondaryRetirementTaxPct);
				secondaryRetirementDrawn += g;
			}
			if (fromPortfolio < 0) {
				primaryBrokerage += -fromPortfolio;
				primaryBrokerageBasis += -fromPortfolio;
				fromPortfolio = 0;
			}
			const secondaryValue = secondaryBrokerage * fx,
				taxablePool = secondaryValue + primaryBrokerage,
				taxablePoolBasis = secondaryBrokerageBasis + primaryBrokerageBasis;
			const gainRatio = taxablePool > 0 ? Math.min(Math.max((taxablePool - taxablePoolBasis) / taxablePool, 0), 1) : 0,
				netOfTaxFactor = 1 - gainRatio * inputs.capitalGainsTaxPct;
			const saleGross = netOfTaxFactor > 0 ? Math.min(fromPortfolio / netOfTaxFactor, taxablePool) : 0,
				poolFractionSold = taxablePool > 0 ? saleGross / taxablePool : 0,
				saleNetProceeds = saleGross * netOfTaxFactor;
			secondaryBrokerage = fx > 0 ? (secondaryValue * (1 - poolFractionSold)) / fx : 0;
			secondaryBrokerageBasis *= 1 - poolFractionSold;
			primaryBrokerage *= 1 - poolFractionSold;
			primaryBrokerageBasis *= 1 - poolFractionSold;
			let afterTaxableSale = Math.max(0, fromPortfolio - saleNetProceeds);
			if (age >= inputs.secondaryRetirementAccessAge && afterTaxableSale > 0) {
				const secondaryRetirementInPrimary = secondaryRetirement * fx,
					g = Math.min(afterTaxableSale / (1 - inputs.secondaryRetirementTaxPct), secondaryRetirementInPrimary);
				secondaryRetirement = Math.max(0, secondaryRetirementInPrimary - g) / fx;
				afterTaxableSale = Math.max(0, afterTaxableSale - g * (1 - inputs.secondaryRetirementTaxPct));
				secondaryRetirementDrawn += g;
			}
			let afterSecondaryRetirement = afterTaxableSale;
			if (age >= inputs.primaryRetirementAccessAge && afterTaxableSale > 0) {
				const g = Math.min(afterTaxableSale / (1 - inputs.primaryRetirementTaxPct), primaryRetirement);
				primaryRetirement = Math.max(0, primaryRetirement - g);
				primaryRetirementDrawn += g;
				afterSecondaryRetirement = Math.max(0, afterTaxableSale - g * (1 - inputs.primaryRetirementTaxPct));
			}
			if (afterSecondaryRetirement > 1) {
				stayedFunded = false;
				if (failedAt[s] < 0) {
					failedAt[s] = t;
				}
			}
			if (age >= inputs.secondaryCompulsoryAge) {
				const shortfall =
					secondaryRetirementStart / inputs.secondaryCompulsoryDivisor(age) - secondaryRetirementDrawn;
				if (shortfall > 0) {
					const g = Math.min(shortfall, secondaryRetirement * fx),
						net = g * (1 - inputs.secondaryRetirementTaxPct);
					secondaryRetirement = Math.max(0, secondaryRetirement * fx - g) / fx;
					secondaryBrokerage += fx > 0 ? net / fx : 0;
					secondaryBrokerageBasis += net;
				}
			}
			if (age >= inputs.primaryCompulsoryAge) {
				const shortfall =
					primaryRetirementStart / inputs.primaryCompulsoryDivisor(age) - primaryRetirementDrawn;
				if (shortfall > 0) {
					const g = Math.min(shortfall, primaryRetirement),
						net = g * (1 - inputs.primaryRetirementTaxPct);
					primaryRetirement = Math.max(0, primaryRetirement - g);
					primaryBrokerage += net;
					primaryBrokerageBasis += net;
				}
			}
			/* After every outflow and before growth, so start − after is the year's
			   drawdown, tax included. */
			afterByYear[t][s] = (secondaryBrokerage * fx + secondaryRetirement * fx + primaryBrokerage + primaryRetirement) / priceLevel;
			/* No drift term in the exchange rate: no honest value exists for one, and
			   the inflation gap between the countries is carried on the mean returns
			   instead — see the returnMeanPct tooltip. */
			let secondaryReturn = inputs.secondaryReturnMeanPct,
				primaryReturn = inputs.primaryReturnMeanPct,
				fxReturn = 0;
			if (stochastic) {
				const z0 = standardNormal(),
					z1 = standardNormal(),
					z2 = standardNormal();
				secondaryReturn = inputs.secondaryReturnMeanPct + inputs.secondaryReturnVolatilityPct * (cholesky[0][0] * z0);
				primaryReturn = inputs.primaryReturnMeanPct + inputs.primaryReturnVolatilityPct * (cholesky[1][0] * z0 + cholesky[1][1] * z1);
				fxReturn = inputs.fxVolatilityPct * (cholesky[2][0] * z0 + cholesky[2][1] * z1 + cholesky[2][2] * z2);
			}
			secondaryBrokerage *= 1 + secondaryReturn;
			primaryBrokerage *= 1 + primaryReturn;
			secondaryRetirement *= 1 + (inputs.secondaryRetirementGrowthPct ?? secondaryReturn);
			primaryRetirement *= 1 + (inputs.primaryRetirementGrowthPct ?? primaryReturn);
			fx *= Math.exp(fxReturn);
			/* deflated by the level one year on, where this balance actually sits, so
			   it lines up with next year's start-of-year figure */
			const val = (secondaryBrokerage * fx + secondaryRetirement * fx + primaryBrokerage + primaryRetirement) / (priceLevel * (1 + inputs.inflationPct));
			portfolioByYear[t][s] = val;
			if (val < minPortfolio[s]) {
				minPortfolio[s] = val;
			}
		}
		pathFunded[s] = stayedFunded ? 1 : 0;
		endPortfolio[s] = portfolioByYear[years - 1][s];
	}
	return { years, portfolioByYear, spendByYear, afterByYear, initialPortfolio, pathFunded, failedAt, minPortfolio, endPortfolio, successPct: (100 * pathFunded.reduce((a, b) => a + b, 0)) / n };
}
function percentile(arr, q) {
	const a = Float64Array.from(arr).sort();
	const i = (a.length - 1) * q;
	const lo = Math.floor(i),
		hi = Math.ceil(i);
	return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo);
}
