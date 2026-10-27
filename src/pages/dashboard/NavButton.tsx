import { history } from '@umijs/max';
import { Button } from 'antd';
import type { MouseEvent, ReactNode } from 'react';

/** A link that looks like a button and opens the page inside the app (the browser's own handling stays for new-tab clicks). */
export function NavButton({
  to,
  children,
  type = 'default',
}: {
  to: string;
  children: ReactNode;
  type?: 'default' | 'link';
}) {
  const go = (event: MouseEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    history.push(to);
  };
  return (
    <Button type={type} href={to} onClick={go}>
      {children}
    </Button>
  );
}
