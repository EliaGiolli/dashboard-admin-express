import axe from 'axe-core';

// jsdom has no layout or canvas, so axe can't compute contrast here; contrast is
// checked on the real page instead (palette validator + axe in the browser pass).
const JSDOM_UNSUPPORTED = { 'color-contrast': { enabled: false } };

/** Runs axe on a rendered container and returns the violations (empty when accessible). */
export async function axeViolations(container: Element) {
  const results = await axe.run(container, { rules: JSDOM_UNSUPPORTED });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`);
}
