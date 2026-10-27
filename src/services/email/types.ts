// The shape of the e-mail template endpoints (contract 17.4: the table row and item 14 of the
// field tables; the placeholders carry their braces, reply 2 of the backend).

export type EmailTemplate = {
  /** Declared by the backend; a code that this page has never heard of is shown like any other. */
  templateCode: string;
  /** The text in force: the saved one, or the default when the template was never changed. */
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  /** True when the database holds a row for the template. */
  modified: boolean;
  updatedBy: string | null;
  updatedByUsername: string | null;
  updatedAt: string | null;
  /** The placeholders that may be used, each with its braces, for example `{code}`. */
  placeholders: string[];
  /** The ones that must be in the body, written exactly as they are in this list. */
  requiredPlaceholders: string[];
};

export type EmailTemplateInput = { subject: string; body: string };
