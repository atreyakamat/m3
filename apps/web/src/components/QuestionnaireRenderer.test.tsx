import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QuestionSection } from '@m3/shared';
import { QuestionnaireRenderer } from './QuestionnaireRenderer';

const sections: QuestionSection[] = [
  {
    id: 'demo',
    title: 'Demo Section',
    fields: [
      { id: 'full_name', type: 'text', label: 'Full name', required: true },
      { id: 'fever_today', type: 'tristate', label: 'Fever today?', options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'not_sure', label: 'Not sure' },
      ] },
      { id: 'temp', type: 'temperature', label: 'Temperature', unit: '°C', showIf: { field: 'fever_today', equals: 'yes' } },
    ],
  },
];

describe('QuestionnaireRenderer', () => {
  it('renders a section title and its fields', () => {
    render(<QuestionnaireRenderer sections={sections} values={{}} onChange={vi.fn()} />);
    expect(screen.getByText('Demo Section')).toBeInTheDocument();
    expect(screen.getByText('Full name *')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('respects showIf: the temperature field only appears when fever=yes', () => {
    const { rerender } = render(<QuestionnaireRenderer sections={sections} values={{}} onChange={vi.fn()} />);
    expect(screen.queryByText('Temperature (°C)')).not.toBeInTheDocument();
    rerender(<QuestionnaireRenderer sections={sections} values={{ fever_today: 'yes' }} onChange={vi.fn()} />);
    expect(screen.getByText('Temperature (°C)')).toBeInTheDocument();
  });
});
