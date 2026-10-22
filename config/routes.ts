/** Route assembly. Task 4 replaces this with the module-by-module route table. */
export default [
  {
    path: '/user/login',
    name: 'login',
    layout: false,
    component: './user/login',
  },
  { path: '/', redirect: '/user/login' },
];
