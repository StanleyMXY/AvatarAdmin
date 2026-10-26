import type { AdminRoute } from '../../src/access/canAccess';

// Pages without the shell (no menu, no tabs): sign-in, authenticator setup, and the password change
// that an account must make first. None of them is a menu entry and none has a permission code.
const routes: AdminRoute[] = [
  { path: '/user/login', component: './user/login', layout: false },
  { path: '/user/enroll', component: './user/enroll', layout: false },
  { path: '/user/change-password', component: './user/change-password', layout: false },
];

export default routes;
