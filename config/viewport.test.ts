import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { viewportMetas } from './viewport';

const viewport = () => viewportMetas.find((meta) => meta.name === 'viewport')?.content ?? '';

describe('the viewport tag of the page (WCAG 1.4.4: text can be enlarged to 200%)', () => {
  it('fits the width of the device and starts at normal size', () => {
    expect(viewport()).toMatch(/(^|,\s*)width=device-width(,|$)/);
    expect(viewport()).toMatch(/(^|,\s*)initial-scale=1(\.0)?(,|$)/);
  });

  it('lets the person zoom: no ban on scaling and no upper limit below 2', () => {
    expect(viewport()).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
    const max = viewport().match(/maximum-scale\s*=\s*([\d.]+)/i);
    expect(max === null || Number(max[1]) >= 2).toBe(true);
  });

  it('is what the build configuration hands to Umi, which otherwise writes its own tag that forbids zooming', () => {
    expect(readFileSync('config/config.ts', 'utf8')).toMatch(/metas:\s*viewportMetas/);
  });
});
