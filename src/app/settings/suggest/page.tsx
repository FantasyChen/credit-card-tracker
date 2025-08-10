'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SuggestPage() {
  const { status } = useSession();
  const params = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const defaultType = params.get('type') || 'ADD_CARD';
  const defaultCardName = params.get('cardName') || '';
  const defaultIssuer = params.get('issuer') || '';

  if (status === 'loading') return <p className="p-4">Loading...</p>;
  if (status === 'unauthenticated') redirect('/api/auth/signin?callbackUrl=/settings/suggest');

  async function submit(formData: FormData) {
    setIsSubmitting(true);
    setMessage(null);
    setErrorDetails(null);
    const type = formData.get('type') as string;
    const sources = (formData.get('sources') as string || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const payloadJsonStr = formData.get('payloadJson') as string;

    try {
      const payloadJson = JSON.parse(payloadJsonStr);
      const res = await fetch('/api/catalog/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payloadJson, sources }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorDetails(typeof j === 'object' ? JSON.stringify(j, null, 2) : null);
        throw new Error(j.error || 'Failed to submit');
      }
      setMessage('Thanks! Your suggestion was submitted.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Suggest a Catalog Update</h1>
      {message && (
        <p className={`mb-2 text-sm ${message.toLowerCase().includes('thanks') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
      )}
      {errorDetails && (
        <pre className="mb-2 p-2 text-xs bg-red-50 border border-red-200 rounded text-red-800 whitespace-pre-wrap overflow-auto max-h-40">{errorDetails}</pre>
      )}
      <form action={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select name="type" defaultValue={defaultType} className="w-full border rounded p-2">
            <option>ADD_CARD</option>
            <option>EDIT_CARD</option>
            <option>ADD_BENEFIT</option>
            <option>EDIT_BENEFIT</option>
            <option>DEPRECATE_CARD</option>
            <option>DEPRECATE_BENEFIT</option>
            <option>IMAGE_UPDATE</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Payload (JSON)</label>
          <textarea
            name="payloadJson"
            className="w-full border rounded p-2 font-mono text-sm min-h-48"
            defaultValue={JSON.stringify({ name: defaultCardName, issuer: defaultIssuer }, null, 2)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sources (one per line)</label>
          <textarea name="sources" className="w-full border rounded p-2 text-sm min-h-24" placeholder="https://issuer.com/benefit-terms\nhttps://news.example.com/change" />
          <p className="mt-1 text-xs text-gray-500">Max 10 sources. Must be valid URLs.</p>
        </div>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Suggestion'}</Button>
      </form>
    </div>
  );
}

