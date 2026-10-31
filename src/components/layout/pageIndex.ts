import type { AdminRoute } from '../../access/canAccess';

export type PageEntry = {
  path: string;
  /** Language key of the page title: `menu.<menu key>.<page name>`, or `menu.<name>` for a page outside a menu. */
  titleKey: string;
  access?: string;
  segments: string[];
};

const segmentsOf = (path: string) => path.split('/').filter(Boolean);

/** Every page of the route tree with the key of its title (the names of its parents and its own, joined by dots). */
export function indexPages(routes: AdminRoute[], chain: string[] = []): PageEntry[] {
  const pages: PageEntry[] = [];
  for (const route of routes) {
    const names = route.name ? [...chain, route.name] : chain;
    if (route.routes) {
      pages.push(...indexPages(route.routes, names));
    } else if (
      route.path !== undefined &&
      route.component !== undefined &&
      route.layout !== false &&
      route.path !== '*'
    ) {
      pages.push({
        path: route.path,
        titleKey: `menu.${names.join('.')}`,
        access: route.access,
        segments: segmentsOf(route.path),
      });
    }
  }
  return pages;
}

/** The page that opens at `pathname`: a fixed segment beats a `:parameter` segment. */
export function matchPage(pages: PageEntry[], pathname: string): PageEntry | undefined {
  const parts = segmentsOf(pathname);
  let best: { page: PageEntry; fixed: number } | undefined;
  for (const page of pages) {
    if (page.segments.length !== parts.length) continue;
    let fixed = 0;
    const fits = page.segments.every((segment, i) => {
      if (segment.startsWith(':')) return parts[i] !== '';
      if (segment === parts[i]) {
        fixed += 1;
        return true;
      }
      return false;
    });
    if (fits && (!best || fixed > best.fixed)) best = { page, fixed };
  }
  return best?.page;
}

const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: the address is user-controlled text
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const IDENTIFIER_LIMIT = 20;

const decode = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/**
 * What tells one page of a parameter route from another (`/users/42` gives `42`), for the title of
 * its tab and of the browser window; nothing for a page with a fixed address. The text is the
 * address's, so control and direction characters are taken out, and a long value is cut to 20
 * characters (code points) with a mark.
 */
export function pageIdentifier(pages: PageEntry[], pathname: string): string | undefined {
  const page = matchPage(pages, pathname);
  if (!page) return undefined;
  const parts = segmentsOf(pathname);
  const values = page.segments
    .map((segment, i) => (segment.startsWith(':') ? parts[i] : undefined))
    .filter((value): value is string => value !== undefined)
    .map((value) => decode(value).replace(CONTROL_CHARACTERS, '').replace(BIDI_CONTROLS, ''))
    .filter((value) => value !== '');
  if (values.length === 0) return undefined;
  const text = values.join(' / ');
  const points = [...text];
  return points.length > IDENTIFIER_LIMIT
    ? `${points.slice(0, IDENTIFIER_LIMIT - 1).join('')}…`
    : text;
}

/** `User detail · 42`: the title with the identifier of its page, or the title alone. */
export function titleWithIdentifier(title: string, identifier: string | undefined): string {
  return identifier === undefined ? title : `${title} · ${identifier}`;
}
