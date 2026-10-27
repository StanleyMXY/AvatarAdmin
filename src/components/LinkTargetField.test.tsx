import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import enUS from '../locales/en-US';
import { SCREEN_TARGETS } from '../utils/screenTargets';
import { LinkTargetField, type LinkTargetValue, linkTargetRule } from './LinkTargetField';

let latest: LinkTargetValue = { linkType: 'NONE', linkTarget: '' };
function Harness({ initial }: { initial?: LinkTargetValue }) {
  const [value, setValue] = useState<LinkTargetValue>(
    initial ?? { linkType: 'NONE', linkTarget: '' },
  );
  latest = value;
  return <LinkTargetField value={value} onChange={setValue} />;
}

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  combo: HTMLElement,
  label: string,
) => {
  await user.click(combo);
  const option = await screen.findByTitle(label);
  await user.click(option);
};

describe('SCREEN_TARGETS', () => {
  it('is the nine screens of contract 8.3 with a text for each in both languages', () => {
    expect(SCREEN_TARGETS).toEqual([
      'conversation',
      'companion',
      'store',
      'credits',
      'settings',
      'notifications',
      'subscription',
      'checkin',
      'daily_tasks',
    ]);
    for (const id of SCREEN_TARGETS) expect(enUS[`pages.link.screen.${id}`]).toBeTruthy();
  });
});

describe('LinkTargetField', () => {
  it('starts with no link and no target box', () => {
    renderPage(<Harness />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(latest).toEqual({ linkType: 'NONE', linkTarget: '' });
  });

  it('offers exactly the shared screens when the type is SCREEN, and stores the id', async () => {
    const user = userEvent.setup();
    renderPage(<Harness initial={{ linkType: 'SCREEN', linkTarget: '' }} />);
    const combos = screen.getAllByRole('combobox');
    await user.click(combos[1]);
    const options = document.querySelectorAll('.ant-select-item-option');
    expect([...options].map((o) => o.getAttribute('title'))).toEqual(
      SCREEN_TARGETS.map((id) => enUS[`pages.link.screen.${id}`]),
    );
    await user.click(await screen.findByTitle('Check-in'));
    expect(latest).toEqual({ linkType: 'SCREEN', linkTarget: 'checkin' });
  });

  it('takes an https link when the type is URL, and says what is wrong with it', () => {
    renderPage(<Harness initial={{ linkType: 'URL', linkTarget: '' }} />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'http://example.com' } });
    expect(latest).toEqual({ linkType: 'URL', linkTarget: 'http://example.com' });
    expect(within(document.body).getByRole('alert')).toHaveTextContent(enUS['reason.NOT_HTTPS']);
    fireEvent.change(box, { target: { value: 'https://example.com/promo' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('empties the target when the type changes', async () => {
    const user = userEvent.setup();
    renderPage(<Harness initial={{ linkType: 'URL', linkTarget: 'https://example.com/a' }} />);
    await choose(user, screen.getAllByRole('combobox')[0], 'App screen');
    expect(latest).toEqual({ linkType: 'SCREEN', linkTarget: '' });
    await choose(user, screen.getAllByRole('combobox')[0], 'No link');
    expect(latest).toEqual({ linkType: 'NONE', linkTarget: '' });
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('linkTargetRule', () => {
  const rule = linkTargetRule({ formatMessage: ({ id }) => enUS[id] });
  const check = (value?: LinkTargetValue) => rule.validator({}, value);

  it('lets NONE through, with or without a value', async () => {
    await expect(check({ linkType: 'NONE', linkTarget: '' })).resolves.toBeUndefined();
    await expect(check(undefined)).resolves.toBeUndefined();
  });

  it('needs a screen of the shared list for SCREEN', async () => {
    await expect(check({ linkType: 'SCREEN', linkTarget: 'store' })).resolves.toBeUndefined();
    await expect(check({ linkType: 'SCREEN', linkTarget: '' })).rejects.toThrow('Choose a screen');
    await expect(check({ linkType: 'SCREEN', linkTarget: 'assets' })).rejects.toThrow(
      'Choose a screen',
    );
  });

  it('needs a link that passes the link rule for URL, with the reason text', async () => {
    await expect(
      check({ linkType: 'URL', linkTarget: 'https://example.com/a' }),
    ).resolves.toBeUndefined();
    await expect(check({ linkType: 'URL', linkTarget: 'http://bad' })).rejects.toThrow(
      enUS['reason.NOT_HTTPS'],
    );
    await expect(check({ linkType: 'URL', linkTarget: '' })).rejects.toThrow(
      enUS['reason.NOT_HTTPS'],
    );
  });

  it('stops a form from being submitted with a bad target', async () => {
    const { Form } = await import('antd');
    let submitted = 0;
    renderPage(
      <Form
        onFinish={() => {
          submitted += 1;
        }}
        initialValues={{ target: { linkType: 'URL', linkTarget: 'http://bad' } }}
      >
        <Form.Item name="target" rules={[rule]}>
          <LinkTargetField />
        </Form.Item>
        <button type="submit">go</button>
      </Form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(submitted).toBe(0);
  });
});
