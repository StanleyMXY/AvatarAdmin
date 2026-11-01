import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { JsonField, parseJson } from './JsonField';

function Harness({
  onValidity,
  initial = '{}',
}: {
  onValidity: (v: boolean) => void;
  initial?: string;
}) {
  const [text, setText] = useState(initial);
  return <JsonField value={text} onChange={setText} onValidityChange={onValidity} />;
}

function InlineHarness({ reports }: { reports: boolean[] }) {
  const [text, setText] = useState('{}');
  const [, setTick] = useState(0);
  return (
    <>
      <JsonField
        value={text}
        onChange={setText}
        onValidityChange={(valid) => reports.push(valid)} // a new function on every render
      />
      <button type="button" onClick={() => setTick((n) => n + 1)}>
        render again
      </button>
    </>
  );
}

describe('parseJson', () => {
  it('parses objects, arrays and scalars, and refuses the rest', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJson('[1,2]')).toEqual({ ok: true, value: [1, 2] });
    expect(parseJson('0')).toEqual({ ok: true, value: 0 });
    expect(parseJson('null')).toEqual({ ok: true, value: null });
    for (const bad of ['{', "{'a':1}", '', 'undefined', '{"a":1,}']) {
      expect(parseJson(bad).ok).toBe(false);
    }
  });
});

describe('JsonField', () => {
  it('reports an error and tells the parent form when the text is not JSON, and clears it when fixed', () => {
    const onValidity = vi.fn();
    renderPage(<Harness onValidity={onValidity} />);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Not valid JSON');
    expect(onValidity).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onValidity).toHaveBeenLastCalledWith(true);
  });

  it('treats an empty box as not valid unless empty is allowed', () => {
    const onValidity = vi.fn();
    renderPage(<Harness onValidity={onValidity} initial="" />);
    expect(onValidity).toHaveBeenLastCalledWith(false);
    renderPage(<JsonField value="" allowEmpty onValidityChange={onValidity} />);
    expect(onValidity).toHaveBeenLastCalledWith(true);
  });

  it('accepts JSON with text in many scripts', () => {
    const onValidity = vi.fn();
    renderPage(
      <Harness
        onValidity={onValidity}
        initial={JSON.stringify({
          th: 'สวัสดี',
          ar: 'مرحبا',
          vi: 'Xin chào',
          es: '¿Cómo estás?',
          zh: '你好',
          e: '😀',
        })}
      />,
    );
    expect(onValidity).toHaveBeenLastCalledWith(true);
  });

  it('lets the form go on when the box is removed while its text is not valid', () => {
    const onValidity = vi.fn();
    const { unmount } = renderPage(<Harness onValidity={onValidity} initial="{" />);
    expect(onValidity).toHaveBeenLastCalledWith(false);
    unmount();
    expect(onValidity).toHaveBeenLastCalledWith(true);
  });

  it('reports a change of validity once, also when the parent passes a new callback on every render', () => {
    const reports: boolean[] = [];
    renderPage(<InlineHarness reports={reports} />);
    expect(reports).toEqual([true]);
    fireEvent.click(screen.getByRole('button', { name: 'render again' }));
    fireEvent.click(screen.getByRole('button', { name: 'render again' }));
    expect(reports).toEqual([true]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{' } });
    expect(reports).toEqual([true, false]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } });
    expect(reports).toEqual([true, false, true]);
  });

  it('counts the 29 spaces of the contract as empty, and a byte order mark as text', () => {
    const onValidity = vi.fn();
    const { unmount } = renderPage(
      <JsonField
        value={`\u0085 ${String.fromCharCode(0x3000)}`}
        allowEmpty
        onValidityChange={onValidity}
      />,
    );
    expect(onValidity).toHaveBeenLastCalledWith(true);
    unmount();
    renderPage(
      <JsonField value={String.fromCharCode(0xfeff)} allowEmpty onValidityChange={onValidity} />,
    );
    expect(onValidity).toHaveBeenLastCalledWith(false);
  });
});
