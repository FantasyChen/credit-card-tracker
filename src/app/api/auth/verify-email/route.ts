import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    if (verificationToken.expires < new Date()) {
      await prisma.emailVerificationToken.delete({ where: { id: verificationToken.id } });
      return NextResponse.json({ error: 'Token has expired' }, { status: 400 });
    }

    await prisma.user.update({
      where: { email: verificationToken.email },
      data: { emailVerified: new Date() },
    });

    await prisma.emailVerificationToken.delete({ where: { id: verificationToken.id } });

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
