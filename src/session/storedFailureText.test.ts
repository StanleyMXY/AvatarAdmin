import { describe, expect, it } from 'vitest';
import { scanSource, scanStoredFailureText } from '../../tests/storedFailureText.scan';

const scan = (source: string) => scanSource('page.tsx', source);

describe('the words of a failure are not kept in the state of a page', () => {
  it('no page, component or hook puts the words of a failure into useState', () => {
    // Words made with describeFailure (or a function built on it) stay in the language they were
    // made in. The state keeps the failure itself, or goes through useFailure / useFailureView, and
    // the words are made when the page is drawn, so they follow the language.
    expect(scanStoredFailureText('src')).toEqual([]);
  });

  describe('the scan itself (a guard against a scan that finds nothing)', () => {
    it('sees the text of describeFailure given to a setter', () => {
      const found = scan(`
        function Page() {
          const [failure, setFailure] = useState<string | null>(null);
          const go = async () => {
            try { await save(); } catch (error) { setFailure(describeFailure(intl, error).text); }
          };
        }`);
      expect(found).toEqual([{ file: 'page.tsx', line: 5, setter: 'setFailure' }]);
    });

    it('sees it through a name that holds the words, and through a destructuring', () => {
      expect(
        scan(`
          const [a, setA] = useState('');
          const [b, setB] = useState('');
          function go(error) {
            const described = describeFailure(intl, error);
            setA(described.text);
            const { text, fields } = describeFailure(intl, error);
            setB({ text, more: fields });
          }`).map((f) => f.setter),
      ).toEqual(['setA', 'setB']);
    });

    it('sees the words of the other functions that make words', () => {
      expect(
        scan(`
          const [a, setA] = useState('');
          function go(error) {
            setA(failureToForm(intl, form, error, FIELDS).text);
            setA(actionFailure(intl, error));
            setA(templateFailureText(intl, error, true));
          }`),
      ).toHaveLength(3);
    });

    it('sees the words of a function of the same file that returns them', () => {
      expect(
        scan(`
          const [failure, setFailure] = useState<string | null>(null);
          const [other, setOther] = useState<unknown>(null);
          function failureText(error) {
            if (error.code === 'X') return t('x.changed');
            return describeFailure(intl, error).text;
          }
          function refusalView(error) {
            return { text: describeFailure(intl, error).text };
          }
          function go(error) {
            setFailure(failureText(error));
            setOther(refusalView(error));
          }`).map((f) => f.setter),
      ).toEqual(['setFailure']);
    });

    it('sees words from the language file given to a state that holds a problem', () => {
      expect(
        scan(`
          const [problem, setProblem] = useState<string | null>(null);
          const [count, setCount] = useState('');
          function go() {
            setProblem(t('x.required'));
            setCount(t('x.count'));
          }`).map((f) => f.setter),
      ).toEqual(['setProblem']);
    });

    it('lets the failure, a key, a code and a recipe through', () => {
      expect(
        scan(`
          const [failed, setFailed] = useState(null);
          const [problem, setProblem] = useState<string | null>(null);
          const [needTotp, setNeedTotp] = useState(false);
          function go(error) {
            setFailed({ error });
            setProblem('avatar.icon.required');
            const { error: refusal, uploadRejected } = failureToForm(intl, form, error, FIELDS);
            setNeedTotp(refusal.code === 'X' || uploadRejected);
            setProblem(describeFailure(intl, error).code);
            show((words) => describeFailure(words, error).text);
            setProblem((current) => (current ? current : null));
          }`),
      ).toEqual([]);
    });
  });
});
