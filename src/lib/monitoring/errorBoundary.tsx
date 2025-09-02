/**
 * Enhanced Error Boundary with logging and user-friendly error display
 */

'use client';

import React from 'react';
import { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Enhanced Error Boundary with structured logging
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = generateErrorId();
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = generateErrorId();

    // Log structured error information
    const errorLog = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      timestamp: new Date().toISOString(),
      userId: this.getUserId(),
    };

    // Log to console for development
    console.error('Error Boundary caught an error:', errorLog);

    // Send to monitoring service (implement based on your monitoring solution)
    this.reportError(errorLog);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      errorInfo,
      errorId,
    });
  }

  private getUserId(): string | null {
    // Try to get user ID from session storage or other client-side storage
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('userId') || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private async reportError(errorLog: Record<string, unknown>) {
    try {
      // Send to your monitoring endpoint
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorLog),
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorId: string | null;
  onRetry: () => void;
}

function ErrorFallback({ error, errorId, onRetry }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We apologize for the inconvenience. The error has been automatically reported.
          </p>
          
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-left">
              <h3 className="text-sm font-medium text-red-800">Error Details (Development Only)</h3>
              <p className="mt-2 text-sm text-red-700 font-mono">{error.message}</p>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <button
            onClick={onRetry}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try again
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go to homepage
          </button>
          
          {errorId && (
            <p className="text-xs text-gray-500 text-center">
              Error ID: {errorId}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `err_${timestamp}_${randomStr}`;
}

/**
 * Hook for handling async errors in components
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: Record<string, unknown>) => {
    const errorId = generateErrorId();
    const errorLog = {
      errorId,
      message: error.message,
      stack: error.stack,
      additionalInfo: errorInfo,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    console.error('Async error caught:', errorLog);

    // Report to monitoring service
    fetch('/api/monitoring/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorLog),
    }).catch(console.error);
  };
}
