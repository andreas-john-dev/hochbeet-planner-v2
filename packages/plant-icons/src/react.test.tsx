import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ICONS } from './index';
import { IconSvg, PlantIcon } from './react';

describe('PlantIcon', () => {
  it('renders the plant icon with its name as accessible label', () => {
    const html = renderToStaticMarkup(
      <PlantIcon plant={{ icon: 'tomate', category: 'GEMUESE', name: 'Tomate' }} size={32} />,
    );
    expect(html).toContain('viewBox="0 0 48 48"');
    expect(html).toContain('width="32"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Tomate"');
    expect(html).toContain('data-icon="tomate"');
    expect(html.match(/<path /g)).toHaveLength(ICONS.tomate?.length ?? 0);
  });

  it('falls back to the category icon for own plants', () => {
    const html = renderToStaticMarkup(
      <PlantIcon plant={{ icon: 'eigene', category: 'KRAUT', name: 'Zitronenmelisse' }} />,
    );
    expect(html).toContain('data-icon="category-kraut"');
    expect(html).toContain('width="24"');
  });

  it('can be decorative', () => {
    const html = renderToStaticMarkup(
      <PlantIcon plant={{ icon: 'dill', category: 'KRAUT', name: 'Dill' }} decorative />,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-label');
  });

  it('draws lines with round caps and no fill', () => {
    const html = renderToStaticMarkup(<IconSvg icon="schnittlauch" />);
    expect(html).toMatch(
      /fill="none" stroke="#[0-9a-f]{6}" stroke-width="[\d.]+" stroke-linecap="round"/,
    );
  });
});
