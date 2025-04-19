import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function GET() {
  try {
    // Get all active benefits
    const benefits = await prisma.benefit.findMany({
      where: {
        startDate: {
          lte: new Date(),
        },
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } },
        ],
      },
      include: {
        creditCard: {
          include: {
            user: true,
          },
        },
        notifications: true,
      },
    });

    for (const benefit of benefits) {
      // Check if notification was already sent
      const lastNotification = benefit.notifications[0];
      const shouldSendNotification =
        !lastNotification ||
        (lastNotification.type === 'QUARTERLY' &&
          new Date().getTime() - lastNotification.sentAt.getTime() >
            90 * 24 * 60 * 60 * 1000) ||
        (lastNotification.type === 'MONTHLY' &&
          new Date().getTime() - lastNotification.sentAt.getTime() >
            30 * 24 * 60 * 60 * 1000) ||
        (lastNotification.type === 'YEARLY' &&
          new Date().getTime() - lastNotification.sentAt.getTime() >
            365 * 24 * 60 * 60 * 1000);

      if (shouldSendNotification) {
        // Create notification
        const notification = await prisma.notification.create({
          data: {
            type: 'QUARTERLY',
            benefitId: benefit.id,
            status: 'PENDING',
          },
        });

        // Send email
        const msg = {
          to: benefit.creditCard.user.email!,
          from: process.env.SENDGRID_FROM_EMAIL!,
          subject: `Credit Card Benefit Reminder: ${benefit.category}`,
          text: `Your ${benefit.creditCard.name} card has a ${benefit.percentage}% cashback on ${benefit.category} purchases.`,
          html: `
            <h1>Credit Card Benefit Reminder</h1>
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
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in cron job:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 