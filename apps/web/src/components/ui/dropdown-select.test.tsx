// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DropdownSelect } from './dropdown-select';

function WearConditionSelect() {
  const [condition, setCondition] = useState('unknown');

  return (
    <div className="custom-value-editor" data-inline-editor-id="custom:wear-condition">
      <DropdownSelect
        aria-label="Stopień zużycia"
        value={condition}
        onChange={(event) => setCondition(event.currentTarget.value)}
      >
        <option value="unknown">Nie oceniono</option>
        <option value="low">Niski</option>
        <option value="medium">Średni</option>
        <option value="high">Wysoki</option>
      </DropdownSelect>
    </div>
  );
}

describe('DropdownSelect', () => {
  it('selects a custom-field value by mouse click without ending inline editing', async () => {
    const user = userEvent.setup();

    render(<WearConditionSelect />);

    await user.click(screen.getByRole('combobox', { name: 'Stopień zużycia' }));

    const listbox = screen.getByRole('listbox', { name: 'Stopień zużycia' });

    expect(listbox).toHaveAttribute('data-inline-editor-id', 'custom:wear-condition');
    await user.click(within(listbox).getByRole('option', { name: 'Średni' }));

    expect(screen.getByRole('combobox', { name: 'Stopień zużycia' })).toHaveValue('medium');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
