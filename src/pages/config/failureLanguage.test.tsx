import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import * as configMock from '../../../mock/config.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { ConfigForm } from './ConfigForm';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  signInAs('root');
});
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the parameter form follow the language', () => {
  it('the parameters that could not be read', async () => {
    useMockBackend(configMock);
    failRequests(/^GET \/api\/admin\/config$/);
    const view = renderWithLocaleSwitch(<ConfigForm />);
    await expectFailureFollowsLanguage(view);
  });
});
