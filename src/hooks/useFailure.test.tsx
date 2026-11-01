import { act, screen } from '@testing-library/react';
import { useIntl } from '@umijs/max';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  expectFailureFollowsLanguage,
  renderWithLocaleSwitch,
  SERVER_ERROR,
} from '../../tests/failureLanguage';
import { ApiError } from '../request/errors';
import { describeFailure } from '../session/describe';
import { useFailure, useFailureView } from './useFailure';

const refused = () =>
  new ApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, message: 'raw words', data: null });

function Shows() {
  const { text, fail, failWith, clear } = useFailure();
  return (
    <>
      <button type="button" onClick={() => fail(refused())}>
        fail
      </button>
      <button
        type="button"
        onClick={() => failWith((words) => words.formatMessage({ id: 'error.UNKNOWN' }))}
      >
        recipe
      </button>
      <button type="button" onClick={clear}>
        clear
      </button>
      <p data-testid="bar">{text ?? 'none'}</p>
    </>
  );
}

function ShowsLines() {
  const { view, show } = useFailureView<{ text: string; more: string[] }>();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          show((words) => ({ text: describeFailure(words, refused()).text, more: ['x'] }))
        }
      >
        fail
      </button>
      <p data-testid="bar">{view ? `${view.text} ${view.more.join()}` : 'none'}</p>
    </>
  );
}

// What the hook is for: the text kept in a state stays in the language it was made in.
function KeepsText() {
  const intl = useIntl();
  const [text, setText] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setText(describeFailure(intl, refused()).text)}>
        fail
      </button>
      <p>{text}</p>
    </>
  );
}

const press = (name: string) => act(() => screen.getByRole('button', { name }).click());

describe('useFailure', () => {
  it('says the failure in the language at the time of drawing, and nothing before there is one', async () => {
    const view = renderWithLocaleSwitch(<Shows />);
    expect(screen.getByTestId('bar')).toHaveTextContent('none');
    press('fail');
    await expectFailureFollowsLanguage(view);
  });

  it('follows the language for words that a function makes, and clears', async () => {
    const view = renderWithLocaleSwitch(<Shows />);
    press('recipe');
    expect(screen.getByTestId('bar')).toHaveTextContent('Something went wrong.');
    await view.switchTo('zh-CN');
    expect(screen.getByTestId('bar')).toHaveTextContent('出现未知错误');
    press('clear');
    expect(screen.getByTestId('bar')).toHaveTextContent('none');
  });

  it('useFailureView keeps lines under the text and they follow the language too', async () => {
    const view = renderWithLocaleSwitch(<ShowsLines />);
    press('fail');
    expect(screen.getByTestId('bar')).toHaveTextContent(`${SERVER_ERROR.en} x`);
    await view.switchTo('zh-CN');
    expect(screen.getByTestId('bar')).toHaveTextContent(`${SERVER_ERROR.zh} x`);
  });

  it('the shared check goes red for a page that keeps the words it made (the mutation it exists for)', async () => {
    const view = renderWithLocaleSwitch(<KeepsText />);
    press('fail');
    await expect(expectFailureFollowsLanguage(view, { words: SERVER_ERROR })).rejects.toThrow();
  }, 30000);
});
