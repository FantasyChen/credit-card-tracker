import { NextResponse } from 'next/server';

export async function GET() {
  const analyticsId = process.env.GOOGLE_ANALYTICS_ID;
  
  return NextResponse.json({
    analyticsId,
    hasAnalytics: !!analyticsId,
    message: analyticsId ? 'Google Analytics is configured' : 'Google Analytics is not configured'
  });
}
