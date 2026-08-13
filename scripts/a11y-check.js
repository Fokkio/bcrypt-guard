const fs = require('node:fs');

const html = fs.readFileSync('desktop/index.html', 'utf8');
const css = fs.readFileSync('desktop/styles.css', 'utf8');
const failures = [];

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

requirePattern(html, /<a[^>]+class="skip-link"[^>]+href="#main"[^>]*>Skip to main content<\/a>/i, 'Skip link is missing');
requirePattern(html, /<main\s+id="main"/i, 'Main landmark is missing');
requirePattern(html, /<nav\s+class="nav-list"/i, 'Navigation landmark is missing');
requirePattern(html, /aria-live="polite"/i, 'Dynamic status announcement is missing');
requirePattern(css, /:focus-visible\s*\{[^}]*outline:/is, 'Visible focus style is missing');
requirePattern(css, /prefers-reduced-motion:\s*reduce/i, 'Reduced-motion rule is missing');

const h1Count = (html.match(/<h1\b/gi) || []).length;
if (h1Count !== 1) failures.push(`Expected one h1, found ${h1Count}`);
if (/tabindex="[1-9]/i.test(html)) failures.push('Positive tabindex changes logical focus order');
if (/outline:\s*none/i.test(css)) failures.push('Focus outlines must not be removed');
if (/<(?:div|span)[^>]+onclick=/i.test(html)) failures.push('Non-semantic clickable element found');

function rgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
}

function luminance(hex) {
  const channels = rgb(hex).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const [foreground, background, label] of [
  ['#17212b', '#f4f1ea', 'primary text'], ['#56616c', '#f4f1ea', 'muted text'],
  ['#ffffff', '#17212b', 'sidebar text'], ['#ffffff', '#b44924', 'primary button'],
]) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) failures.push(`${label} contrast is ${ratio.toFixed(2)}:1`);
}

if (failures.length) {
  for (const failure of failures) console.error(`A11Y_FAIL ${failure}`);
  process.exit(1);
}
console.log('Accessibility gate passed: landmarks, focus, semantics, motion, headings, and core contrast pairs.');
