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
