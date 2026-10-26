import { apiRequest } from '../../request/apiClient';
import type { EmailTemplate, EmailTemplateInput } from './types';

export * from './types';

const enc = encodeURIComponent;

/** `GET /email/templates` (EMAIL:TEMPLATE): the list in the order of the backend; not paged. */
export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const data = await apiRequest<unknown>({ method: 'GET', url: '/email/templates' });
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as EmailTemplate[]) : [];
}

/** `PUT /email/templates/{templateCode}`: 400 INVALID_REQUEST when a required placeholder is missing. */
export const saveEmailTemplate = (
  templateCode: string,
  body: EmailTemplateInput,
): Promise<EmailTemplate> =>
  apiRequest({ method: 'PUT', url: `/email/templates/${enc(templateCode)}`, body });

/** `POST /email/templates/{templateCode}/reset`: back to the default text. */
export const resetEmailTemplate = (templateCode: string): Promise<EmailTemplate> =>
  apiRequest({ method: 'POST', url: `/email/templates/${enc(templateCode)}/reset` });
