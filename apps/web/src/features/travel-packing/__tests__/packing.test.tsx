// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type PackingItem, packingItemSchema } from '@wardrobe/shared';

import { i18n } from '../../../app/i18n';

import { PackingListItem } from '../components/PackingListItem';
import { TripForm } from '../components/TripForm';

const initial = packingItemSchema.parse({
  id: 'a7000000-0000-4000-8000-000000000001',
  category: 'tops',
  name: 'T-shirts',
  quantity: 10,
  description: '',
  weather_dependent: true,
  match_wardrobe: true,
  subcategory: '',
  seasons: [],
  warmth: null,
  material: '',
  style: '',
  occasion: '',
  assigned: [],
  packed: 0,
});

function Checklist() {
  const [item, setItem] = useState<PackingItem>(initial);

  return (
    <PackingListItem
      item={item}
      candidates={[]}
      used={new Set()}
      allowReuse={false}
      onChange={setItem}
      onRemove={() => {}}
    />
  );
}

describe('packing UI', () => {
  it.each(['en', 'pl'] as const)('renders optional departure in %s', async (language) => {
    await i18n.changeLanguage(language);
    render(<TripForm wardrobeId={initial.id} busy={false} onGenerate={() => {}} />);
    expect(
      screen.getByLabelText(
        language === 'en' ? 'Departure date (optional)' : 'Data wyjazdu (opcjonalnie)',
      ),
    ).not.toBeRequired();
    expect(screen.getByLabelText(language === 'en' ? 'Destination' : 'Cel podróży')).toBeRequired();
  });
  it('checks all pieces, unchecks and edits actual packed quantity', async () => {
    await i18n.changeLanguage('en');
    render(<Checklist />);

    const check = screen.getByRole('checkbox', { name: 'T-shirts' });

    fireEvent.click(check);
    expect(screen.getByLabelText('Packed')).toHaveValue(10);
    fireEvent.click(check);
    expect(screen.getByLabelText('Packed')).toHaveValue(0);
    fireEvent.change(screen.getByLabelText('Packed'), { target: { value: '3' } });
    expect(check).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Required'), { target: { value: '2' } });
    expect(screen.getByLabelText('Packed')).toHaveValue(2);
    expect(check).toBeChecked();
  });
});
