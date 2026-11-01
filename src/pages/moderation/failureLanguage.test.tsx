import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { moderationState, RECORD_ID } from '../../../mock/_core/moderationData';
import configMock from '../../../mock/config.mock';
import * as moderationMock from '../../../mock/moderation.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import type { ModerationRecord } from '../../services/moderation';
import { ContentPanel } from './ContentPanel';
import { DecisionModal } from './DecisionModal';
import DetailPage from './detail';
import QueuePage from './queue';
import RulesPage from './rules';
import StatsPage from './stats';
import { interceptFetch, openRecord, signIn } from './testSetup';

beforeEach(() => signIn('reviewer'));
afterEach(() => vi.unstubAllGlobals());

const backend = () => useMockBackend(moderationMock, { default: configMock });

describe('the failures of the moderation pages follow the language', () => {
  it('the statistics whose read failed', async () => {
    useMockBackend(moderationMock);
    failRequests(/GET .*moderation\/stats/);
    const view = renderWithLocaleSwitch(<StatsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the queue whose oldest waiting time could not be read', async () => {
    const _calls = backend();
    failRequests(/GET .*moderation\/stats/);
    const view = renderWithLocaleSwitch(<QueuePage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the record that could not be read', async () => {
    openRecord(RECORD_ID.reportedAvatar);
    const _calls = backend();
    failRequests(/GET .*moderation\/records\/[^/]+$/);
    const view = renderWithLocaleSwitch(<DetailPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the content that could not be read', async () => {
    const _calls = backend();
    failRequests(/GET .*\/content$/);
    const record = moderationState.records.find(
      (r) => r.id === RECORD_ID.reportedAvatar,
    ) as unknown as ModerationRecord;
    const view = renderWithLocaleSwitch(<ContentPanel record={record} canReview />);
    await expectFailureFollowsLanguage(view);
  });

  it('the rule list that could not be read', async () => {
    const _calls = backend();
    failRequests(/GET .*text-rules/);
    const view = renderWithLocaleSwitch(<RulesPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the rule list whose save was refused for a row and for the whole list', async () => {
    const user = userEvent.setup();
    const _calls = backend();
    interceptFetch((url, init) =>
      url.includes('text-rules') && init.method === 'PUT'
        ? jsonResponse(
            400,
            envelope('INVALID_REQUEST', {
              details: [
                { ref: '0', reason: 'TOO_LONG' },
                { ref: 'items', reason: 'TOO_MANY' },
              ],
            }),
          )
        : undefined,
    );
    const view = renderWithLocaleSwitch(<RulesPage />);
    await screen.findByLabelText('Match text 1');
    fireEvent.change(screen.getByLabelText('Match text 1'), { target: { value: 'ก่อน' } });
    await user.click(screen.getByRole('button', { name: /Save the list/ }));
    await expectFailureFollowsLanguage(view, {
      words: { en: enUS['reason.TOO_LONG'], zh: zhCN['reason.TOO_LONG'] },
    });
  });

  it('the decision that was refused', async () => {
    const user = userEvent.setup();
    const record = moderationState.records.find(
      (r) => r.id === RECORD_ID.reportedAvatar,
    ) as unknown as ModerationRecord;
    const view = renderWithLocaleSwitch(
      <DecisionModal
        record={record}
        decision="APPROVE"
        onSubmit={async () => {
          throw new ApiError({
            code: 'INTERNAL_ERROR',
            httpStatus: 500,
            message: 'raw backend words',
            data: null,
          });
        }}
        onClose={() => {}}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    await expectFailureFollowsLanguage(view);
  });
});
