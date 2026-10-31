import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { repoFiles } from '../../tests/noHardcodedText.scan';

// Every form that has a check must take part in the language switch (`RevalidateOnLocaleChange`),
// or a message it shows stays in the old language. A form with no check at all is listed here with
// the reason, and the list is checked in both directions.
const NO_CHECK: Record<string, string> = {
  'src/pages/analytics/detail.tsx': 'filter fields with no rule',
  'src/pages/analytics/funnel.tsx': 'its problems are shown from keys kept in state, not by rules',
  'src/pages/campaign/LinkModal.tsx': 'fields with no rule, the text is built from keys',
  'src/pages/companionship/index.tsx': 'its problems are shown from state, not by rules',
  'src/pages/complaints/ComplaintDrawer.tsx': 'fields with no rule',
  'src/pages/invite/FissionTab.tsx': 'its problems are shown from keys kept in state, not by rules',
};

const FORM = /<Form[\s<>]/;
const CHECKS = /rules=|rules:|validator|linkRule|linkTargetRule/;

const sources = repoFiles().filter(
  (file) =>
    /^src\/.*\.tsx$/.test(file) &&
    !/\.test\.tsx$/.test(file) &&
    file !== 'src/hooks/useRevalidateOnLocaleChange.tsx',
);
const forms = sources.filter((file) => FORM.test(readFileSync(file, 'utf8')));

describe('forms and the language switch', () => {
  it('finds the forms', () => {
    expect(forms.length).toBeGreaterThan(40);
  });

  it('puts RevalidateOnLocaleChange in every form that has a check', () => {
    const missing = forms.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return CHECKS.test(text) && !text.includes('<RevalidateOnLocaleChange />');
    });
    expect(missing).toEqual([]);
  });

  it('lists only forms that have no check, and every form listed exists', () => {
    for (const file of Object.keys(NO_CHECK)) {
      expect(forms, file).toContain(file);
      const text = readFileSync(file, 'utf8');
      expect(CHECKS.test(text), `${file}: ${NO_CHECK[file]}`).toBe(false);
      expect(text.includes('<RevalidateOnLocaleChange'), file).toBe(false);
    }
    const unlisted = forms.filter((file) => !CHECKS.test(readFileSync(file, 'utf8')));
    expect(unlisted.filter((file) => !(file in NO_CHECK))).toEqual([]);
  });
});
