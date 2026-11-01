import type { ProColumns } from '@ant-design/pro-components';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expectFailureFollowsLanguage,
  renderWithLocaleSwitch,
  SERVER_ERROR,
} from '../../tests/failureLanguage';
import { envelope, flush, stubXhr } from '../../tests/httpStubs';
import { fileOf, pngBytes } from '../../tests/imageBytes';
import { resetUmiStub, setTestInitialState } from '../../tests/stubs/umi-max';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { ApiError } from '../request/errors';
import { resetSessionState, setToken } from '../request/session';
import { PagedListTable } from './PagedListTable';
import { UploadField } from './UploadField';

type Row = { id: string; name: string };
const columns: ProColumns<Row>[] = [{ title: 'Name', dataIndex: 'name' }];

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:preview');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  setTestInitialState({ me: {}, meta: { pushImageMaxBytes: 1_048_576 } });
});
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the shared components follow the language', () => {
  it('the paged list whose read failed', async () => {
    const request = vi.fn(async () => {
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        httpStatus: 500,
        message: 'raw backend words',
        data: null,
      });
    });
    const view = renderWithLocaleSwitch(
      <PagedListTable<Row, Record<string, never>>
        rowKey="id"
        columns={columns}
        request={request}
      />,
    );
    await expectFailureFollowsLanguage(view, {});
  });

  it('the upload that the backend refused', async () => {
    const xhrs = stubXhr();
    const view = renderWithLocaleSwitch(
      <UploadField kind="pushImage" onUploaded={() => {}} onBusyChange={() => {}} />,
    );
    fireEvent.change(await screen.findByTestId('upload-input'), {
      target: { files: [fileOf(pngBytes(100, 100), 'a.png')] },
    });
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(500, JSON.stringify(envelope('INTERNAL_ERROR')));
    await flush();
    await expectFailureFollowsLanguage(view, { words: SERVER_ERROR });
  });

  it('the file that is too large', async () => {
    stubXhr();
    const view = renderWithLocaleSwitch(
      <UploadField kind="pushImage" onUploaded={() => {}} onBusyChange={() => {}} />,
    );
    fireEvent.change(await screen.findByTestId('upload-input'), {
      target: { files: [fileOf(pngBytes(100, 100), 'a.png', 2_000_000)] },
    });
    await expectFailureFollowsLanguage(view, {
      words: {
        en: enUS['pages.upload.problem.TOO_LARGE'].split('{')[0],
        zh: zhCN['pages.upload.problem.TOO_LARGE'].split('{')[0],
      },
      allowed: /\d[\d.,]*\s?(MB|KB|GB|B)\b/g,
    });
  });
});
