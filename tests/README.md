# Tests

```
node tests/run.mjs              # everything, one browser at a time  (~13s)
node tests/run.mjs --parallel   # everything at once                 (~5s)
node tests/run.mjs median form  # named suites only
node tests/median.mjs           # one suite, standalone
```

Exits non-zero if any assertion fails.

## What these are

Browser integration tests, not unit tests. Each suite launches headless Chrome,
loads `retirement_simulator.html` over `file://`, and asserts against the live
page. Most suites first wait for the automatic first simulation; `startup` opens
a copy with no configuration beside it, which never runs one.

That is deliberate. The simulator is a page and a few classic scripts with no
build step and no module boundary to test through, and much of what breaks
here is only visible in a browser: canvas repaints, element geometry, computed
colours on `:hover`. The tests reach into page globals (`simulate`, `engineInputs`,
`lastMonteCarlo`, `readForm`) as freely as they read the DOM.

Nothing is installed. `harness.mjs` drives Chrome over the DevTools Protocol
using the `WebSocket` and `fetch` that Node already ships. It finds a browser in
the Playwright cache if one is there, otherwise a system Chrome or Chromium.

## The suites

| suite | covers |
|---|---|
| `form` | field table, self-describing names, digit grouping, config-driven presets and RMD age, chart hover |
| `median` | metric tiles and both chart axes read from the simulated paths, not a deterministic run |
| `outcomes` | outcome table shape, view buttons in the first column, tooltips |
| `sensitivity` | grid axes centred on the inputs, drag removed from the runs behind the cells |
| `survival` | the captions name the spending step and the ages they refer to and use no jargon, and the legend labels its groups "of starts" |
| `contrast` | every button readable resting and hovered, measured as a contrast ratio |
| `language` | the English/Japanese toggle reaches every string, and values survive it |
| `hygiene` | no script parses HTML from a string; a source URL and a banner line stay text |
| `startup` | a copy of the page with no configuration beside it shows the cannot-start banner, a placeholder figure and a status line naming the missing files, in English and Japanese |

Several assertions guard failures that look fine at a glance. `contrast` sweeps
every button on the page, not a named few, because a CSS specificity accident
can paint a button's text in its own background colour, and a button added later
would otherwise go unchecked. `language` sweeps every labelled element in one pass
because a string built too early to be re-read — a parse-time legend constant, a
label baked into a cached run — stays in English while everything around it
switches. `outcomes` measures button centres against row centres because a button
can look right alone and sit off its row. `survival` checks that its captions
quote the spending step and ages in force, because a caption can read well while
quoting a figure that has since changed.

## Writing another

A suite is an object with a `run(t, ctx)` method:

```js
import { main, isMain } from './harness.mjs';

const suite = {
  name: 'example',
  description: 'one line, shown in the summary',
  window: { width: 1400, height: 1200 },
  focus: false,          // true if you need :hover to resolve
  // url: 'file:///…',   // open a different page instead of the real one
  // startsStopped: true, // don't wait for a first simulation the page will never run
  async run(t, { js, cmd, wait, shot }) {
    t.ok(await js('return 1 + 1 === 2;'), 'arithmetic still works');
    t.log('anything worth printing but not asserting');
  },
};

export default suite;
if (isMain(import.meta.url)) await main(suite);
```

Then add its name to `SUITES` in `run.mjs`.

`js(expr)` evaluates `expr` as a function body in the page and returns the
value. It **throws** if the page throws, so a test whose selector matches nothing
fails loudly. Only JSON-serialisable values come back, so stringify anything
structured.

`ctx.shot(path, clip)` writes a PNG if you want to look at something. Nothing
calls it by default; screenshots are not part of any assertion.
