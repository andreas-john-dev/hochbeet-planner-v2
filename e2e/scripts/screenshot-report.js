// Compares PR screenshots with the ones from main and writes the PR comment.
// Usage: node scripts/screenshot-report.js <current-dir> <baseline-dir> <current-url> <baseline-url> <out.md>
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export const MARKER = '<!-- pr-screenshots -->';
const viewports = [
  { id: 'desktop', label: 'Desktop', width: 560 },
  { id: 'mobile', label: 'Mobil', width: 220 },
];
/** Share of differing pixels above which a screenshot counts as changed. */
const CHANGE_THRESHOLD = 0.001;

/** True when both PNGs exist and look the same. */
export function isUnchanged(currentFile, baselineFile) {
  if (!existsSync(baselineFile)) return false;
  const current = PNG.sync.read(readFileSync(currentFile));
  const baseline = PNG.sync.read(readFileSync(baselineFile));
  if (current.width !== baseline.width || current.height !== baseline.height) return false;
  const diff = pixelmatch(current.data, baseline.data, null, current.width, current.height, {
    threshold: 0.1,
  });
  return diff / (current.width * current.height) <= CHANGE_THRESHOLD;
}

function imageRow(baseUrl, pageId) {
  const cells = viewports.map(
    (v) =>
      `<img src="${baseUrl}/${v.id}/${pageId}.png" width="${String(v.width)}" alt="${v.label}">`,
  );
  return `| ${viewports.map((v) => v.label).join(' | ')} |\n| --- | --- |\n| ${cells.join(' | ')} |`;
}

export function buildReport({ currentDir, baselineDir, currentUrl, baselineUrl, sha }) {
  const pages = JSON.parse(readFileSync(join(currentDir, 'manifest.json'), 'utf8'));
  const sections = [];

  for (const page of pages) {
    const files = viewports.map((v) => ({
      current: join(currentDir, v.id, `${page.id}.png`),
      baseline: join(baselineDir, v.id, `${page.id}.png`),
    }));
    if (files.every((f) => isUnchanged(f.current, f.baseline))) continue;

    const isNew = files.every((f) => !existsSync(f.baseline));
    let section = `### ${page.heading} (\`${page.path}\`) – ${isNew ? 'neu' : 'geändert'}\n\n${imageRow(currentUrl, page.id)}`;
    if (!isNew) {
      section += `\n\n<details><summary>Vorher (main)</summary>\n\n${imageRow(baselineUrl, page.id)}\n\n</details>`;
    }
    sections.push(section);
  }

  const header = `${MARKER}\n## Screenshots geänderter Seiten\n\nStand ${sha.slice(0, 7)}, verglichen mit \`main\`. Hell, Desktop 1280 px und iPhone 15.`;
  const body = sections.length
    ? sections.join('\n\n')
    : 'Keine sichtbaren Änderungen an den Seiten gegenüber `main`.';
  return { markdown: `${header}\n\n${body}\n`, changed: sections.length };
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const [currentDir, baselineDir, currentUrl, baselineUrl, outFile] = process.argv.slice(2);
  if (!currentDir || !baselineDir || !currentUrl || !baselineUrl || !outFile) {
    throw new Error(
      'Usage: screenshot-report.js <current> <baseline> <current-url> <baseline-url> <out>',
    );
  }
  const { markdown, changed } = buildReport({
    currentDir,
    baselineDir,
    currentUrl,
    baselineUrl,
    sha: process.env.GITHUB_SHA ?? 'local',
  });
  writeFileSync(outFile, markdown);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${String(changed)}\n`);
  console.log(`${String(changed)} changed page(s)`);
}
