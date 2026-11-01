import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';
import { type ClientConfigItem, listClientConfig } from '../../services/clientConfig';
import { describeFailure } from '../../session/describe';

/**
 * The registered keys, read when the page opens and again on `reload`. The rows stay on the screen
 * while a read is under way, and the answer of a read that a newer read has overtaken is dropped,
 * so an old answer never replaces a new one. `failure` is the words of the error code, never the
 * backend's own words.
 */
export function useItems() {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const [items, setItems] = useState<ClientConfigItem[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const begin = useLatestCall();

  const reload = useCallback(async () => {
    const isCurrent = begin();
    setLoading(true);
    try {
      const answer = await listClientConfig();
      if (!isCurrent()) return;
      setItems(answer);
      setFailure(null);
    } catch (error) {
      if (!isCurrent()) return;
      setFailure(describeFailure(intlRef.current, error).text);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [begin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, failure, loading, reload: () => void reload() };
}
