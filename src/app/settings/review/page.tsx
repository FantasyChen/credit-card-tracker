'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

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

  if (status === 'loading') {
    return <p className="p-4">Loading...</p>;
  }
  if (status === 'unauthenticated') {
    redirect('/api/auth/signin?callbackUrl=/settings/review');
  }
  if (data?.user?.role !== 'ADMIN' && data?.user?.role !== 'MODERATOR') {
    redirect('/');
  }

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
      <h1 className="text-2xl font-bold mb-4">Suggestion Review</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="mb-3 flex gap-2 items-center">
        <span className="text-sm text-gray-600">Filter:</span>
        <Button variant="outline" onClick={() => refresh()}>All</Button>
        <Button variant="outline" onClick={() => refresh('PENDING')}>Pending</Button>
        <Button variant="outline" onClick={() => refresh('APPROVED')}>Approved</Button>
        <Button variant="outline" onClick={() => refresh('REJECTED')}>Rejected</Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideExported} onChange={(e) => setHideExported(e.target.checked)} />
          Hide exported
        </label>
        <Button variant="outline" onClick={exportSelected}>Export selected</Button>
      </div>
      <div className="space-y-4">
        {suggestions.map((s) => (
          <div key={s.id} className="border rounded p-4 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!selectedIds[s.id]} onChange={() => toggleSelected(s.id)} />
                Select
              </label>
              {s.exportedAt && <span className="text-xs text-gray-500">Exported: {new Date(s.exportedAt).toLocaleString()}</span>}
            </div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-gray-500">{new Date(s.createdAt).toLocaleString()}</p>
                <p className="font-medium">{s.type}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${s.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : s.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{s.status}</span>
            </div>
            <pre className="text-xs overflow-auto bg-gray-50 dark:bg-gray-900 p-2 rounded max-h-64">{JSON.stringify(s.payloadJson, null, 2)}</pre>
            {s.sources?.length > 0 && (
              <div className="mt-2 text-sm">
                <p className="font-semibold">Sources:</p>
                <ul className="list-disc list-inside">
                  {s.sources.map((src, idx) => (
                    <li key={idx}><a className="text-blue-600 underline" href={src} target="_blank" rel="noreferrer">{src}</a></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button disabled={isPending || s.status !== 'PENDING'} onClick={() => updateStatus(s.id, 'APPROVED')}>Approve</Button>
              <Button disabled={isPending || s.status !== 'PENDING'} variant="outline" onClick={() => updateStatus(s.id, 'REJECTED')}>Reject</Button>
            </div>
          </div>
        ))}
        {suggestions.length === 0 && <p className="text-gray-500">No suggestions yet.</p>}
      </div>
    </div>
  );
}

