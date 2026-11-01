import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it } from 'vitest';
import {
  expectFailureFollowsLanguage,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { ApiError } from '../../request/errors';
import { ActionModal } from './ActionModal';

describe('the failures of the cost pages follow the language', () => {
  it('the action that was refused', async () => {
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <ActionModal
        open
        title="Approve"
        okText="Go"
        onSubmit={async () => {
          throw new ApiError({
            code: 'INTERNAL_ERROR',
            httpStatus: 500,
            message: 'raw backend words',
            data: null,
          });
        }}
        onClose={() => {}}
      >
        Body
      </ActionModal>,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Go' }));
    await expectFailureFollowsLanguage(view);
  });
});
