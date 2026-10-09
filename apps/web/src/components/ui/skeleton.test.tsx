import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkeletonList } from './skeleton';

describe('SkeletonList', () => {
  it('announces loading once and hides the placeholders', () => {
    const { container } = render(<SkeletonList label="Katalog wird geladen …" count={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('Katalog wird geladen …');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});
