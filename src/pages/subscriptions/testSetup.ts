// Imported by the page tests of this module for its effect: wait longer than the default second for what
// a page shows, because the pages draw big tables and the machine may be busy with other work.
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 8000 });
