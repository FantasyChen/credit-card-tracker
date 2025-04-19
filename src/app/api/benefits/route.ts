import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const benefits = await prisma.benefit.findMany({
      where: {
        creditCard: {
          user: {
            email: session.user.email,
          },
        },
      },
      include: {
        creditCard: true,
      },
    });

    return NextResponse.json(benefits);
  } catch (error) {
    console.error('Error fetching benefits:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const {
      category,
      description,
      percentage,
      maxAmount,
      startDate,
      endDate,
      creditCardId,
    } = body;

    const benefit = await prisma.benefit.create({
      data: {
        category,
        description,
        percentage,
        maxAmount,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        creditCard: {
          connect: {
            id: creditCardId,
          },
        },
      },
    });

    return NextResponse.json(benefit);
  } catch (error) {
    console.error('Error creating benefit:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 