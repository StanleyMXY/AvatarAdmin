import appRoutes from '../../../config/routes';
import { indexPages, pageIdentifier, titleWithIdentifier } from './pageIndex';

const pages = indexPages(appRoutes);

/**
 * The browser window title: `<page> - <product>`, and for a parameter page
 * `<page> · <identifier> - <product>` (`User detail · 42 - Product`), so that two detail tabs are
 * told apart in the window list too. Handed to the layout as `pageTitleRender`.
 */
export function pageTitleRender(
  props: { pathname?: string },
  defaultTitle: string,
  info?: { pageName?: string },
): string {
  const identifier = pageIdentifier(pages, props.pathname ?? '/');
  const pageName = info?.pageName;
  // `<page> - <product>` has a page name in front; a bare `<product>` (a path that is no page, the
  // sign-in page) has none, and gets no identifier.
  const prefix = `${pageName} - `;
  if (identifier === undefined || !pageName || !defaultTitle.startsWith(prefix)) {
    return defaultTitle;
  }
  return `${titleWithIdentifier(pageName, identifier)}${defaultTitle.slice(pageName.length)}`;
}
