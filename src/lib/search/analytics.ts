/**
 * Search analytics and tracking utilities
 * Provides insights into search performance and user behavior
 */

interface SearchAnalyticsData {
  query: string;
  resultCount: number;
  searchTime: number;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Track search analytics (client-side)
 */
export function trackSearch(query: string, resultCount: number, searchTime: number) {
  // Only track in production or when explicitly enabled
  if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_ENABLE_ANALYTICS) {
    return;
  }

  const analyticsData: SearchAnalyticsData = {
    query: query.trim().toLowerCase(),
    resultCount,
    searchTime,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
  };

  // Send to analytics endpoint
  fetch('/api/search/analytics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(analyticsData),
  }).catch(error => {
    // Silently fail analytics tracking
    console.debug('Analytics tracking failed:', error);
  });
}

/**
 * Get search performance metrics
 */
export function getSearchPerformanceMetrics() {
  return {
    averageSearchTime: 0, // Would be calculated from analytics data
    popularQueries: [], // Would come from analytics
    searchSuccessRate: 0, // Would be calculated
  };
}

/**
 * Debounced search tracking to avoid spam
 */
export function createDebouncedSearchTracker(delay: number = 1000) {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastQuery = '';

  return (query: string, resultCount: number, searchTime: number) => {
    // Clear previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Only track if query changed
    if (query !== lastQuery) {
      lastQuery = query;
      
      timeoutId = setTimeout(() => {
        trackSearch(query, resultCount, searchTime);
      }, delay);
    }
  };
}
