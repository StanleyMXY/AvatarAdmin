import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saved } from '../../../mock/_core/configStore';
import { pushState } from '../../../mock/_core/pushData';
import pushMock from '../../../mock/push.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { fileOf, pngBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import enUS from '../../locales/en-US';
import TemplatesPage from './templates';
import {
  chooseOption,
  dialogsClosed,
  holdWrites,
  META,
  signIn,
  stubObjectUrls,
  uploads,
  writesOf,
} from './testSetup';

// The upload goes to the mock backend, after the gate (a test holds an upload here to look at the form meanwhile).
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));
vi.mock('../../request/upload', async () => {
  const base = (await import('./testSetup')).uploadModule;
  return {
    uploadFile: async (options: { url: string; file: File }) => {
      if (gate.hold) await gate.hold;
      return base.uploadFile(options);
    },
  };
});

const backend = () => useMockBackend({ default: pushMock });

beforeEach(() => {
  signIn('root');
  stubObjectUrls();
  gate.hold = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const png = (name = 'banner.png') => fileOf(pngBytes(100, 100), name);
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });
const cell = (reason: string, locale: string) => screen.findByTestId(`cell-${reason}-${locale}`);

const rowOf = async (title: string) => {
  const found = await screen.findByText(title);
  return found.closest('tr') as HTMLTableRowElement;
};

/** Chooses a kind in the link control of the open dialog (its first select is the kind). */
const chooseLinkKind = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  text: string,
) => {
  const box = within(within(dialog).getByTestId('link-field'));
  await user.click(box.getAllByRole('combobox')[0]);
  const options = await screen.findAllByText(text, { selector: '.ant-select-item-option-content' });
  await user.click(options[options.length - 1]);
};

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'New template' }));
  return screen.findByRole('dialog');
};

/** A new template for a pair that has none: streak_at_risk in Arabic. */
const fillNew = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  await chooseOption(user, 'Trigger reason', 'Streak at risk', dialog);
  await chooseOption(user, 'Language', 'ar', dialog);
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: ' عنوان جديد ' } });
  fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'نص الرسالة' } });
};

describe('the template page: the matrix of languages', { timeout: 30000 }, () => {
  it('has a row for each recall reason and a column for each supported language, and marks the languages that fall back to the default language as information, not as an error', async () => {
    backend();
    // Daily recall: Arabic is off and Thai is gone, so both fall back; English, the default, is on.
    const daily = (locale: string) =>
      pushState.templates.find((t) => t.triggerReason === 'daily_recall' && t.locale === locale);
    (daily('ar') as { enabled: boolean }).enabled = false;
    pushState.templates = pushState.templates.filter((t) => t !== daily('th'));
    renderPage(<TemplatesPage />);
    const matrix = await screen.findByTestId('coverage-matrix');
    for (const locale of ['en', 'th', 'ar']) {
      expect(within(matrix).getByRole('columnheader', { name: locale })).toBeInTheDocument();
    }
    expect(within(matrix).getByText('Daily recall')).toBeInTheDocument();
    expect(within(matrix).getByText('Streak at risk')).toBeInTheDocument();
    for (const [reason, locale, state] of [
      ['daily_recall', 'en', 'on'],
      ['daily_recall', 'th', 'fallback'],
      ['daily_recall', 'ar', 'off'],
    ] as const) {
      expect((await cell(reason, locale)).getAttribute('data-state'), `${reason} ${locale}`).toBe(
        state,
      );
    }
    const fallback = await cell('daily_recall', 'th');
    const tag = within(fallback).getByText('Uses default language').closest('.ant-tag');
    expect(tag?.className).not.toMatch(/error|warning/);
    expect(tag?.className).toMatch(/processing|blue/);
    // A template that is off is off, and the backend lists its language as one that falls back too.
    expect((await cell('daily_recall', 'ar')).getAttribute('data-fallback')).toBe('true');
    expect(
      within(await cell('daily_recall', 'ar')).getByText('Uses default language'),
    ).toBeTruthy();
    expect((await cell('daily_recall', 'en')).getAttribute('data-fallback')).toBe('false');
    expect(within(matrix).queryByText('Missing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-none-daily_recall')).not.toBeInTheDocument();
    // Not for the reasons that have no template of their own.
    expect(within(matrix).queryByText('Sent by an administrator')).not.toBeInTheDocument();
  });

  it('marks a reason with no enabled template as such on the whole row, and writes "falls back" in none of its cells, the default language cell least of all', async () => {
    backend();
    renderPage(<TemplatesPage />);
    // The sample data: streak at risk has only templates that are off, so the backend lists every language for it.
    expect(await screen.findByTestId('row-none-streak_at_risk')).toHaveTextContent(
      'No enabled template',
    );
    expect(screen.queryByTestId('row-none-daily_recall')).not.toBeInTheDocument();
    for (const [locale, state] of [
      ['en', 'none'],
      ['th', 'off'],
      ['ar', 'none'],
    ] as const) {
      const one = await cell('streak_at_risk', locale);
      expect(one.getAttribute('data-state'), locale).toBe(state);
      expect(one.getAttribute('data-fallback'), locale).toBe('false');
    }
    expect(
      within(await cell('streak_at_risk', 'en')).queryByText('Uses default language'),
    ).toBeNull();
  });

  it('takes the row mark away as soon as the reason has one enabled template, and then the other languages fall back', async () => {
    backend();
    const th = pushState.templates.find(
      (t) => t.triggerReason === 'streak_at_risk' && t.locale === 'th',
    );
    (th as { enabled: boolean }).enabled = true;
    renderPage(<TemplatesPage />);
    expect((await cell('streak_at_risk', 'th')).getAttribute('data-state')).toBe('on');
    expect(screen.queryByTestId('row-none-streak_at_risk')).not.toBeInTheDocument();
    expect((await cell('streak_at_risk', 'en')).getAttribute('data-state')).toBe('fallback');
    expect((await cell('streak_at_risk', 'ar')).getAttribute('data-state')).toBe('fallback');
  });

  it('says in the note that a language without an enabled template falls back to the default one, and that the default language is the only one required', async () => {
    backend();
    renderPage(<TemplatesPage />);
    expect(await screen.findByText(/falls back to the default language/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/only when it has a template in every supported language/),
    ).not.toBeInTheDocument();
  });

  it('writes how to work with the rule at the top: the first template in the default language, the other languages in any order, the default language last, push.default_locale only after the new language is enabled', async () => {
    backend();
    renderPage(<TemplatesPage />);
    const howTo = await screen.findByTestId('push-howto');
    for (const part of [
      'the first template of a reason that you switch on must be in the default language',
      'in any order',
      'switch off the other languages first and the default language last',
      'Before you change push.default_locale, enable the template of the new language',
      'Adding a language to app.supported_locales needs no change here',
    ]) {
      expect(howTo.textContent, part).toContain(part);
    }
  });

  it('shows a language that is supported but has no template at all as falling back, the way the backend lists it', async () => {
    signIn('root', { meta: { ...META, supportedLocales: ['en', 'fr'] } });
    backend();
    renderPage(<TemplatesPage />);
    expect((await cell('daily_recall', 'fr')).getAttribute('data-state')).toBe('fallback');
    // Streak at risk has no enabled template in any supported language: the row says so instead.
    expect((await cell('streak_at_risk', 'fr')).getAttribute('data-state')).toBe('none');
    expect(await screen.findByTestId('row-none-streak_at_risk')).toBeInTheDocument();
  });

  it('does not decide for itself: a cell without a template that the backend does not list as falling back is neutral, and so is every cell when the backend sent no list', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', { items: [], total: 0, missingLocales: { daily_recall: [] } }),
      ),
    );
    renderPage(<TemplatesPage />);
    expect((await cell('daily_recall', 'en')).getAttribute('data-state')).toBe('none');
    expect((await cell('streak_at_risk', 'en')).getAttribute('data-state')).toBe('none');
    expect(screen.queryByText('Uses default language')).not.toBeInTheDocument();
    expect(screen.getAllByText('No template').length).toBeGreaterThan(0);
  });

  it.each([
    ['is missing', { ...META, supportedLocales: undefined }],
    ['is null', { ...META, supportedLocales: null }],
    ['is empty', { ...META, supportedLocales: [] }],
    ['is not a list', { ...META, supportedLocales: 'en' }],
  ])(
    'draws no matrix when the list of supported languages %s, and still lists the templates',
    async (_name, meta) => {
      signIn('root', { meta });
      backend();
      renderPage(<TemplatesPage />);
      expect(await rowOf('Hello, how are you today?')).toBeTruthy();
      expect(screen.queryByTestId('coverage-matrix')).not.toBeInTheDocument();
      expect(
        screen.getByText(
          /supported languages could not be read, so the completeness matrix is not shown/,
        ),
      ).toBeInTheDocument();
    },
  );

  it('updates the matrix when a template is added', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    expect((await cell('streak_at_risk', 'ar')).getAttribute('data-state')).toBe('none');
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(async () =>
      expect((await cell('streak_at_risk', 'ar')).getAttribute('data-state')).toBe('off'),
    );
  });
});

describe('the template page: the list', { timeout: 30000 }, () => {
  it('lists the templates of every language, Thai, Arabic, Vietnamese, Spanish, Indonesian, Chinese and English', async () => {
    backend();
    renderPage(<TemplatesPage />);
    for (const text of [
      'Hello, how are you today?',
      '你好，今天过得怎么样？',
      'สวัสดีครับ วันนี้อากาศดีมาก',
      'مرحبا بك في التطبيق',
      'Halo, apa kabar hari ini?',
      'Xin chào, hôm nay bạn thế nào?',
    ]) {
      expect(await screen.findByText(text), text).toBeInTheDocument();
    }
  });

  it('holds a title of 300 letters without a space, as a button with the whole text in a popover', async () => {
    backend();
    renderPage(<TemplatesPage />);
    const long = await screen.findByText(/^A{300}$/);
    expect(long.closest('button')).not.toBeNull();
  });

  it('shows the link kind and target, and a dash for a template with no picture', async () => {
    backend();
    renderPage(<TemplatesPage />);
    const en = await rowOf('Hello, how are you today?');
    expect(within(en).getByText('App screen: Conversation')).toBeInTheDocument();
    const id = await rowOf('Halo, apa kabar hari ini?');
    expect(
      within(id).getByText('Web address: https://example.com/welcome-back'),
    ).toBeInTheDocument();
    expect(en.querySelector('img')).toBeNull();
    const zh = await rowOf('你好，今天过得怎么样？');
    expect(zh.querySelector('img')?.getAttribute('src')).toContain('push-recall.svg');
  });

  it('does not fall over when the backend sends a number, a list or nothing where it promised text', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: '1',
              triggerReason: 7,
              locale: { x: 1 },
              title: { en: 'object title' },
              body: null,
              linkType: 'SCREEN',
              linkTarget: 42,
              imageUrl: 5,
              enabled: true,
            },
            {
              id: '2',
              triggerReason: 'daily_recall',
              locale: 'en',
              title: 'Plain title',
              body: 'plain body',
              linkType: 'NONE',
              linkTarget: null,
              imageUrl: null,
              enabled: false,
            },
          ],
          total: 2,
        }),
      ),
    );
    renderPage(<TemplatesPage />);
    expect(await screen.findByText('Plain title')).toBeInTheDocument();
    expect(screen.getByText(/object title/)).toBeInTheDocument();
  });

  it('pages with the sizes of every table: page 1, 20 rows', async () => {
    const calls = backend();
    renderPage(<TemplatesPage />);
    await rowOf('Hello, how are you today?');
    expect(
      calls.some((c) => c.url.startsWith('/api/admin/push/templates?page=1&pageSize=20')),
    ).toBe(true);
    // the matrix reads every template in pages of 200
    expect(
      calls.some((c) => c.url.startsWith('/api/admin/push/templates?page=1&pageSize=200')),
    ).toBe(true);
  });
});

describe('the template page: an answer without total', { timeout: 60000 }, () => {
  const grow = (count: number) => {
    const base = pushState.templates.find((t) => t.triggerReason === 'streak_at_risk');
    if (!base) throw new Error('no sample');
    for (let n = 0; n < count; n += 1) {
      pushState.templates.push({ ...base, id: `x${n}`, locale: `x${String(n).padStart(2, '0')}` });
    }
  };

  it('pages the table by what was read, and reads no more than it needs, when the backend pages but sends no total', async () => {
    pushState.templateList = 'paged-without-total';
    grow(34);
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    await rowOf('Hello, how are you today?');
    expect(await screen.findByText(/1-20\D+45/)).toBeInTheDocument();
    await user.click(screen.getByTitle('2'));
    await waitFor(() => expect(screen.getAllByText(/21-40\D+45/).length).toBeGreaterThan(0));
    const reads = calls.filter((c) => c.url.startsWith('/api/admin/push/templates?'));
    expect(reads.length).toBeLessThanOrEqual(8);
    expect(await cell('streak_at_risk', 'th')).toBeInTheDocument();
  });

  it('does not loop and shows every template when the backend does not page at all', async () => {
    pushState.templateList = 'unpaged-without-total';
    grow(34);
    const calls = backend();
    renderPage(<TemplatesPage />);
    await rowOf('Hello, how are you today?');
    expect(await screen.findByText(/1-20\D+45/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 300));
    const reads = calls.filter((c) => c.url.startsWith('/api/admin/push/templates?'));
    expect(reads.length).toBeLessThanOrEqual(6);
  });
});

describe('the template page: new template', { timeout: 60000 }, () => {
  it('uploads the picture first, then sends its uploadId and no address, with the words trimmed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe('/uploads/image');
    await within(dialog).findByText(/Uploaded: banner\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const posted = writesOf(calls)[0];
    expect(posted).toMatchObject({ method: 'POST', url: '/api/admin/push/templates' });
    expect(posted.body).toMatchObject({
      triggerReason: 'streak_at_risk',
      locale: 'ar',
      title: 'عنوان جديد',
      body: 'نص الرسالة',
      linkType: 'NONE',
      linkTarget: '',
      enabled: false,
    });
    expect(String((posted.body as { uploadId: string }).uploadId)).toMatch(/^up-img-/);
    expect(Object.keys(posted.body as object)).not.toContain('imageUploadId');
    expect(JSON.stringify(posted.body)).not.toMatch(/imageUrl|mock-files|http/);
    await dialogsClosed();
    // the new row is in the list (a button with the whole text in a popover), next to the field of the closing dialog
    await waitFor(() =>
      expect(screen.getAllByText('نص الرسالة').some((el) => el.closest('button') !== null)).toBe(
        true,
      ),
    );
  });

  it('sends no picture field at all when no picture was chosen', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('uploadId');
  });

  it('sends one request when the form is submitted again while the first request is still on its way', async () => {
    const calls = backend();
    const slow = holdWrites();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    const form = dialog.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(slow.started()).toBe(1));
    fireEvent.submit(form);
    fireEvent.submit(form);
    await new Promise((r) => setTimeout(r, 150));
    expect(slow.started()).toBe(1);
    slow.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('sends one request when Submit is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('asks for the words and the language before sending anything', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a title')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter the body')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter the language tag')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('does not send a second template for a reason and language that has one, and says to edit it', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    await cell('daily_recall', 'en');
    const dialog = await openNew(user);
    await chooseOption(user, 'Trigger reason', 'Daily recall', dialog);
    await chooseOption(user, 'Language', 'en', dialog);
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'again' } });
    fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'again' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(/exists already. Edit that one instead/),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('shows only the translated text when the backend refuses with a known code, not the backend words', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    await cell('daily_recall', 'en');
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    // Another administrator made the same template meanwhile.
    pushState.templates.push({
      id: '900',
      triggerReason: 'streak_at_risk',
      locale: 'ar',
      title: 'x',
      body: 'y',
      linkType: 'NONE',
      linkTarget: null,
      imageFile: null,
      enabled: false,
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('An item with the same unique value already exists.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/The template exists already/)).not.toBeInTheDocument();
    // stays open, nothing lost
    expect(within(dialog).getByLabelText('Title')).toHaveValue(' عنوان جديد ');
  });
});

describe('the template page: the picture', { timeout: 60000 }, () => {
  const openForm = async () => {
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    return { user, dialog };
  };

  it('has no native file box beside the button: the file input of the shared control is hidden by its own style', async () => {
    backend();
    const { dialog } = await openForm();
    const input = within(dialog).getByTestId('upload-input') as HTMLInputElement;
    expect(input.style.display).toBe('none');
  });

  it('takes JPEG and PNG only and says so beside the control; a GIF is stopped before any upload', async () => {
    backend();
    const { dialog } = await openForm();
    expect(within(dialog).getByText(/Accepted: JPEG \/ PNG/)).toBeInTheDocument();
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0]);
    choose(fileOf(gif, 'anim.png'));
    expect(await within(dialog).findByText(/Wrong file type/)).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('sends no picture when a picture was uploaded and then replaced by a file that was refused: the id of the first one is not carried along', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    choose(png());
    await within(dialog).findByText(/Uploaded: banner\.png/);
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0]);
    choose(fileOf(gif, 'anim.png'));
    expect(await within(dialog).findByText(/Wrong file type/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('uploadId');
  });

  it('shows the size limit from meta and stops a larger file before any upload', async () => {
    signIn('root', { meta: { ...META, pushImageMaxBytes: 100 } });
    backend();
    const { dialog } = await openForm();
    expect(within(dialog).getByText(/Max 100 B/)).toBeInTheDocument();
    choose(fileOf(pngBytes(10, 10), 'big.png', 5000));
    expect(
      await within(dialog).findByText(/The file is too large: limit 100 B/),
    ).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('does not check the size when meta has no limit, and lets the upload go to the backend', async () => {
    signIn('root', { meta: { ...META, pushImageMaxBytes: null } });
    backend();
    const { dialog } = await openForm();
    expect(within(dialog).queryByText(/Max /)).not.toBeInTheDocument();
    choose(fileOf(pngBytes(10, 10), 'big.png', 6 * 1024 * 1024));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/Uploaded: big\.png/);
  });

  it('keeps Submit disabled while a picture is uploading, and enables it afterwards', async () => {
    backend();
    let release: () => void = () => {};
    gate.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { user, dialog } = await openForm();
    await fillNew(user, dialog);
    choose(png());
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    await waitFor(() => expect(submit).toBeDisabled());
    release();
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it('asks for the picture again when the backend refuses its upload id, and sends nothing until it is uploaded again', async () => {
    const calls = backend();
    const { user, dialog } = await openForm();
    await fillNew(user, dialog);
    choose(png());
    await within(dialog).findByText(/Uploaded: banner\.png/);
    // The upload is used by another object meanwhile.
    for (const upload of pushState.uploads.values()) upload.used = true;
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(
        'The backend did not accept the uploaded picture. Upload it again.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/Uploaded: banner\.png/)).not.toBeInTheDocument();
    const before = writesOf(calls).length;
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(writesOf(calls)).toHaveLength(before);
    choose(png('second.png'));
    await within(dialog).findByText(/Uploaded: second\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(before + 1));
  });
});

describe('the template page: the link', { timeout: 60000 }, () => {
  it('offers no link, an app screen of the shared list of nine, and a web address', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    const box = within(within(dialog).getByTestId('link-field'));
    await user.click(box.getAllByRole('combobox')[0]);
    for (const kind of ['No link', 'App screen', 'Web address']) {
      expect(
        (await screen.findAllByText(kind, { selector: '.ant-select-item-option-content' })).length,
        kind,
      ).toBeGreaterThan(0);
    }
    const chosen = await screen.findAllByText('App screen', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(chosen[chosen.length - 1]);
    await user.click(box.getAllByRole('combobox')[1]);
    for (const screenName of [
      'Conversation',
      'Companion profile',
      'Store',
      'Credits',
      'Settings',
      'Message list',
      'Subscription',
      'Check-in',
      'Daily tasks',
    ]) {
      expect(
        (await screen.findAllByText(screenName, { selector: '.ant-select-item-option-content' }))
          .length,
        screenName,
      ).toBeGreaterThan(0);
    }
  });

  it('sends the chosen screen', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    await chooseLinkKind(user, dialog, 'App screen');
    const box = within(within(dialog).getByTestId('link-field'));
    await user.click(box.getAllByRole('combobox')[1]);
    const options = await screen.findAllByText('Credits', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ linkType: 'SCREEN', linkTarget: 'credits' });
  });

  it('wants a screen once the kind is app screen, and sends nothing without it', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    await chooseLinkKind(user, dialog, 'App screen');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(dialog.querySelector('.ant-form-item-explain-error')?.textContent).toBe(
        'Choose a screen',
      ),
    );
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('checks a web address with the link rule: https only, at most 2048 characters in all', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await fillNew(user, dialog);
    await chooseLinkKind(user, dialog, 'Web address');
    const box = within(within(dialog).getByTestId('link-field'));
    const input = box.getByPlaceholderText('https://…');
    fireEvent.change(input, { target: { value: 'http://example.com/a' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    // said once, not twice: the link control shows the reason and the form does not repeat it
    expect(
      await within(dialog).findByText('The link must start with lowercase https://.'),
    ).toBeInTheDocument();
    fireEvent.change(input, { target: { value: `https://example.com/${'a'.repeat(2030)}` } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('The value is too long.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    fireEvent.change(input, { target: { value: `https://example.com/${'a'.repeat(2028)}` } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ linkType: 'URL' });
  });
});

describe('the template page: the rule of the default language', { timeout: 60000 }, () => {
  const RULE_EN =
    /Streak at risk needs an enabled template in the default language \(en\)\. Enable that one first\. To switch it off, delete it or change it, first switch off the other languages of Streak at risk\. If it is the only enabled template, keep it in en and enabled, and create the other language as a new template\./;
  const streakTh = () =>
    pushState.templates.find((t) => t.locale === 'th' && t.triggerReason === 'streak_at_risk');

  it('does not warn beforehand in the dialog: it sends the request, and the backend decides, in the words of the code with the default language and the reason of its answer', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const row = await rowOf('ขอบคุณสำหรับความช่วยเหลือของคุณ');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('switch', { name: 'Switch on' }));
    expect(within(dialog).queryByText(/will refuse|has no template in/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', body: { enabled: true } });
    // The backend refused: the dialog stays open and says what to do, without the backend's own sentence.
    expect(await within(dialog).findByText(RULE_EN)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('enable or restore it first');
    expect(document.body.textContent).not.toContain('Some input is not valid');
    expect(streakTh()?.enabled).toBe(false);
  });

  it('lets the default language be switched on first and any other language after it, in the dialog', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const dialog = await openNew(user);
    await chooseOption(user, 'Trigger reason', 'Streak at risk', dialog);
    await chooseOption(user, 'Language', 'en', dialog);
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Keep it up' } });
    fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'Come back' } });
    await user.click(within(dialog).getByRole('switch', { name: 'Switch on' }));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    await dialogsClosed();
    expect((await cell('streak_at_risk', 'en')).getAttribute('data-state')).toBe('on');
    // Thai may be switched on now.
    fireEvent.click(within(await rowOf('ขอบคุณสำหรับความช่วยเหลือของคุณ')).getByRole('switch'));
    await waitFor(() => expect(streakTh()?.enabled).toBe(true));
    await waitFor(async () =>
      expect((await cell('streak_at_risk', 'th')).getAttribute('data-state')).toBe('on'),
    );
  });

  it('the switch in the list sends one PUT with the words as they are, says why in the words of the code when the backend refuses, and shows what the backend holds', async () => {
    const calls = backend();
    renderPage(<TemplatesPage />);
    const row = await rowOf('ขอบคุณสำหรับความช่วยเหลือของคุณ');
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      body: {
        title: 'ขอบคุณสำหรับความช่วยเหลือของคุณ',
        linkType: 'NONE',
        linkTarget: '',
        enabled: true,
      },
    });
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('uploadId');
    expect(await screen.findByText(RULE_EN)).toBeInTheDocument();
    // refused: the switch is back off
    await waitFor(async () =>
      expect(
        within(await rowOf('ขอบคุณสำหรับความช่วยเหลือของคุณ'))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('false'),
    );
  });

  it('says in the list which reason the backend named when it refuses a switch for another cause than the rule of the default language', async () => {
    backend();
    const real = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) =>
        (init.method ?? 'GET').toUpperCase() === 'PUT'
          ? jsonResponse(
              400,
              envelope(
                'INVALID_REQUEST',
                {
                  details: [
                    { ref: 'enabled', reason: 'OUT_OF_RANGE' },
                    { ref: 'x', reason: 'NEW' },
                  ],
                },
                'raw backend words',
              ),
            )
          : real(input, init),
      ),
    );
    renderPage(<TemplatesPage />);
    const row = await rowOf('ขอบคุณสำหรับความช่วยเหลือของคุณ');
    fireEvent.click(within(row).getByRole('switch'));
    const shown = await screen.findByText(/The value is outside the allowed range\./);
    expect(shown.textContent).toContain(enUS['error.INVALID_REQUEST']);
    expect(document.body.textContent).not.toContain('raw backend words');
  });

  it('refuses in the list to switch off or delete the default language template while another language is on, and keeps the row on', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const row = await rowOf('Hello, how are you today?');
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      await screen.findByText(
        /Daily recall needs an enabled template in the default language \(en\)/,
      ),
    ).toBeInTheDocument();
    await user.click(
      within(await rowOf('Hello, how are you today?')).getByRole('button', { name: 'Delete' }),
    );
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].method).toBe('DELETE');
    // one message for the switch and one for the delete
    await waitFor(() =>
      expect(
        screen.getAllByText(
          /Daily recall needs an enabled template in the default language \(en\)/,
        ),
      ).toHaveLength(2),
    );
    expect(
      pushState.templates.some((t) => t.locale === 'en' && t.triggerReason === 'daily_recall'),
    ).toBe(true);
    expect(
      (await rowOf('Hello, how are you today?')).querySelector('[role="switch"]'),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the same text in Chinese with the default language and the reason of the answer', async () => {
    backend();
    renderPage(<TemplatesPage />, 'zh-CN');
    fireEvent.click(within(await rowOf('Hello, how are you today?')).getByRole('switch'));
    expect(
      await screen.findByText(
        '触发原因“每日召回”需要默认语言 en 的启用模板。先启用默认语言的模板；要停用、删除或改掉它，先停用“每日召回”下其他语言的模板；它是唯一启用的模板时，保持它为 en 并启用，另建其他语言的新模板。',
      ),
    ).toBeInTheDocument();
  });

  it('names the default language the backend names, whatever it is', async () => {
    saved.set('push.default_locale', {
      value: 'th',
      updatedAt: '2026-10-26T10:00:00Z',
      updatedBy: '1',
      updatedByUsername: 'root',
    });
    const calls = backend();
    renderPage(<TemplatesPage />);
    // Thai is the default language now: its template of daily recall cannot go while the others are on.
    fireEvent.click(within(await rowOf('สวัสดีครับ วันนี้อากาศดีมาก')).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      await screen.findByText(
        /Daily recall needs an enabled template in the default language \(th\)/,
      ),
    ).toBeInTheDocument();
  });

  it('says the words of the code for a refusal that has no default language to name, and never the message of the backend', async () => {
    stubFetch((call) =>
      call.url.includes('/push/templates') && call.init.method === 'PUT'
        ? jsonResponse(400, envelope('INVALID_REQUEST', { some: 'thing' }, 'SECRET BACKEND WORDS'))
        : jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  id: '1',
                  triggerReason: 'daily_recall',
                  locale: 'en',
                  title: 'Plain title',
                  body: 'plain body',
                  linkType: 'NONE',
                  linkTarget: null,
                  imageUrl: null,
                  enabled: true,
                },
              ],
              total: 1,
              missingLocales: { daily_recall: [], streak_at_risk: ['en'] },
            }),
          ),
    );
    renderPage(<TemplatesPage />);
    fireEvent.click(within(await rowOf('Plain title')).getByRole('switch'));
    expect(
      await screen.findByText(/Some input is not valid\. Please check the fields and try again\./),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('turns a template off with one PUT', async () => {
    const calls = backend();
    renderPage(<TemplatesPage />);
    const row = await rowOf('Hello, how are you today?');
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ enabled: false });
    await waitFor(async () =>
      expect(
        within(await rowOf('Hello, how are you today?'))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('false'),
    );
  });

  it('sends one request when the switch is pressed twice at once', async () => {
    const calls = backend();
    renderPage(<TemplatesPage />);
    const sw = within(await rowOf('Hello, how are you today?')).getByRole('switch');
    fireEvent.click(sw);
    fireEvent.click(sw);
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writesOf(calls)).toHaveLength(1);
  });
});

describe('the template page: edit and delete', { timeout: 60000 }, () => {
  it('fills the dialog with the template, keeps the reason and the language fixed, and sends a PUT by id without them', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const row = await rowOf('Xin chào, hôm nay bạn thế nào?');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Xin chào, hôm nay bạn thế nào?');
    expect(within(dialog).getByRole('combobox', { name: 'Trigger reason' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Language' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Tiêu đề mới' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const put = writesOf(calls)[0];
    expect(put.method).toBe('PUT');
    expect(put.url).toMatch(/^\/api\/admin\/push\/templates\/\d+$/);
    expect(put.body).toMatchObject({ title: 'Tiêu đề mới', enabled: true });
    expect(Object.keys(put.body as object)).not.toContain('triggerReason');
    expect(Object.keys(put.body as object)).not.toContain('locale');
    expect(await screen.findByText('Tiêu đề mới')).toBeInTheDocument();
  });

  it('asks in the row before it deletes a template of another language, then deletes and reads the list and the matrix again', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    expect((await cell('daily_recall', 'ar')).getAttribute('data-state')).toBe('on');
    const row = await rowOf('مرحبا بك في التطبيق');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].method).toBe('DELETE');
    await waitFor(() => expect(screen.queryByText('مرحبا بك في التطبيق')).not.toBeInTheDocument());
    await waitFor(async () =>
      expect((await cell('daily_recall', 'ar')).getAttribute('data-state')).toBe('fallback'),
    );
  });

  it('says why when a template is already gone, and reads the list again', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    const row = await rowOf('مرحبا بك في التطبيق');
    pushState.templates = pushState.templates.filter(
      (t) => !(t.locale === 'ar' && t.triggerReason === 'daily_recall'),
    );
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('مرحبا بك في التطبيق')).not.toBeInTheDocument());
  });
});

describe('the template page: permissions', { timeout: 30000 }, () => {
  it('without PUSH:TEMPLATE there is no new, no edit, no delete, and the switch is off', async () => {
    // The page itself needs this code to be reached; the buttons check it again.
    signIn('root');
    setTestAccess(access({ me: { superAdmin: false, permissions: ['PUSH:VIEW'] } }));
    backend();
    renderPage(<TemplatesPage />);
    const row = await rowOf('Hello, how are you today?');
    expect(screen.queryByRole('button', { name: 'New template' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(row).getByRole('switch')).toBeDisabled();
  });
});

describe('the template page: Chinese texts', { timeout: 30000 }, () => {
  it('draws the matrix and the buttons in Chinese', async () => {
    backend();
    renderPage(<TemplatesPage />, 'zh-CN');
    expect(await screen.findByText('各语言的完整性')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新建模板/ })).toBeInTheDocument();
    expect(await screen.findByTestId('row-none-streak_at_risk')).toHaveTextContent(
      '没有启用的模板',
    );
    expect((await cell('streak_at_risk', 'en')).textContent).toBe('没有模板');
  });

  it('writes in Chinese how to work with the rule, and marks a language that falls back', async () => {
    backend();
    pushState.templates = pushState.templates.filter(
      (t) => !(t.triggerReason === 'daily_recall' && t.locale === 'ar'),
    );
    renderPage(<TemplatesPage />, 'zh-CN');
    expect((await cell('daily_recall', 'ar')).textContent).toBe('回退到默认语言');
    const howTo = await screen.findByTestId('push-howto');
    expect(howTo.textContent).toContain('先停其他语言，最后停默认语言');
    expect(howTo.textContent).toContain('push.default_locale');
  });
});
