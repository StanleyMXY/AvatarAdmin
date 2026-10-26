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
});
