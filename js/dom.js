'use strict';

/* ----------------------------- element building ----------------------------- */
/* style and dataset take objects, on* props are listeners, and the rest are set
   as properties (className, htmlFor, colSpan) or, where the element has none,
   as attributes (aria-*, data-*). Children may nest; null and false are skipped. */
const el = (tag, props = {}, ...children) => {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(props)) {
		if (value == null || value === false) {
			continue;
		}
		if (key === 'style' || key === 'dataset') {
			Object.assign(node[key], value);
		} else if (key.startsWith('on')) {
			node.addEventListener(key.slice(2).toLowerCase(), value);
		} else if (key in node) {
			node[key] = value;
		} else {
			node.setAttribute(key, value === true ? '' : value);
		}
	}
	node.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
	return node;
};

/* A translation is a string, or a list of strings and { em } / { strong } parts. */
const richText = (value) =>
	[value].flat().map((part) => (typeof part === 'string' ? part : el(part.em !== undefined ? 'em' : 'strong', {}, part.em ?? part.strong)));

/* A source URL can come from an AI's reply: only http(s) becomes a link, so a
   javascript: URL stays text. */
const isWebUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);

/* ----------------------------- formatting ----------------------------- */
/* Whole units in both currencies: Intl's own precision would put two decimals on
   a dollar figure and none on a yen one. */
const formatMoney = (v, role) => currencyText(role || 'primary', 'symbol') + Math.round(v).toLocaleString();
const toLargeUnit = (v, decimals, role) => (v / currencyText(role || 'primary', 'bigUnit.factor')).toFixed(decimals);
const formatLargeMoney = (v, role) =>
	toLargeUnit(v, currencyText(role || 'primary', 'bigUnit.decimals'), role) + currencyText(role || 'primary', 'bigUnit.label');
const formatPercent = (v) => v.toFixed(1) + '%';

/* Idle fields show grouped digits, so a box is read through readNumber, never
   parseFloat(value), which stops at the first comma. */
const ungroupDigits = (v) => String(v == null ? '' : v).replace(/,/g, '').trim();
const groupDigits = (v) => {
	const n = parseFloat(ungroupDigits(v));
	return isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 10 }) : '';
};
const readNumber = (input) => parseFloat(ungroupDigits(input.value));

/* ----------------------------- tooltips ----------------------------- */
const tipEl = el('div', { id: 'tooltip' });
document.body.appendChild(tipEl);
const TIP_GAP = 10,
	VIEWPORT_MARGIN = 6;
function placeTip(target) {
	const r = target.getBoundingClientRect();
	tipEl.style.left = '0px';
	tipEl.style.top = '0px'; // measure at origin
	const tipWidth = tipEl.offsetWidth,
		tipHeight = tipEl.offsetHeight;
	let left = r.right + TIP_GAP;
	if (left + tipWidth > window.innerWidth - VIEWPORT_MARGIN) {
		left = Math.max(VIEWPORT_MARGIN, r.left - tipWidth - TIP_GAP);
	}
	let top = r.top + r.height / 2 - tipHeight / 2;
	top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - tipHeight - VIEWPORT_MARGIN));
	tipEl.style.left = left + 'px';
	tipEl.style.top = top + 'px';
}
function showTip(target) {
	tipEl.textContent = target.dataset.tip;
	tipEl.classList.add('show');
	placeTip(target);
}
function hideTip() {
	tipEl.classList.remove('show');
}
function wireTips(host) {
	host.addEventListener('mouseover', (e) => {
		const t = e.target.closest('[data-tip]');
		if (t) {
			showTip(t);
		}
	});
	host.addEventListener('mouseout', (e) => {
		if (e.target.closest('[data-tip]')) {
			hideTip();
		}
	});
	host.addEventListener('focusin', (e) => {
		const t = e.target.closest('[data-tip]');
		if (t) {
			showTip(t);
		}
	});
	host.addEventListener('focusout', (e) => {
		if (e.target.closest('[data-tip]')) {
			hideTip();
		}
	});
	host.addEventListener('scroll', hideTip, true);
}
