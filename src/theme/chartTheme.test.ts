import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { axisTextStyle, getChartTheme } from './chartTheme';
import { contrastRatio } from './contrast';
import { getModeTokens, THEME_MODES } from './modes';

describe('getChartTheme', () => {
  it('has the palette of the spec with the primary colour first', () => {
    expect(getChartTheme('dim').palette).toEqual([
      '#0ABAB5',
      '#3B82F6',
      '#A78BFA',
      '#F59E0B',
      '#EC4899',
      '#94A3B8',
    ]);
  });

  it('uses green for a rise and red for a fall', () => {
    for (const mode of THEME_MODES)
      expect(getChartTheme(mode)).toMatchObject({ rise: '#22C55E', fall: '#EF4444' });
  });

  it.each(THEME_MODES)(
    'in %s mode takes text and background from the mode, with readable text',
    (mode) => {
      const theme = getChartTheme(mode);
      const tokens = getModeTokens(mode);
      expect(theme.background).toBe(tokens.colorBgContainer);
      expect(theme.textColor).toBe(tokens.colorTextSecondary);
      expect(contrastRatio(theme.textColor, theme.background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('draws grid lines that are visible but quieter than the text', () => {
    for (const mode of THEME_MODES) {
      const theme = getChartTheme(mode);
      const grid = contrastRatio(theme.gridColor, theme.background);
      expect(grid).toBeGreaterThan(1.1);
      expect(grid).toBeLessThan(contrastRatio(theme.textColor, theme.background));
    }
  });

  it('changes with the mode, so charts are drawn again when it changes', () => {
    expect(getChartTheme('dim')).not.toEqual(getChartTheme('light'));
    expect(getChartTheme('dim').g2Theme).toBe('classicDark');
    expect(getChartTheme('deep').g2Theme).toBe('classicDark');
    expect(getChartTheme('light').g2Theme).toBe('classic');
  });

  it('returns a new object each time, so a change is seen as a change', () => {
    expect(getChartTheme('dim')).not.toBe(getChartTheme('dim'));
  });
});

describe('axisTextStyle (the text of the axes of every chart)', () => {
  // G2 draws axis labels and titles at 45% opacity unless told otherwise, which leaves the text
  // colour at about 2:1 on the page. Full opacity gives the colour that was chosen.
  it.each(THEME_MODES)('has the text colour at full opacity in %s mode', (mode) => {
    const theme = getChartTheme(mode);
    expect(axisTextStyle(theme)).toEqual({
      labelFill: theme.textColor,
      labelOpacity: 1,
      titleFill: theme.textColor,
      titleOpacity: 1,
    });
    expect(contrastRatio(theme.textColor, theme.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('is the only place that sets the colour of axis text: every chart takes it from here', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : files(path);
        return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
      });
    const own = join('src', 'theme', 'chartTheme.ts');
    const found = files('src').filter(
      (file) => file !== own && /\b(labelFill|titleFill)\b/.test(readFileSync(file, 'utf8')),
    );
    expect(found).toEqual([]);
  });
});
