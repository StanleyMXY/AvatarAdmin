import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import type { CheckinActivity, TaskConfig } from '../../services/activity';
import { ActivityFormModal } from './ActivityFormModal';
import { ActivityViewModal } from './ActivityViewModal';
import { TaskFormModal } from './TaskFormModal';
import { activityState, signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const noop = () => {};

describe('the failures of the activity dialogs follow the language', () => {
  it('the view of an activity that could not be read', async () => {
    useMockBackend({ default: activityMock });
    failRequests(/GET .*checkin\/activities\/\w+/);
    const view = renderWithLocaleSwitch(
      <ActivityViewModal id={activityState.activities[0].id} open onClose={noop} />,
    );
    await expectFailureFollowsLanguage(view);
  });

  it('the sign-in activity that could not be saved', async () => {
    const target = activityState.activities[0] as unknown as CheckinActivity;
    useMockBackend({ default: activityMock });
    failRequests((path, method) => method === 'PUT' && path.includes('checkin/activities'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <ActivityFormModal target={target} open onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('textbox', { name: 'Activity name' });
    await user.click(within(dialog).getByRole('button', { name: /Submit/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the task that could not be saved', async () => {
    const target = activityState.taskConfigs[0] as unknown as TaskConfig;
    useMockBackend({ default: activityMock });
    failRequests((path, method) => method === 'PUT' && path.includes('tasks/configs'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <TaskFormModal target={target} open onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Submit/ }));
    await expectFailureFollowsLanguage(view);
  });
});
