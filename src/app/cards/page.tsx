import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Helper function to get month name
const getMonthName = (monthNumber: number | null): string => {
  if (monthNumber === null || monthNumber < 1 || monthNumber > 12) return 'N/A';
  const date = new Date();
  date.setMonth(monthNumber - 1);
  return date.toLocaleString('en-US', { month: 'long' });
};

// Helper function to format Date as "Month Year" or return 'N/A'
const formatOpenedDate = (date: Date | null): string => {
  if (!date) return 'N/A';
  // Ensure it's a Date object (Prisma might return string)
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'N/A'; // Invalid date
  return dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default async function UserCardsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // Redirect to login if not authenticated
    redirect('/api/auth/signin?callbackUrl=/cards');
  }

  // Fetch the user's cards, including benefits
  const userCards = await prisma.creditCard.findMany({
    where: { userId: session.user.id },
    include: {
      benefits: true, // Include benefits associated with the card
    },
    orderBy: {
      createdAt: 'desc', // Show newest cards first
    },
  });

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Cards</h1>
        <Link href="/cards/new" className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition duration-200">
          Add New Card
        </Link>
      </div>

      {userCards.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">
          <p>You haven't added any cards yet.</p>
          <Link href="/cards/new" className="text-blue-600 hover:underline mt-2 inline-block">
            Add your first card!
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userCards.map((card) => (
            <div key={card.id} className="border rounded-lg p-4 shadow-md bg-white">
              <h2 className="text-xl font-semibold mb-2">{card.name}</h2>
              <p className="text-gray-600 mb-1">Issuer: {card.issuer}</p>
              {/* Display Opened Date if available */}
              {card.openedDate && (
                 <p className="text-sm text-gray-500 mb-3">Opened: {formatOpenedDate(card.openedDate)}</p>
              )}

              {/* Optionally display benefits */}
              {card.benefits.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <h3 className="text-md font-medium mb-2">Key Benefits:</h3>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {card.benefits.slice(0, 3).map(benefit => ( // Show first 3 benefits
                      <li key={benefit.id}>{benefit.description}</li>
                    ))}
                    {card.benefits.length > 3 && <li>...and more</li>}
                  </ul>
                </div>
              )}

              {/* Add placeholder for future actions like View Details or Remove */}
              <div className="mt-4 text-right">
                 <button disabled className="text-xs text-gray-400 cursor-not-allowed">View Details</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 