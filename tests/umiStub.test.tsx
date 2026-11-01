import { act, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FormattedMessage,
  getLocale,
  history,
  Link,
  resetUmiStub,
  setLocale,
  setTestAccess,
  setTestInitialState,
  setTestInitialStateDelay,
  setTestLocation,
  useAccess,
  useIntl,
  useLocation,
  useModel,
} from './stubs/umi-max';

// The stand-in for `@umijs/max` is what every component test stands on. These tests keep it honest:
// a hook that did not re-render, or a reset that left state behind, would show up in some page test
// as a wrong answer far from the cause.

beforeEach(() => {
  resetUmiStub();
});

afterEach(() => {
  vi.useRealTimers();
});

// The model object of the latest render of <Grab />, for tests that call setInitialState.
let model: ReturnType<typeof useModel>;
function Grab() {
  model = useModel('@@initialState');
  return null;
}

function Other() {
  useModel('somethingElse');
  return null;
}

function Greeting() {
  const intl = useIntl();
  return (
    <p>
      {intl.formatMessage({ id: 'hello' })} <FormattedMessage id="bye" />
    </p>
  );
}

function AccessProbe() {
  const access = useAccess();
  return <output data-testid="access">{JSON.stringify(access)}</output>;
}

function StateProbe() {
  const { initialState } = useModel('@@initialState');
  return <output data-testid="state">{JSON.stringify(initialState ?? null)}</output>;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe('useAccess', () => {
  it('starts empty and follows setTestAccess without a new render call', () => {
    render(<AccessProbe />);
    expect(screen.getByTestId('access')).toHaveTextContent('{}');
    act(() => setTestAccess({ 'USER:VIEW': true }));
    expect(screen.getByTestId('access')).toHaveTextContent('{"USER:VIEW":true}');
    act(() => setTestAccess({}));
    expect(screen.getByTestId('access')).toHaveTextContent('{}');
  });

  it('is empty again after resetUmiStub, also for a component that is still mounted', () => {
    render(<AccessProbe />);
    act(() => setTestAccess({ 'USER:VIEW': true }));
    act(() => resetUmiStub());
    expect(screen.getByTestId('access')).toHaveTextContent('{}');
  });
});

describe('useModel', () => {
  it('gives the initial state a test set, and nothing before', () => {
    render(<StateProbe />);
    expect(screen.getByTestId('state')).toHaveTextContent('null');
    act(() => setTestInitialState({ me: { id: 7 } }));
    expect(screen.getByTestId('state')).toHaveTextContent('{"me":{"id":7}}');
  });

  it('has no initial state again after resetUmiStub, also for a component that is still mounted', () => {
    render(<StateProbe />);
    act(() => setTestInitialState({ me: { id: 7 } }));
    act(() => resetUmiStub());
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('setInitialState takes a value and an updater that is given the previous state', async () => {
    render(
      <>
        <Grab />
        <StateProbe />
      </>,
    );
    await act(async () => {
      await model.setInitialState({ a: 1 });
    });
    expect(screen.getByTestId('state')).toHaveTextContent('{"a":1}');
    await act(async () => {
      await model.setInitialState((previous) => ({ ...previous, b: 2 }));
    });
    expect(screen.getByTestId('state')).toHaveTextContent('{"a":1,"b":2}');
    await act(async () => {
      await model.setInitialState(undefined);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('can commit setInitialState late, as Umi does, and not before the time is up', async () => {
    vi.useFakeTimers();
    render(
      <>
        <Grab />
        <StateProbe />
      </>,
    );
    setTestInitialStateDelay(50);
    await act(async () => {
      await model.setInitialState({ late: true });
    });
    expect(screen.getByTestId('state')).toHaveTextContent('null');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(49);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('null');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('{"late":true}');
  });

  it('applies at once again after resetUmiStub', async () => {
    render(
      <>
        <Grab />
        <StateProbe />
      </>,
    );
    setTestInitialStateDelay(10_000);
    act(() => resetUmiStub());
    await act(async () => {
      await model.setInitialState({ now: true });
    });
    expect(screen.getByTestId('state')).toHaveTextContent('{"now":true}');
  });

  it('refuses a model it does not provide, instead of returning something that looks right', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Other />)).toThrow(/somethingElse/);
    error.mockRestore();
  });

  it('has the rest of what a page reads from the model: loading, error and refresh', async () => {
    render(<Grab />);
    expect(model.loading).toBe(false);
    expect(model.error).toBeUndefined();
    await expect(model.refresh()).resolves.toBeUndefined();
  });
});

describe('useLocation', () => {
  it('starts at the root and merges what setTestLocation is given into the location', () => {
    render(<LocationProbe />);
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    act(() => setTestLocation({ pathname: '/users/list' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/users/list');
    act(() => setTestLocation({ search: '?page=2' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/users/list?page=2');
  });

  it('is back at the root after resetUmiStub', () => {
    render(<LocationProbe />);
    act(() => setTestLocation({ pathname: '/users/list', search: '?a=1' }));
    act(() => resetUmiStub());
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });
});

describe('Link', () => {
  it('renders an anchor for a path and passes the other attributes on', () => {
    render(
      <Link to="/users/42" className="row-link" data-testid="link" aria-label="open">
        ผู้ใช้ 42
      </Link>,
    );
    const link = screen.getByTestId('link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/users/42');
    expect(link).toHaveClass('row-link');
    expect(link).toHaveAttribute('aria-label', 'open');
    expect(link).toHaveTextContent('ผู้ใช้ 42');
  });

  it('writes the path and the query of an object address, and tolerates a missing part', () => {
    render(
      <>
        <Link to={{ pathname: '/users/list', search: '?q=%D8%B9' }} data-testid="both">
          a
        </Link>
        <Link to={{ pathname: '/only-path' }} data-testid="path">
          b
        </Link>
        <Link to={{ search: '?only=query' }} data-testid="query">
          c
        </Link>
      </>,
    );
    expect(screen.getByTestId('both')).toHaveAttribute('href', '/users/list?q=%D8%B9');
    expect(screen.getByTestId('path')).toHaveAttribute('href', '/only-path');
    expect(screen.getByTestId('query')).toHaveAttribute('href', '?only=query');
  });
});

describe('getLocale and setLocale', () => {
  it('starts in en-US, changes with setLocale and is en-US again after resetUmiStub', () => {
    expect(getLocale()).toBe('en-US');
    setLocale('zh-CN', false);
    expect(getLocale()).toBe('zh-CN');
    resetUmiStub();
    expect(getLocale()).toBe('en-US');
  });
});

describe('history', () => {
  it('records pushes, replaces and backs, and resetUmiStub clears the record', () => {
    history.push('/a');
    history.replace({ pathname: '/b' });
    history.back();
    expect(history.push).toHaveBeenCalledWith('/a');
    expect(history.replace).toHaveBeenCalledWith({ pathname: '/b' });
    expect(history.back).toHaveBeenCalledTimes(1);
    resetUmiStub();
    expect(history.push).not.toHaveBeenCalled();
    expect(history.replace).not.toHaveBeenCalled();
    expect(history.back).not.toHaveBeenCalled();
  });
});

describe('the intl exports', () => {
  it('are the ones of react-intl: messages in several languages come out as written', () => {
    for (const [locale, hello, bye] of [
      ['th-TH', 'สวัสดี', 'ลาก่อน'],
      ['ar', 'مرحبا', 'مع السلامة'],
      ['zh-CN', '你好', '再见'],
    ]) {
      const { unmount } = render(
        <IntlProvider locale={locale} messages={{ hello, bye }}>
          <Greeting />
        </IntlProvider>,
      );
      expect(screen.getByText(`${hello} ${bye}`)).toBeInTheDocument();
      unmount();
    }
  });
});
