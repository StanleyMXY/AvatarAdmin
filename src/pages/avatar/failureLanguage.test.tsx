import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { ACCOUNT, avatarState } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { fileOf, pngBytes, zipBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import type { CosmeticItem, DefaultAvatar } from '../../services/avatar';
import { ActionModal } from './ActionModal';
import { CosmeticModal } from './CosmeticModal';
import { DeclarationModal } from './DeclarationModal';
import { GrantCosmeticModal } from './GrantCosmetic';
import { NewDefaultAvatarModal } from './NewDefaultAvatarModal';
import { RenameDefaultAvatarModal } from './RenameDefaultAvatarModal';
import { RendererModelModal } from './RendererModelModal';
import { chooseOption, signIn, stubObjectUrls } from './testSetup';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

beforeEach(() => {
  signIn('root');
  stubObjectUrls();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const noop = () => {};
const backend = () => useMockBackend({ default: avatarMock });
const submit = (dialog: HTMLElement) =>
  userEvent.setup().click(within(dialog).getByRole('button', { name: 'Submit' }));

describe('the failures of the avatar dialogs follow the language', { timeout: 60000 }, () => {
  it('the cosmetics that could not be listed for a gift', async () => {
    const _calls = backend();
    failRequests(/GET .*\/cosmetics/);
    const view = renderWithLocaleSwitch(
      <GrantCosmeticModal accountId={ACCOUNT.empty} open onClose={noop} onGranted={noop} />,
    );
    await expectFailureFollowsLanguage(view);
  });

  it('the gift that was refused', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.includes('/cosmetics'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <GrantCosmeticModal accountId={ACCOUNT.empty} open onClose={noop} onGranted={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Item', /outfit_blue_suit/, dialog);
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'ขอบคุณ' } });
    await submit(dialog);
    await expectFailureFollowsLanguage(view);
  });

  it('the declaration that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.includes('/declarations'));
    const view = renderWithLocaleSwitch(<DeclarationModal open onClose={noop} onSaved={noop} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Version'), { target: { value: '2027-v1' } });
    fireEvent.change(within(dialog).getByLabelText('en'), { target: { value: 'I agree' } });
    await submit(dialog);
    await expectFailureFollowsLanguage(view);
  });

  it('the cosmetic that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && path.includes('/cosmetics'));
    const item = avatarState.cosmetics[0] as unknown as CosmeticItem;
    const view = renderWithLocaleSwitch(
      <CosmeticModal open item={item} onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await submit(dialog);
    await expectFailureFollowsLanguage(view);
  });

  it('the action that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && path.includes('/actions'));
    const action = avatarState.actions[0] as unknown as Parameters<typeof ActionModal>[0]['action'];
    const view = renderWithLocaleSwitch(
      <ActionModal open action={action} onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await submit(dialog);
    await expectFailureFollowsLanguage(view);
  });

  it('the default avatar that could not be renamed', async () => {
    const _calls = backend();
    failRequests((path, method) => method !== 'GET' && path.includes('/default-avatars'));
    const avatar = avatarState.defaultAvatars[0] as unknown as DefaultAvatar;
    const view = renderWithLocaleSwitch(
      <RenameDefaultAvatarModal avatar={avatar} onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await submit(dialog);
    await expectFailureFollowsLanguage(view);
  });

  it('the default avatar that could not be created', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.includes('/default-avatars'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <NewDefaultAvatarModal open onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [fileOf(pngBytes(200, 200), 'portrait.png')] },
    });
    await within(dialog).findByText(/portrait\.png/);
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Vega' } });
    await chooseOption(user, 'Style', 'Realistic', dialog);
    await user.click(within(dialog).getByRole('checkbox'));
    await submit(dialog);
    await expectFailureFollowsLanguage(view);
  });

  it('the renderer model that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.includes('/renderer-models'));
    const view = renderWithLocaleSwitch(<RendererModelModal open onClose={noop} onSaved={noop} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [fileOf(zipBytes(), 'avatar-renderer-1.2.0.zip')] },
    });
    await within(dialog).findByText(/avatar-renderer-1\.2\.0\.zip/);
    fireEvent.change(within(dialog).getByLabelText('Version'), { target: { value: '1.2.0' } });
    fireEvent.change(within(dialog).getByLabelText('ABI'), { target: { value: 'x86_64' } });
    fireEvent.change(within(dialog).getByLabelText('Lowest app version code'), {
      target: { value: '150' },
    });
    await submit(dialog);
    await expectFailureFollowsLanguage(view);
  });
});
