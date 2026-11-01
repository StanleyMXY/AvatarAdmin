import { useCallback, useEffect, useState } from 'react';
import { useFailure } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
import { type ClientConfigItem, listClientConfig } from '../../services/clientConfig';

/**
 * The registered keys, read when the page opens and again on `reload`. The rows stay on the screen
 * while a read is under way, and the answer of a read that a newer read has overtaken is dropped,
 * so an old answer never replaces a new one. `failure` is the words of the error code, never the
 * backend's own words.
 */
export function useItems() {
  const [items, setItems] = useState<ClientConfigItem[] | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const [loading, setLoading] = useState(true);
  const begin = useLatestCall();

  const reload = useCallback(async () => {
    const isCurrent = begin();
    setLoading(true);
    try {
      const answer = await listClientConfig();
      if (!isCurrent()) return;
      setItems(answer);
      clear();
    } catch (error) {
      if (!isCurrent()) return;
      fail(error);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [begin, clear, fail]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, failure, loading, reload: () => void reload() };
}
