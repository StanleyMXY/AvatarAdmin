import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { avatarState } from '../../../mock/_core/avatarData';
import { resetConfigStore } from '../../../mock/_core/configStore';
import complaintsMock from '../../../mock/complaints.mock';
import * as configMock from '../../../mock/config.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { signIn } from '../avatar/testSetup';
import { ComplaintDrawer } from './ComplaintDrawer';
import { EvidenceViewer } from './EvidenceViewer';
import LikenessComplaintsPage from './likeness';

beforeEach(() => {
  signIn('reviewer');
  resetConfigStore();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const backend = () => useMockBackend({ default: complaintsMock }, configMock);

describe('the failures of the complaint pages follow the language', { timeout: 60000 }, () => {
  it('the complaint that could not be read', async () => {
    const _calls = backend();
    failRequests(/GET .*likeness-complaints\/[^/]+$/);
    const view = renderWithLocaleSwitch(
      <ComplaintDrawer id={avatarState.complaints[0].id} onClose={() => {}} onChanged={() => {}} />,
    );
    await expectFailureFollowsLanguage(view);
  });

  it('the state that could not be changed', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && path.endsWith('/status'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<LikenessComplaintsPage />);
    const mail = await screen.findByText('person3@example.org');
    await user.click(
      within(mail.closest('tr') as HTMLElement).getByRole('button', { name: 'Details' }),
    );
    const drawer = await screen.findByRole('dialog');
    await user.click(await within(drawer).findByRole('combobox', { name: 'New state' }));
    const options = await screen.findAllByText('Investigating', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    fireEvent.change(within(drawer).getByLabelText('Note'), { target: { value: 'ملاحظة' } });
    await user.click(within(drawer).getByRole('button', { name: 'Change state' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the evidence file that could not be read', async () => {
    const _calls = backend();
    failRequests(/GET .*evidence\/0/);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <EvidenceViewer complaintId={avatarState.complaints[0].id} count={2} />,
    );
    await user.click(await screen.findByRole('button', { name: /1/ }));
    await expectFailureFollowsLanguage(view);
  });
});
