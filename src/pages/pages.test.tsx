import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it } from 'vitest';
import { history, resetUmiStub, setTestLocation } from '../../tests/stubs/umi-max';
import type { AdminRoute } from '../access/canAccess';
import { Forbidden } from './403';
import NotFoundPage from './404';

const messages = {
  'pages.403.title': 'No permission',
  'pages.403.subtitle': 'Your account may not open this page.',
  'pages.403.needs': 'Needed permission: {name}',
  'pages.403.back': 'Back to the overview',
  'pages.404.title': 'Page not found',
  'pages.404.subtitle': 'This address is not a page.',
  'pages.404.back': 'Back to the overview',
  'permission.USER:VIEW': 'View users',
};

const routes: AdminRoute[] = [
  {
    key: 'users',
    name: 'users',
    routes: [
      { path: '/users/list', name: 'list', component: './list', access: 'USER:VIEW' },
      {
        path: '/users/:id',
        name: 'detail',
        component: './detail',
        access: 'ABUSE:VIEW',
        hideInMenu: true,
      },
    ],
  },
];

const wrap = (ui: React.ReactElement) => (
  <IntlProvider locale="en-US" messages={messages} onError={() => {}}>
    {ui}
  </IntlProvider>
);

beforeEach(() => resetUmiStub());

describe('the 403 page', () => {
  it('is not blank: it says there is no permission and why', () => {
    setTestLocation({ pathname: '/users/list' });
    render(wrap(<Forbidden routes={routes} />));
    expect(screen.getByText('No permission')).toBeInTheDocument();
    expect(screen.getByText('Your account may not open this page.')).toBeInTheDocument();
  });

  it('names the permission that the page needs, from the language file', () => {
    setTestLocation({ pathname: '/users/list' });
    render(wrap(<Forbidden routes={routes} />));
    expect(screen.getByText('Needed permission: View users')).toBeInTheDocument();
  });

  it('shows the code itself when there is no name for it', () => {
    setTestLocation({ pathname: '/users/42' });
    render(wrap(<Forbidden routes={routes} />));
    expect(screen.getByText('Needed permission: ABUSE:VIEW')).toBeInTheDocument();
  });

  it('does not name a permission for an address that is no page', () => {
    setTestLocation({ pathname: '/somewhere/else' });
    render(wrap(<Forbidden routes={routes} />));
    expect(screen.queryByText(/Needed permission/)).toBeNull();
    expect(screen.getByText('No permission')).toBeInTheDocument();
  });

  it('has a way back to the overview', () => {
    setTestLocation({ pathname: '/users/list' });
    render(wrap(<Forbidden routes={routes} />));
    fireEvent.click(screen.getByText('Back to the overview'));
    expect(history.push).toHaveBeenCalledWith('/dashboard');
  });

  it('shows no text of its own that is not from the language file', () => {
    setTestLocation({ pathname: '/users/list' });
    const { container } = render(
      <IntlProvider locale="en-US" messages={{}} onError={() => {}}>
        <Forbidden routes={routes} />
      </IntlProvider>,
    );
    expect(container.textContent).toContain('pages.403.title');
  });
});

describe('the 404 page', () => {
  it('says the page was not found and has a way back', () => {
    render(wrap(<NotFoundPage />));
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back to the overview'));
    expect(history.push).toHaveBeenCalledWith('/dashboard');
  });
});
