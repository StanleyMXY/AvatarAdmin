import './testSetup';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { type FeatureValue, featureValueBody } from '../../services/subscriptions';
import { FeatureValueEditor, type FeatureValueEditorProps } from './FeatureValueEditor';
import { FeatureValueText } from './FeatureValueText';

beforeEach(() => resetUmiStub());

type Probe = { current: FeatureValue };

function Harness({
  initial,
  probe,
  ...props
}: { initial: FeatureValue; probe: Probe } & Omit<FeatureValueEditorProps, 'value' | 'onChange'>) {
  const [value, setValue] = useState(initial);
  probe.current = value;
  return <FeatureValueEditor {...props} value={value} onChange={setValue} />;
}

const radio = (name: string) => screen.queryByRole('radio', { name });
const checked = () =>
  screen
    .getAllByRole('radio')
    .filter((r) => (r as HTMLInputElement).checked)
    .map((r) => r.closest('label')?.textContent);

describe('FeatureValueEditor: the three states look different', () => {
  it('shows "Not configured", a value and "No limit" as three different selections', () => {
    const probe: Probe = { current: { mode: 'UNSET' } };
    const { unmount } = renderPage(
      <Harness initial={{ mode: 'UNSET' }} probe={probe} type="LIMIT" allowUnset allowUnlimited />,
    );
    expect(checked()).toEqual(['Not configured']);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    unmount();
    const probe2: Probe = { current: { mode: 'UNLIMITED' } };
    const second = renderPage(
      <Harness
        initial={{ mode: 'UNLIMITED' }}
        probe={probe2}
        type="LIMIT"
        allowUnset
        allowUnlimited
      />,
    );
    expect(checked()).toEqual(['No limit']);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    second.unmount();
    const probe3: Probe = { current: { mode: 'VALUE', value: 0 } };
    renderPage(
      <Harness
        initial={{ mode: 'VALUE', value: 0 }}
        probe={probe3}
        type="LIMIT"
        allowUnset
        allowUnlimited
      />,
    );
    expect(checked()).toEqual(['Value']);
    // 0 is a value ("not allowed"), neither "not configured" nor "no limit"
    expect(screen.getByRole('spinbutton')).toHaveValue('0');
  });

  it('serializes the three states as {mode:UNSET}, {mode:UNLIMITED} and {mode:VALUE,value}', async () => {
    const user = userEvent.setup();
    const probe: Probe = { current: { mode: 'UNSET' } };
    renderPage(
      <Harness initial={{ mode: 'UNSET' }} probe={probe} type="LIMIT" allowUnset allowUnlimited />,
    );
    expect(featureValueBody(probe.current)).toEqual({ mode: 'UNSET' });
    await user.click(screen.getByText('No limit'));
    expect(featureValueBody(probe.current)).toEqual({ mode: 'UNLIMITED' });
    await user.click(screen.getByText('Value'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } });
    expect(featureValueBody(probe.current)).toEqual({ mode: 'VALUE', value: 30 });
    await user.click(screen.getByText('Not configured'));
    expect(featureValueBody(probe.current)).toEqual({ mode: 'UNSET' });
    // the number typed before comes back with "Value"
    await user.click(screen.getByText('Value'));
    expect(screen.getByRole('spinbutton')).toHaveValue('30');
  });

  it('writes a yes/no value with a switch and a text value with a text box', async () => {
    const user = userEvent.setup();
    const bool: Probe = { current: { mode: 'VALUE', value: false } };
    const first = renderPage(
      <Harness
        initial={{ mode: 'VALUE', value: false }}
        probe={bool}
        type="BOOLEAN"
        allowUnset
        allowUnlimited={false}
        label="ads.removed"
      />,
    );
    expect(radio('No limit')).toBeNull();
    await user.click(screen.getByRole('switch'));
    expect(bool.current).toEqual({ mode: 'VALUE', value: true });
    first.unmount();
    const text: Probe = { current: { mode: 'VALUE', value: 'standard' } };
    renderPage(
      <Harness
        initial={{ mode: 'VALUE', value: 'standard' }}
        probe={text}
        type="STRING"
        allowUnset
        allowUnlimited={false}
        label="chat.model_tier"
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'chat.model_tier: Value' }), {
      target: { value: 'พรีเมียม' },
    });
    expect(text.current).toEqual({ mode: 'VALUE', value: 'พรีเมียม' });
  });

  it('keeps an empty number empty (null) until one is typed, so the form can ask for it', async () => {
    const user = userEvent.setup();
    const probe: Probe = { current: { mode: 'UNSET' } };
    renderPage(
      <Harness initial={{ mode: 'UNSET' }} probe={probe} type="LIMIT" allowUnset allowUnlimited />,
    );
    await user.click(screen.getByText('Value'));
    expect(probe.current).toEqual({ mode: 'VALUE', value: null });
  });
});

describe('FeatureValueEditor: the states the caller does not allow', () => {
  it('does not offer "Not configured" unless it is allowed (the default of a switch that is not a quota)', () => {
    const probe: Probe = { current: { mode: 'VALUE', value: 3 } };
    renderPage(
      <Harness
        initial={{ mode: 'VALUE', value: 3 }}
        probe={probe}
        type="LIMIT"
        allowUnset={false}
        allowUnlimited
      />,
    );
    expect(radio('Not configured')).toBeNull();
    expect(radio('Value')).not.toBeNull();
    expect(radio('No limit')).not.toBeNull();
  });

  it('does not offer "No limit" for the period grant (allowUnlimited false)', () => {
    const probe: Probe = { current: { mode: 'VALUE', value: 100 } };
    renderPage(
      <Harness
        initial={{ mode: 'VALUE', value: 100 }}
        probe={probe}
        type="LIMIT"
        allowUnset
        allowUnlimited={false}
      />,
    );
    expect(radio('No limit')).toBeNull();
    expect(radio('Not configured')).not.toBeNull();
  });

  it('still shows a state that is already there even if it is not allowed', () => {
    const probe: Probe = { current: { mode: 'UNSET' } };
    renderPage(
      <Harness
        initial={{ mode: 'UNSET' }}
        probe={probe}
        type="LIMIT"
        allowUnset={false}
        allowUnlimited={false}
      />,
    );
    expect(checked()).toEqual(['Not configured']);
  });

  it('is read-only when disabled', async () => {
    const probe: Probe = { current: { mode: 'VALUE', value: 3 } };
    renderPage(
      <Harness
        initial={{ mode: 'VALUE', value: 3 }}
        probe={probe}
        type="LIMIT"
        allowUnset
        allowUnlimited
        disabled
      />,
    );
    expect(screen.getByRole('spinbutton')).toBeDisabled();
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled();
  });
});

describe('FeatureValueText: reading a value', () => {
  const show = (
    kind: 'BOOLEAN' | 'LIMIT' | 'STRING',
    mode: 'VALUE' | 'UNLIMITED' | 'UNSET',
    value: unknown,
  ) => renderPage(<FeatureValueText kind={kind} mode={mode} value={value} />).container.textContent;

  it('tells a number, "No limit" and "Not configured" apart, and never shows a missing number as 0', () => {
    expect(show('LIMIT', 'VALUE', 600)).toBe('600');
    expect(show('LIMIT', 'VALUE', 0)).toBe('0');
    expect(show('LIMIT', 'UNLIMITED', null)).toBe('No limit');
    expect(show('LIMIT', 'UNSET', null)).toBe('Not configured');
    expect(show('LIMIT', 'VALUE', null)).toBe('—');
  });

  it('shows yes/no and a text of any language', () => {
    expect(show('BOOLEAN', 'VALUE', true)).toBe('On');
    expect(show('BOOLEAN', 'VALUE', false)).toBe('Off');
    expect(show('STRING', 'VALUE', 'بريميوم')).toBe('بريميوم');
  });
});
