import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverlapNames } from './useOverlapFlow';

// The question is drawn by `modal.confirm`, outside the providers of the page: no language context.
describe('the list in the overlap question', () => {
  it('is drawn without any provider around it, and needs no hook', () => {
    render(
      <OverlapNames
        list={[
          { id: '1', name: 'Autumn' },
          { id: '2', name: 'ฤดูใบไม้ร่วง' },
        ]}
        intro="These will be stopped:"
        noNames="Another one will be stopped."
      />,
    );
    expect(screen.getByText('These will be stopped:')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Autumn',
      'ฤดูใบไม้ร่วง',
    ]);
  });

  it('says so when the backend named nobody', () => {
    render(<OverlapNames list={[]} intro="x" noNames="Another one will be stopped." />);
    expect(screen.getByText('Another one will be stopped.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows names that are not text and long names without breaking', () => {
    const long = 'ก'.repeat(300);
    render(
      <OverlapNames
        list={[
          { id: '1', name: 12 as unknown as string },
          { id: '2', name: { a: 1 } as unknown as string },
          { id: '3', name: null as unknown as string },
          { id: '4', name: long },
        ]}
        intro="x"
        noNames="y"
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toBe('12');
    expect(items[1].textContent).toBe('{"a":1}');
    expect(items[3].textContent).toBe(long);
    expect(items[3].style.overflowWrap).toBe('anywhere');
  });
});
