'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PredefinedBenefit = {
  id: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number | null;
  frequency: string;
  cycleAlignment?: string | null;
  occurrencesInCycle: number;
};

type PredefinedCard = {
  id: string;
  name: string;
  issuer: string;
  annualFee: number;
  imageUrl?: string | null;
  benefits?: PredefinedBenefit[];
};

export default function SuggestPage() {
  const { status } = useSession();
  const params = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const defaultType = (params.get('type') as string) || 'ADD_CARD';
  const defaultCardName = params.get('cardName') || '';
  const defaultIssuer = params.get('issuer') || '';

  // Local form state for friendly UI
  const [type, setType] = useState<string>(defaultType);
  const [cards, setCards] = useState<PredefinedCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [cardName, setCardName] = useState<string>(defaultCardName);
  const [issuer, setIssuer] = useState<string>(defaultIssuer);
  const [annualFee, setAnnualFee] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [benefitCategory, setBenefitCategory] = useState<string>('');
  const [benefitDescription, setBenefitDescription] = useState<string>('');
  const [benefitPercentage, setBenefitPercentage] = useState<string>('');
  const [benefitMaxAmount, setBenefitMaxAmount] = useState<string>('');
  const [benefitFrequency, setBenefitFrequency] = useState<string>('ONE_TIME');
  const [benefitCycleAlignment, setBenefitCycleAlignment] = useState<string>('CARD_ANNIVERSARY');
  const [benefitOccurrences, setBenefitOccurrences] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Load predefined cards for convenience
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoadingCards(true);
        const res = await fetch('/api/predefined-cards-with-benefits');
        if (!res.ok) throw new Error('Failed to load cards');
        const data = (await res.json()) as PredefinedCard[];
        if (!cancelled) setCards(data);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoadingCards(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedCard = useMemo(() => cards.find(c => c.id === selectedCardId), [cards, selectedCardId]);
  useEffect(() => {
    if (!selectedCardId && defaultCardName && defaultIssuer && cards.length > 0) {
      const match = cards.find(c => c.name === defaultCardName && c.issuer === defaultIssuer);
      if (match) setSelectedCardId(match.id);
    }
  }, [cards, defaultCardName, defaultIssuer, selectedCardId]);

  function buildPayload(): unknown {
    switch (type) {
      case 'ADD_CARD':
        return { name: cardName, issuer, annualFee: annualFee ? Number(annualFee) : undefined, imageUrl: imageUrl || undefined };
      case 'EDIT_CARD':
        return {
          match: selectedCard ? { name: selectedCard.name, issuer: selectedCard.issuer } : { name: cardName, issuer },
          changes: { annualFee: annualFee ? Number(annualFee) : undefined, imageUrl: imageUrl || undefined },
        };
      case 'ADD_BENEFIT':
        return {
          card: selectedCard ? { name: selectedCard.name, issuer: selectedCard.issuer } : { name: cardName, issuer },
          benefit: {
            category: benefitCategory,
            description: benefitDescription,
            percentage: benefitPercentage ? Number(benefitPercentage) : 0,
            maxAmount: benefitMaxAmount ? Number(benefitMaxAmount) : null,
            frequency: benefitFrequency,
            cycleAlignment: benefitCycleAlignment,
            occurrencesInCycle: benefitOccurrences ? Number(benefitOccurrences) : 1,
          },
        };
      case 'EDIT_BENEFIT':
        return {
          card: selectedCard ? { name: selectedCard.name, issuer: selectedCard.issuer } : { name: cardName, issuer },
          match: { description: benefitDescription },
          changes: {
            category: benefitCategory || undefined,
            description: benefitDescription || undefined,
            percentage: benefitPercentage ? Number(benefitPercentage) : undefined,
            maxAmount: benefitMaxAmount ? Number(benefitMaxAmount) : undefined,
            frequency: benefitFrequency || undefined,
            cycleAlignment: benefitCycleAlignment || undefined,
            occurrencesInCycle: benefitOccurrences ? Number(benefitOccurrences) : undefined,
          },
        };
      case 'DEPRECATE_CARD':
        return { card: selectedCard ? { name: selectedCard.name, issuer: selectedCard.issuer } : { name: cardName, issuer }, reason: reason || undefined, effectiveDate: effectiveDate || undefined };
      case 'DEPRECATE_BENEFIT':
        return { card: selectedCard ? { name: selectedCard.name, issuer: selectedCard.issuer } : { name: cardName, issuer }, benefit: { description: benefitDescription }, reason: reason || undefined, effectiveDate: effectiveDate || undefined };
      case 'IMAGE_UPDATE':
        return { card: selectedCard ? { name: selectedCard.name, issuer: selectedCard.issuer } : { name: cardName, issuer }, imageUrl };
      default:
        return {};
    }
  }

  if (status === 'loading') return <p className="p-4">Loading...</p>;
  if (status === 'unauthenticated') redirect('/api/auth/signin?callbackUrl=/settings/suggest');

  async function submit(formData: FormData) {
    setIsSubmitting(true);
    setMessage(null);
    setErrorDetails(null);
    const type = formData.get('type') as string; // legacy form field; we use state
    const sources = (formData.get('sources') as string || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    try {
      const payloadJson = buildPayload();
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
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded p-2">
            <option>ADD_CARD</option>
            <option>EDIT_CARD</option>
            <option>ADD_BENEFIT</option>
            <option>EDIT_BENEFIT</option>
            <option>DEPRECATE_CARD</option>
            <option>DEPRECATE_BENEFIT</option>
            <option>IMAGE_UPDATE</option>
          </select>
        </div>

        {/* Card selection / manual entry */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(type !== 'ADD_CARD') && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Select a card</label>
              <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} className="w-full border rounded p-2">
                <option value="">-- Choose from catalog (optional) --</option>
                {isLoadingCards && <option>Loading cards...</option>}
                {!isLoadingCards && cards.map(c => (
                  <option key={c.id} value={c.id}>{c.issuer} — {c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Or type below if not listed.</p>
            </div>
          )}
          {(type === 'ADD_CARD' || !selectedCard) && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Card Name</label>
                <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Chase Sapphire Preferred" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Issuer</label>
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Chase" />
              </div>
            </>
          )}
          {(type === 'ADD_CARD' || type === 'EDIT_CARD') && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Annual Fee (optional)</label>
                <Input value={annualFee} onChange={(e) => setAnnualFee(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="95" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Image URL (optional)</label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://.../image.png" />
              </div>
            </>
          )}
        </div>

        {(type === 'ADD_BENEFIT' || type === 'EDIT_BENEFIT' || type === 'DEPRECATE_BENEFIT') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {type !== 'DEPRECATE_BENEFIT' && (
              <div>
                <label className="block text-sm font-medium mb-1">Benefit Category</label>
                <Input value={benefitCategory} onChange={(e) => setBenefitCategory(e.target.value)} placeholder="Dining / Travel / ..." />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Benefit Description</label>
              <Input value={benefitDescription} onChange={(e) => setBenefitDescription(e.target.value)} placeholder="3x points on dining" />
            </div>
            {type !== 'DEPRECATE_BENEFIT' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Percentage (e.g., 3 for 3x)</label>
                  <Input value={benefitPercentage} onChange={(e) => setBenefitPercentage(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="3" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Amount (optional)</label>
                  <Input value={benefitMaxAmount} onChange={(e) => setBenefitMaxAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Frequency</label>
                  <select value={benefitFrequency} onChange={(e) => setBenefitFrequency(e.target.value)} className="w-full border rounded p-2">
                    <option>ONE_TIME</option>
                    <option>MONTHLY</option>
                    <option>QUARTERLY</option>
                    <option>YEARLY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cycle Alignment</label>
                  <select value={benefitCycleAlignment} onChange={(e) => setBenefitCycleAlignment(e.target.value)} className="w-full border rounded p-2">
                    <option>CARD_ANNIVERSARY</option>
                    <option>CALENDAR_FIXED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Occurrences In Cycle</label>
                  <Input value={benefitOccurrences} onChange={(e) => setBenefitOccurrences(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1" />
                </div>
              </>
            )}
          </div>
        )}

        {(type === 'DEPRECATE_CARD' || type === 'DEPRECATE_BENEFIT') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Reason</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Product discontinued / Terms update ..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Effective Date (optional)</label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Sources (one per line)</label>
          <textarea name="sources" className="w-full border rounded p-2 text-sm min-h-24" placeholder="https://issuer.com/benefit-terms\nhttps://news.example.com/change" />
          <p className="mt-1 text-xs text-gray-500">Max 10 sources. Must be valid URLs.</p>
        </div>
        <div className="flex items-center gap-2">
          <input id="preview" type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />
          <label htmlFor="preview" className="text-sm">Show JSON preview</label>
        </div>
        {showPreview && (
          <pre className="w-full border rounded p-2 font-mono text-xs bg-gray-50 dark:bg-gray-900 overflow-auto max-h-60">{JSON.stringify(buildPayload(), null, 2)}</pre>
        )}

        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Suggestion'}</Button>
      </form>
    </div>
  );
}

