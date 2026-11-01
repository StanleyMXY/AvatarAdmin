/**
 * The viewport tag. Umi writes its own when the configuration has none, and that one forbids
 * zooming (`user-scalable=no, maximum-scale=1.0`), so low-vision users cannot enlarge the text on a
 * phone (WCAG 1.4.4). With this tag present Umi does not add its own.
 */
export const viewportMetas = [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }];
