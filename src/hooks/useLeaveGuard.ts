import { history, useIntl } from '@umijs/max';
import { App } from 'antd';
import { useEffect, useRef } from 'react';

type Transition = { retry: () => void };
type Blockable = { block?: (blocker: (transition: Transition) => void) => () => void };

/**
 * While `active` (a page has changes that are not saved): the browser asks before the page is
 * closed or reloaded, and a move to another page inside the app asks first ("Leave this page?").
 * It lets go when `active` turns false or the page goes away. A move that is tried again while the
 * question is open does not open a second one.
 */
export function useLeaveGuard(active: boolean): void {
  const intl = useIntl();
  const { modal } = App.useApp();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const modalRef = useRef(modal);
  modalRef.current = modal;

  useEffect(() => {
    if (!active) return undefined;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Some browsers still need a value here to show their own question.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);

    let asking = false;
    const block = (history as unknown as Blockable).block;
    const unblock = block?.call(history, (transition) => {
      if (asking) return;
      asking = true;
      const t = (id: string) => intlRef.current.formatMessage({ id });
      modalRef.current.confirm({
        title: t('pages.leave.title'),
        content: t('pages.leave.content'),
        okText: t('pages.leave.leave'),
        cancelText: t('pages.leave.stay'),
        okButtonProps: { danger: true },
        onOk: () => {
          asking = false;
          // Let go first: the same move is tried again and must not be held a second time.
          unblock?.();
          transition.retry();
        },
        onCancel: () => {
          asking = false;
        },
      });
    });

    return () => {
      window.removeEventListener('beforeunload', onUnload);
      unblock?.();
    };
  }, [active]);
}
