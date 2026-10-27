import { guard } from './_core/auth';
import { ok } from './_core/http';
import { systemState } from './_core/systemData';

export default {
  // Reading the tree needs ROLE:MANAGE or PERMISSION:MANAGE (contract 17.4, system management row).
  'GET /api/admin/permissions': guard(['ROLE:MANAGE', 'PERMISSION:MANAGE'], () =>
    ok({ items: [...systemState.nodes.values()] }),
  ),
};
