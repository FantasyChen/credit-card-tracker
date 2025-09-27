'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { trackSearch } from '@/lib/search/analytics';

interface SearchResult {
  card: {
    id: string;
    name: string;
    issuer: string;
    annualFee: number;
    benefits: Array<{
      id: string;
      category: string;
      description: string;
      maxAmount: number;
    }>;
  };
  score: number;
  matchedFields: string[];
}

interface SearchInputProps {
  onSearch: (query: string, results: SearchResult[]) => void;
  placeholder?: string;
  className?: string;
  showSuggestions?: boolean;
  debounceMs?: number;
}

interface SearchSuggestion {
  text: string;
  type: 'issuer' | 'category' | 'term';
}

export default function SearchInput({
  onSearch,
  placeholder = "Search cards, issuers, benefits...",
  className = "",
  showSuggestions = true,
  debounceMs = 300
}: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestionList, setShowSuggestionList] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionListRef = useRef<HTMLDivElement>(null);
  
  const debouncedQuery = useDebounce(query, debounceMs);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!showSuggestions || query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/search?type=suggestions`);
      if (response.ok) {
        const data = await response.json();
        const filteredSuggestions = data.suggestions
          .filter((suggestion: string) => 
            suggestion.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 8) // Limit to 8 suggestions
          .map((suggestion: string) => ({
            text: suggestion,
            type: 'term' as const,
          }));
        
        setSuggestions(filteredSuggestions);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, [query, showSuggestions]);

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      onSearch('', []);
      return;
    }

    setIsLoading(true);
    const startTime = performance.now();
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=hybrid`);
      const endTime = performance.now();
      const searchTime = Math.round(endTime - startTime);
      
      if (response.ok) {
        const data = await response.json();
        
        // Track search analytics
        trackSearch(searchQuery, data.results.length, searchTime);
        
        onSearch(searchQuery, data.results);
      } else {
        console.error('Search failed:', response.statusText);
        trackSearch(searchQuery, 0, searchTime);
        onSearch(searchQuery, []);
      }
    } catch (error) {
      console.error('Search error:', error);
      const endTime = performance.now();
      const searchTime = Math.round(endTime - startTime);
      trackSearch(searchQuery, 0, searchTime);
      onSearch(searchQuery, []);
    } finally {
      setIsLoading(false);
    }
  }, [onSearch]);

  // Handle debounced search
  useEffect(() => {
    if (debouncedQuery !== query) return;
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch, query]);

  // Handle suggestions
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestionList || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          const selectedSuggestion = suggestions[selectedSuggestionIndex];
          setQuery(selectedSuggestion.text);
          setShowSuggestionList(false);
          setSelectedSuggestionIndex(-1);
          performSearch(selectedSuggestion.text);
        }
        break;
      case 'Escape':
        setShowSuggestionList(false);
        setSelectedSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestionList(value.length >= 2);
    setSelectedSuggestionIndex(-1);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestionList(false);
    setSelectedSuggestionIndex(-1);
    performSearch(suggestion.text);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionListRef.current &&
        !suggestionListRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestionList(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestionList(query.length >= 2)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
        
        {/* Search/loading icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestionList && suggestions.length > 0 && (
        <div
          ref={suggestionListRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.text}-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                index === selectedSuggestionIndex ? 'bg-indigo-50 dark:bg-indigo-900' : ''
              }`}
            >
              <div className="flex items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
                  {suggestion.type === 'issuer' ? '🏦' : 
                   suggestion.type === 'category' ? '🏷️' : '🔍'}
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {suggestion.text}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search tips */}
      {query.length > 0 && query.length < 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 text-xs text-gray-500 dark:text-gray-400">
          Type at least 2 characters to see suggestions
        </div>
      )}
    </div>
  );
}
