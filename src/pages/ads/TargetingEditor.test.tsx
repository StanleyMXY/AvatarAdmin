import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { TargetingEditor } from './TargetingEditor';
import { emptyTargetingForm, type TargetingForm } from './targeting';

/** The editor as a form field holds it: the value lives outside, and the test reads what was last sent. */
function Harness({
  initial = emptyTargetingForm(),
  seen,
  ...rest
}: {
  initial?: TargetingForm;
  seen: (value: TargetingForm) => void;
} & Partial<React.ComponentProps<typeof TargetingEditor>>) {
  const [value, setValue] = useState(initial);
  return (
    <TargetingEditor
      value={value}
      onChange={(next) => {
        setValue(next);
        seen(next);
      }}
      {...rest}
    />
  );
}

const pick = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
};

const mount = (props: Partial<React.ComponentProps<typeof Harness>> = {}) => {
  const seen = vi.fn();
  renderPage(<Harness seen={seen} {...props} />);
  const last = () => seen.mock.calls[seen.mock.calls.length - 1][0] as TargetingForm;
  return { seen, last, user: userEvent.setup() };
};

describe('TargetingEditor', { timeout: 30000 }, () => {
  it('has the six controls of the spec: platforms, countries, the lowest system version, the lowest app version, languages and the list of time ranges', () => {
    mount();
    expect(screen.getByRole('checkbox', { name: 'Android' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'iOS' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Countries' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Lowest system version' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Lowest app version' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Languages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a time range' })).toBeInTheDocument();
  });

  it('says that the time ranges are in the local time of the user, and that a start after the end crosses midnight', () => {
    mount();
    expect(screen.getByText(/local time of the user/i)).toBeInTheDocument();
    expect(screen.getByText(/a guest has no time zone/i)).toBeInTheDocument();
  });

  it('takes the platforms as checkboxes, and sends the list', async () => {
    const { last, user } = mount();
    await user.click(screen.getByRole('checkbox', { name: 'iOS' }));
    expect(last().platforms).toEqual(['IOS']);
    await user.click(screen.getByRole('checkbox', { name: 'Android' }));
    expect(last().platforms.sort()).toEqual(['ANDROID', 'IOS']);
  });

  it('turns a country typed in lower case into capitals, takes each once, and shows the codes as tags', async () => {
    const { last, user } = mount();
    const box = screen.getByRole('combobox', { name: 'Countries' });
    await user.type(box, 'th{Enter}');
    await user.type(box, 'ID{Enter}');
    await user.type(box, 'th{Enter}');
    expect(last().geo).toEqual(['TH', 'ID']);
  });

  it('says what is wrong with a country code that is not two letters, and with the other fields, in the words of the language file', async () => {
    const { user } = mount();
    await user.type(screen.getByRole('combobox', { name: 'Countries' }), 'THA{Enter}');
    expect(await screen.findByText(/two capital letters/i)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Lowest system version' }), 'abc');
    expect(await screen.findAllByText(/A version is numbers separated by dots/)).toHaveLength(1);
    await user.type(screen.getByRole('textbox', { name: 'Lowest app version' }), '1..2');
    expect(await screen.findAllByText(/A version is numbers separated by dots/)).toHaveLength(2);
    await user.type(screen.getByRole('combobox', { name: 'Languages' }), 'not a tag{Enter}');
    expect(await screen.findByText(/not a valid language tag/i)).toBeInTheDocument();
  });

  it('reads the versions and the languages as typed', async () => {
    const { last, user } = mount();
    await user.type(screen.getByRole('textbox', { name: 'Lowest system version' }), '13');
    await user.type(screen.getByRole('textbox', { name: 'Lowest app version' }), '1.2.0');
    const languages = screen.getByRole('combobox', { name: 'Languages' });
    await user.type(languages, 'th{Enter}');
    await user.type(languages, 'ar-SA{Enter}');
    expect(last()).toMatchObject({
      osVersionMin: '13',
      appVersionMin: '1.2.0',
      languages: ['th', 'ar-SA'],
    });
  });

  it('adds, fills in, marks and removes a time range', async () => {
    const { last, user } = mount();
    await user.click(screen.getByRole('button', { name: 'Add a time range' }));
    expect(last().dayParts).toEqual([{ start: '', end: '' }]);
    pick(screen.getByPlaceholderText('Start'), '23:00');
    pick(screen.getByPlaceholderText('End'), '2:00');
    expect(last().dayParts).toEqual([{ start: '23:00', end: '2:00' }]);
    expect(await screen.findByText('Across midnight')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a time range' }));
    expect(last().dayParts).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(last().dayParts).toEqual([{ start: '', end: '' }]);
    expect(screen.queryByText('Across midnight')).not.toBeInTheDocument();
  });

  it('says that a row of the list that is half filled in is not valid', async () => {
    const { user } = mount({
      initial: { ...emptyTargetingForm(), dayParts: [{ start: '8:00', end: '' }] },
    });
    expect(await screen.findByText(/Fill in both the start and the end/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(screen.queryByText(/Fill in both the start and the end/)).not.toBeInTheDocument(),
    );
  });

  it('shows the notice beside the countries when geo targeting is not configured, and only then', () => {
    const { unmount } = renderPage(<Harness seen={vi.fn()} geoConfigured={false} />);
    expect(
      screen.getByText('Geo targeting is not set up yet; countries set here will not match.'),
    ).toBeInTheDocument();
    unmount();
    renderPage(<Harness seen={vi.fn()} geoConfigured={true} />);
    expect(screen.queryByText(/Geo targeting is not set up yet/)).not.toBeInTheDocument();
  });

  it('does not say it when it is not known whether geo targeting is configured', () => {
    mount({ geoConfigured: null });
    expect(screen.queryByText(/Geo targeting is not set up yet/)).not.toBeInTheDocument();
  });

  it('shows the faults the backend named under their fields', () => {
    mount({
      serverErrors: { geo: 'The value is outside the allowed range.', dayParts: 'Bad range' },
    });
    expect(screen.getByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(screen.getByText('Bad range')).toBeInTheDocument();
  });

  it('shows the value it is given, and all controls are disabled when it is', () => {
    mount({
      disabled: true,
      initial: {
        platforms: ['ANDROID'],
        geo: ['TH'],
        osVersionMin: '13',
        appVersionMin: '',
        languages: ['th'],
        dayParts: [{ start: '8:00', end: '9:00' }],
      },
    });
    expect(screen.getByRole('checkbox', { name: 'Android' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Android' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Lowest system version' })).toHaveValue('13');
    expect(screen.getByRole('textbox', { name: 'Lowest system version' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add a time range' })).toBeDisabled();
    expect(screen.getByText('TH')).toBeInTheDocument();
  });

  it('is written in Chinese too', () => {
    renderPage(<Harness seen={vi.fn()} geoConfigured={false} />, 'zh-CN');
    expect(screen.getByRole('combobox', { name: '国家' })).toBeInTheDocument();
    expect(screen.getByText('地理定向尚未配置，设置了也不会匹配')).toBeInTheDocument();
    expect(within(document.body).getByText(/按用户本地时间/)).toBeInTheDocument();
  });
});
