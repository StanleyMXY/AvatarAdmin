import { history, useIntl } from '@umijs/max';
import { App } from 'antd';
import { useCallback, useEffect, useRef } from 'react';

type Transition = { retry: () => void };
type Blockable = { block?: (blocker: (transition: Transition) => void) => () => void };

// The pages that hold changes that are not saved right now, each with the way to let go of its
// hold on the address. The tab bar asks this before it does something that drops the open page.
const guards = new Set<{ release: () => void }>();

/** Whether a page that is open holds changes that are not saved. */
export function hasUnsavedChanges(): boolean {
  return guards.size > 0;
}

/**
 * The person has agreed to lose the unsaved changes (an own question was answered): the pages stop
 * asking about the move that follows. Each page lets go again by itself when it goes away.
 */
export function releaseLeaveGuards(): void {
  for (const guard of guards) guard.release();
}

type Intl = ReturnType<typeof useIntl>;
type Modal = ReturnType<typeof App.useApp>['modal'];

/** "Leave this page?": `onLeave` after "Leave", `onStay` after "Stay". */
function askToLeave(intl: Intl, modal: Modal, onLeave: () => void, onStay: () => void): void {
  const t = (id: string) => intl.formatMessage({ id });
  modal.confirm({
    title: t('pages.leave.title'),
    content: t('pages.leave.content'),
    okText: t('pages.leave.leave'),
    cancelText: t('pages.leave.stay'),
    okButtonProps: { danger: true },
    onOk: onLeave,
    onCancel: onStay,
  });
}

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
      askToLeave(
        intlRef.current,
        modalRef.current,
        () => {
          asking = false;
          // Let go first: the same move is tried again and must not be held a second time.
          unblock?.();
          transition.retry();
        },
        () => {
          asking = false;
        },
      );
    });

    const guard = { release: () => unblock?.() };
    guards.add(guard);
    return () => {
      guards.delete(guard);
      window.removeEventListener('beforeunload', onUnload);
      unblock?.();
    };
  }, [active]);
}

/**
 * For what drops the open page without a move that the guard would see (the page is drawn again,
 * or its tab is closed and the tab bar moves on): `proceed` runs at once when no page holds unsaved
 * changes, otherwise after the same "Leave this page?" question is answered "Leave". After "Stay"
 * nothing happens, and asking again while the question is open does not open a second one.
 */
export function useConfirmDiscard(): (proceed: () => void) => void {
  const intl = useIntl();
  const { modal } = App.useApp();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const asking = useRef(false);

  return useCallback((proceed: () => void) => {
    if (!hasUnsavedChanges()) {
      proceed();
      return;
    }
    if (asking.current) return;
    asking.current = true;
    askToLeave(
      intlRef.current,
      modalRef.current,
      () => {
        asking.current = false;
        releaseLeaveGuards();
        proceed();
      },
      () => {
        asking.current = false;
      },
    );
  }, []);
}
