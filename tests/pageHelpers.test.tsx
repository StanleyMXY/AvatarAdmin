import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Modal, Select } from 'antd';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chooseOption,
  dialogsClosed,
  expandSearch,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  sheetAnswer,
  stubObjectUrls,
  uploadModule,
  uploads,
  writesExceptUploads,
  writesOf,
} from './pageHelpers';

afterEach(() => {
  vi.unstubAllGlobals();
  uploads.length = 0;
});

/** A fetch that answers every call with a JSON success and remembers the calls. */
function fakeFetch() {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), method: (init.method ?? 'GET').toUpperCase() });
      return jsonAnswer(200, '200', { ok: true });
    }),
  );
  return calls;
}

describe('writesOf and writesExceptUploads', () => {
  const calls = [
    { method: 'GET', url: '/api/admin/a' },
    { method: 'POST', url: '/api/admin/a' },
    { method: 'POST', url: '/api/admin/uploads/image' },
    { method: 'DELETE', url: '/api/admin/a/1' },
  ];

  it('keeps the calls that changed something', () => {
    expect(writesOf(calls).map((c) => c.method)).toEqual(['POST', 'POST', 'DELETE']);
  });

  it('also leaves out the uploads of files', () => {
    expect(writesExceptUploads(calls).map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/admin/a',
      'DELETE /api/admin/a/1',
    ]);
  });
});

describe('jsonAnswer and sheetAnswer', () => {
  it('wraps data in the envelope with the code, the status and a message', async () => {
    const ok = jsonAnswer(200, '200', { a: 1 });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ code: '200', message: 'success', data: { a: 1 } });
    const refused = jsonAnswer(409, 'INVALID_STATE');
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({
      code: 'INVALID_STATE',
      message: 'message of INVALID_STATE',
      data: null,
    });
    expect((await jsonAnswer(400, 'X', null, 'own words').json()).message).toBe('own words');
  });

  it('gives the first bytes of a spreadsheet that is saved under the name given', async () => {
    const sheet = sheetAnswer('บันทึก');
    expect(sheet.headers.get('content-disposition')).toBe('attachment; filename="บันทึก.xlsx"');
    expect(sheet.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect([...new Uint8Array(await sheet.arrayBuffer())]).toEqual([80, 75, 3, 4]);
  });
});

describe('holdWrites', () => {
  it('lets reads through and holds every write until it is released', async () => {
    const calls = fakeFetch();
    const held = holdWrites();
    await fetch('/api/admin/a');
    const write = fetch('/api/admin/a', { method: 'POST' });
    await settled();
    expect(held.started()).toBe(1);
    expect(calls.map((c) => c.method)).toEqual(['GET']);
    held.release();
    await write;
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST']);
  });

  it('holds only the writes that it is told to hold', async () => {
    const calls = fakeFetch();
    const held = holdWrites((init) => init.method === 'DELETE');
    await fetch('/api/admin/a', { method: 'POST' });
    expect(calls.map((c) => c.method)).toEqual(['POST']);
    expect(held.started()).toBe(0);
    const removal = fetch('/api/admin/a/1', { method: 'DELETE' });
    await settled();
    expect(held.started()).toBe(1);
    expect(calls).toHaveLength(1);
    held.release();
    await removal;
    expect(calls).toHaveLength(2);
  });
});

describe('overrideFetch', () => {
  it('answers the calls it takes, lists them with their body, and leaves the others to the old fetch', async () => {
    const calls = fakeFetch();
    const taken = overrideFetch(({ url, method }) =>
      url.pathname === '/api/admin/special' && method === 'POST'
        ? jsonAnswer(409, 'INVALID_STATE')
        : undefined,
    );
    const special = await fetch('/api/admin/special?x=1', {
      method: 'POST',
      body: JSON.stringify({ n: 1 }),
    });
    expect(special.status).toBe(409);
    await fetch('/api/admin/other');
    expect(taken).toEqual([{ url: '/api/admin/special?x=1', method: 'POST', body: { n: 1 } }]);
    expect(calls.map((c) => c.url)).toEqual(['/api/admin/other']);
  });
});

describe('uploadModule', () => {
  it('lists the upload and posts to the address it was given', async () => {
    const calls = fakeFetch();
    const file = new File(['abc'], 'รูป.png', { type: 'image/png' });
    await uploadModule.uploadFile({ url: '/api/admin/uploads/image', file });
    expect(uploads).toEqual([{ url: '/api/admin/uploads/image', name: 'รูป.png', size: 3 }]);
    expect(calls).toEqual([{ url: '/api/admin/uploads/image', method: 'POST' }]);
  });
});

describe('stubObjectUrls', () => {
  it('makes an address for a chosen picture and forgets it again', () => {
    stubObjectUrls();
    expect(URL.createObjectURL(new Blob(['x']))).toBe('blob:preview');
    expect(() => URL.revokeObjectURL('blob:preview')).not.toThrow();
  });
});

describe('settled', () => {
  it('waits long enough for a late request to be sent', async () => {
    const before = Date.now();
    await settled();
    expect(Date.now() - before).toBeGreaterThanOrEqual(50);
  });
});

function Pickers({ onPick }: { onPick: (value: string) => void }) {
  return (
    <Form layout="vertical">
      <Form.Item label="Country" htmlFor="country">
        <Select
          id="country"
          options={[
            { value: 'th', label: 'ประเทศไทย' },
            { value: 'sa', label: 'السعودية' },
          ]}
          onChange={onPick}
        />
      </Form.Item>
    </Form>
  );
}

describe('chooseOption', () => {
  it('opens the select by its label and clicks the option with that text', async () => {
    const picked: string[] = [];
    render(<Pickers onPick={(v) => picked.push(v)} />);
    await chooseOption(userEvent.setup(), 'Country', 'السعودية');
    expect(picked).toEqual(['sa']);
    await chooseOption(userEvent.setup(), /Country/, /ไทย/);
    expect(picked).toEqual(['sa', 'th']);
  });

  it('looks for the select inside the part of the page it is given', async () => {
    const picked: string[] = [];
    render(
      <>
        <div data-testid="elsewhere" />
        <section data-testid="here">
          <Pickers onPick={(v) => picked.push(v)} />
        </section>
      </>,
    );
    await chooseOption(userEvent.setup(), 'Country', 'ประเทศไทย', screen.getByTestId('here'));
    expect(picked).toEqual(['th']);
  });
});

const Two = ({ onPick }: { onPick: (which: string, value: string) => void }) => (
  <>
    {['first', 'second'].map((which) => (
      <section key={which} data-testid={which}>
        <Form layout="vertical">
          <Form.Item label="Country" htmlFor={`country-${which}`}>
            <Select
              id={`country-${which}`}
              options={[{ value: 'sa', label: 'السعودية' }]}
              onChange={(value: string) => onPick(which, value)}
            />
          </Form.Item>
        </Form>
      </section>
    ))}
  </>
);

describe('chooseOption with the same text in two selects', () => {
  it('clicks the option of the dropdown that was opened last, not one that is still in the page from before', async () => {
    const picked: string[] = [];
    render(<Two onPick={(which) => picked.push(which)} />);
    const user = userEvent.setup();
    await chooseOption(user, 'Country', 'السعودية', screen.getByTestId('first'));
    await chooseOption(user, 'Country', 'السعودية', screen.getByTestId('second'));
    expect(picked).toEqual(['first', 'second']);
  });

  it('finds the select only inside the part of the page it is given', async () => {
    const picked: string[] = [];
    render(<Two onPick={(which) => picked.push(which)} />);
    await chooseOption(userEvent.setup(), 'Country', 'السعودية', screen.getByTestId('second'));
    expect(picked).toEqual(['second']);
  });
});

describe('expandSearch', () => {
  it('presses the toggle that says Expand', async () => {
    const onClick = vi.fn();
    render(
      <button type="button" onClick={onClick}>
        Expand
      </button>,
    );
    await expandSearch(userEvent.setup());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('presses the toggle that says it in Chinese', async () => {
    const onClick = vi.fn();
    render(
      <button type="button" onClick={onClick}>
        展开
      </button>,
    );
    await expandSearch(userEvent.setup());
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

function Dialog() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(false)}>
        close
      </button>
      <Modal open={open} title="Hello" footer={null} onCancel={() => setOpen(false)}>
        body
      </Modal>
    </>
  );
}

describe('dialogsClosed', () => {
  it('waits while a dialog is open and resolves once it has started to close', async () => {
    render(<Dialog />);
    await screen.findByRole('dialog');
    await expect(dialogsClosed()).rejects.toThrow('a dialog is still open');
    await userEvent.setup().click(screen.getByRole('button', { name: 'close' }));
    await dialogsClosed();
  });

  it('is satisfied when there is no dialog', async () => {
    await act(async () => {});
    await dialogsClosed();
  });
});
