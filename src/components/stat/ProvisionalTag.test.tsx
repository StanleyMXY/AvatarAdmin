import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { ProvisionalTag } from './ProvisionalTag';

describe('ProvisionalTag', () => {
  it('writes "Provisional" in English and "临时值" in Chinese', () => {
    const view = renderPage(<ProvisionalTag testId="tag" />);
    expect(screen.getByTestId('tag')).toHaveTextContent('Provisional');
    view.unmount();
    renderPage(<ProvisionalTag testId="tag" />, 'zh-CN');
    expect(screen.getByTestId('tag')).toHaveTextContent('临时值');
  });
});
