'use client';

export default function OfflineActions() {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Try again
      </button>

      <button
        type="button"
        onClick={() => {
          window.location.href = '/';
        }}
        className="group relative flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Go to homepage
      </button>
    </div>
  );
}
