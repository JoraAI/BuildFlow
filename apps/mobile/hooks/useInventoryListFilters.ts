/**
 * Sync inventory list filters with expo-router query params (q/status/tab/focus).
 * Params seed local state; typing updates URL via setParams (debounced for q).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

export function useInventoryListFilters(opts?: {
  defaultTab?: string;
  defaultStatus?: string;
}) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string | string[];
    status?: string | string[];
    tab?: string | string[];
    focus?: string | string[];
  }>();

  const paramQ = firstParam(params.q);
  const paramStatus = firstParam(params.status) || opts?.defaultStatus || 'ALL';
  const paramTab = firstParam(params.tab) || opts?.defaultTab || '';
  const paramFocus = firstParam(params.focus);

  const [query, setQueryState] = useState(paramQ);
  const [status, setStatusState] = useState(paramStatus);
  const [tab, setTabState] = useState(paramTab);
  const [focusId, setFocusId] = useState(paramFocus || null);

  const lastApplied = useRef({ q: paramQ, status: paramStatus, tab: paramTab, focus: paramFocus });

  // Seed from URL when inbound params change (cross-nav).
  useEffect(() => {
    const next = { q: paramQ, status: paramStatus, tab: paramTab, focus: paramFocus };
    const prev = lastApplied.current;
    if (next.q !== prev.q) setQueryState(next.q);
    if (next.status !== prev.status) setStatusState(next.status);
    if (next.tab !== prev.tab) setTabState(next.tab);
    if (next.focus !== prev.focus) setFocusId(next.focus || null);
    lastApplied.current = next;
  }, [paramQ, paramStatus, paramTab, paramFocus]);

  const debouncedQuery = useDebouncedValue(query, 300);

  const writeParams = useCallback(
    (patch: { q?: string; status?: string; tab?: string; focus?: string | null }) => {
      const nextQ = patch.q !== undefined ? patch.q : debouncedQuery;
      const nextStatus = patch.status !== undefined ? patch.status : status;
      const nextTab = patch.tab !== undefined ? patch.tab : tab;
      const nextFocus = patch.focus !== undefined ? patch.focus : focusId;

      const payload: Record<string, string | undefined> = {
        q: nextQ.trim() ? nextQ.trim() : undefined,
        status: nextStatus && nextStatus.toUpperCase() !== 'ALL' ? nextStatus : undefined,
        tab: nextTab ? nextTab : undefined,
        focus: nextFocus ? nextFocus : undefined,
      };
      router.setParams(payload as never);
    },
    [debouncedQuery, status, tab, focusId, router],
  );

  useEffect(() => {
    // Wait for the debounce to catch up with the live value, otherwise an
    // inbound param seed (cross-nav) is overwritten by the previous query.
    if (debouncedQuery !== query) return;
    if (debouncedQuery === lastApplied.current.q) return;
    writeParams({ q: debouncedQuery });
    lastApplied.current = { ...lastApplied.current, q: debouncedQuery };
  }, [debouncedQuery, query, writeParams]);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
  }, []);

  const setStatus = useCallback(
    (next: string) => {
      setStatusState(next);
      writeParams({ status: next });
      lastApplied.current = { ...lastApplied.current, status: next };
    },
    [writeParams],
  );

  const setTab = useCallback(
    (next: string) => {
      setTabState(next);
      writeParams({ tab: next, status: 'ALL' });
      setStatusState('ALL');
      lastApplied.current = { ...lastApplied.current, tab: next, status: 'ALL' };
    },
    [writeParams],
  );

  const clearFocus = useCallback(() => {
    setFocusId(null);
    writeParams({ focus: null });
    lastApplied.current = { ...lastApplied.current, focus: '' };
  }, [writeParams]);

  const clearAll = useCallback(() => {
    setQueryState('');
    setStatusState('ALL');
    setFocusId(null);
    writeParams({ q: '', status: 'ALL', focus: null });
    lastApplied.current = {
      q: '',
      status: 'ALL',
      tab: lastApplied.current.tab,
      focus: '',
    };
  }, [writeParams]);

  const isFiltered = useMemo(
    () => Boolean(query.trim()) || (status && status.toUpperCase() !== 'ALL') || Boolean(focusId),
    [query, status, focusId],
  );

  return {
    query,
    setQuery,
    debouncedQuery,
    status,
    setStatus,
    tab,
    setTab,
    focusId,
    clearFocus,
    clearAll,
    isFiltered,
  };
}
