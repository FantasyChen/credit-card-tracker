'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component
import { Input } from '@/components/ui/input';   // Assuming you have an Input component
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DataManagementPage() {
  const { status } = useSession();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition(); // For form submission state

  // Handle redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/settings/data');
    }
  }, [status, router]); // router is stable but included for completeness

  // Handle loading state for session
  if (status === 'loading') {
    return <p className="text-center mt-10">Loading session...</p>;
  }

  // Show loading while redirecting
  if (status === 'unauthenticated') {
    return <p className="text-center mt-10">Redirecting to sign in...</p>;
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setImportMessage(null); // Clear previous messages
      setImportErrors([]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setImportMessage('Please select a JSON file to import.');
      return;
    }

    setIsImporting(true);
    setImportMessage('Importing...');
    setImportErrors([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/user-cards/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setImportMessage(`Import failed: ${result.message || 'Unknown error'}`);
        if (result.errors && Array.isArray(result.errors)) {
           setImportErrors(result.errors);
        }
      } else {
        setImportMessage(result.message || 'Import successful!');
        setImportErrors(result.errors || []); // Display any non-fatal errors/warnings from backend
        // Clear the file input visually by resetting the form or input value if needed
        // For simplicity, we just clear the state file variable:
        setFile(null);
        // You might need to manually clear the input element value:
        // const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
        // if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Import fetch error:', error);
      setImportMessage('An error occurred during import. Please check the console.');
      setImportErrors([]);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Data Management</h1>

      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Your Data, Your Control</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          We believe you should always own and control your data. You can export your added credit card list at any time.
          You can also import a previously exported file to restore your list.
        </p>
      </div>

      {/* Export Section */}
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Export Your Data</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Download a JSON file containing your list of added credit cards and their opening dates.
        </p>
        <Button variant="outline" asChild>
          <a href="/api/user-cards/export" download>Download My Data</a>
        </Button>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Import Data</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Upload a previously exported JSON file (`couponcycle_data_*.json`) to add cards to your account.
          Existing cards with the same name, issuer, and opening date will be skipped.
        </p>
        <div className="space-y-4">
          <Input
            id="import-file-input" // Added ID for potential clearing
            type="file"
            accept=".json"
            onChange={handleFileChange}
            disabled={isImporting || isPending}
            className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/20 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/30"
            key={file ? 'file-selected' : 'no-file'} // Force re-render on file state change to clear visually
          />
          <Button
            onClick={() => startTransition(() => handleImport())} // Wrap handler in startTransition
            disabled={!file || isImporting || isPending}
          >
            {isPending ? 'Processing...' : isImporting ? 'Importing...' : 'Import Selected File'}
          </Button>
          {importMessage && (
            <p className={`text-sm ${importErrors.length > 0 || importMessage.toLowerCase().includes('fail') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {importMessage}
            </p>
          )}
          {importErrors.length > 0 && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-md">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Import Errors:</h3>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                {importErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 