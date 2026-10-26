import { guard } from './_core/auth';
import { MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { supportStore } from './_core/supportData';

const find = (id: string | undefined) => {
  const row = supportStore.rows.find((r) => r.id === id);
  if (!row) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such feedback');
  return row;
};

export default {
  'GET /api/admin/support/feedback': guard('SUPPORT:VIEW', (req) => {
    const rows = [...supportStore.rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/support/feedback/:id': guard('SUPPORT:VIEW', (req) => ok(find(req.params.id))),

  // Contract 12: only a FAILED feedback can be forwarded again; it goes back to PENDING, failures cleared.
  'POST /api/admin/support/feedback/:id/retry': guard('SUPPORT:MANAGE', (req) => {
    const row = find(req.params.id);
    if (row.forwardStatus !== 'FAILED') {
      throw new MockHttpError(409, 'INVALID_STATE', 'The feedback did not fail', {
        status: row.forwardStatus,
      });
    }
    row.forwardStatus = 'PENDING';
    row.attempts = 0;
    row.nextAttemptAt = null;
    return ok(null);
  }),
};
