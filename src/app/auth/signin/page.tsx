'use client';

import React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Authentication Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error === 'OAuthSignin' && 'Error in OAuth sign in process'}
                  {error === 'OAuthCallback' && 'Error in OAuth callback process'}
                  {error === 'OAuthCreateAccount' && 'Could not create OAuth account'}
                  {error === 'EmailCreateAccount' && 'Could not create email account'}
                  {error === 'Callback' && 'Error in the OAuth callback handler'}
                  {error === 'OAuthAccountNotLinked' && 'Email already exists with different provider'}
                  {error === 'EmailSignin' && 'Check your email address'}
                  {error === 'CredentialsSignin' && 'Sign in failed. Check your credentials'}
                  {error === 'Default' && 'An error occurred during sign in'}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mt-8 space-y-6">
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </React.Suspense>
  );
} 