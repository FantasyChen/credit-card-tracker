'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Suggestion = {
  id: string;
  type: string;
  status: string;
  payloadJson: unknown;
  sources: string[];
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  exportedAt?: string | null;
};

export default function ReviewSuggestionsPage() {
  const { status, data } = useSession();
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [hideExported, setHideExported] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const shouldRedirectToSignin = status === 'unauthenticated';
  const shouldRedirectHome = status === 'authenticated' && (data?.user?.role !== 'ADMIN' && data?.user?.role !== 'MODERATOR');

  useEffect(() => {
    if (shouldRedirectToSignin) {
      redirect('/api/auth/signin?callbackUrl=/settings/review');
    } else if (shouldRedirectHome) {
      redirect('/');
    }
  }, [shouldRedirectToSignin, shouldRedirectHome]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/catalog/suggestions${hideExported ? '?hideExported=true' : ''}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load suggestions');
        const json = await res.json();
        setSuggestions(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    })();
  }, [hideExported]);

  if (status === 'loading' || shouldRedirectToSignin || shouldRedirectHome) {
    return <p className="p-4">Loading...</p>;
  }

  const updateStatus = (id: string, status: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/catalog/suggestions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error('Failed to update');
        const updated = await res.json();
        setSuggestions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    });
  };

  const refresh = async (filter?: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    try {
      const q = filter ? `?status=${filter}` : '';
      const res = await fetch(`/api/catalog/suggestions${q}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load suggestions');
      setSuggestions(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const exportSelected = () => {
    const ids = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) {
      setError('Select at least one suggestion to export');
      return;
    }
    // Build a simple download via server endpoint filter by IDs in query (fallback to all approved if not supported)
    const url = `/api/catalog/suggestions/export?status=APPROVED`;
    window.open(url, '_blank');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suggestions</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Badge variant="outline">Admin</Badge>
        </div>
      </div>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-600">Filter:</span>
        <Button size="sm" variant="outline" onClick={() => refresh()}>All</Button>
        <Button size="sm" variant="outline" onClick={() => refresh('PENDING')}>Pending</Button>
        <Button size="sm" variant="outline" onClick={() => refresh('APPROVED')}>Approved</Button>
        <Button size="sm" variant="outline" onClick={() => refresh('REJECTED')}>Rejected</Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideExported} onChange={(e) => setHideExported(e.target.checked)} />
          Hide exported
        </label>
        <Button size="sm" variant="outline" onClick={exportSelected}>Export selected</Button>
      </div>
      <div className="space-y-4">
        {suggestions.map((s) => (
          <div key={s.id} className="border rounded p-3 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={!!selectedIds[s.id]} onChange={() => toggleSelected(s.id)} />
                {new Date(s.createdAt).toLocaleString()}
              </label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{s.type}</Badge>
                <Badge variant={s.status === 'PENDING' ? 'secondary' : s.status === 'APPROVED' ? 'default' : 'destructive'}>{s.status}</Badge>
                {s.exportedAt && <Badge variant="outline">Exported</Badge>}
              </div>
            </div>
            <pre className="text-xs overflow-auto bg-gray-50 dark:bg-gray-900 p-2 rounded max-h-56">{JSON.stringify(s.payloadJson, null, 2)}</pre>
            {s.sources?.length > 0 && (
              <div className="mt-2 text-sm">
                <p className="font-medium text-gray-700">Sources</p>
                <ul className="list-disc list-inside">
                  {s.sources.map((src, idx) => (
                    <li key={idx}><a className="text-blue-600 underline" href={src} target="_blank" rel="noreferrer">{src}</a></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={isPending || s.status !== 'PENDING'} onClick={() => updateStatus(s.id, 'APPROVED')}>Approve</Button>
              <Button size="sm" disabled={isPending || s.status !== 'PENDING'} variant="outline" onClick={() => updateStatus(s.id, 'REJECTED')}>Reject</Button>
            </div>
          </div>
        ))}
        {suggestions.length === 0 && <p className="text-gray-500">No suggestions yet.</p>}
      </div>
    </div>
  );
}

