import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        benefit: {
          creditCard: {
            user: {
              email: session.user.email,
            },
          },
        },
      },
      include: {
        benefit: {
          include: {
            creditCard: true,
          },
        },
      },
      orderBy: {
        sentAt: 'desc',
      },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
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
    const { type, benefitId } = body;

    const benefit = await prisma.benefit.findUnique({
      where: { id: benefitId },
      include: {
        creditCard: true,
      },
    });

    if (!benefit) {
      return new NextResponse('Benefit not found', { status: 404 });
    }

    const notification = await prisma.notification.create({
      data: {
        type,
        benefitId,
        status: 'PENDING',
      },
    });

    // Send email notification
    const msg = {
      to: session.user.email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: `Credit Card Benefit Update: ${benefit.category}`,
      text: `Your ${benefit.creditCard.name} card has a ${benefit.percentage}% cashback on ${benefit.category} purchases.`,
      html: `
        <h1>Credit Card Benefit Update</h1>
        <p>Your ${benefit.creditCard.name} card has a ${benefit.percentage}% cashback on ${benefit.category} purchases.</p>
        <p>Description: ${benefit.description}</p>
        ${benefit.maxAmount ? `<p>Maximum amount: $${benefit.maxAmount}</p>` : ''}
        <p>Valid from: ${new Date(benefit.startDate).toLocaleDateString()}</p>
        ${benefit.endDate ? `<p>Valid until: ${new Date(benefit.endDate).toLocaleDateString()}</p>` : ''}
      `,
    };

    await sgMail.send(msg);

    // Update notification status
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT' },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 