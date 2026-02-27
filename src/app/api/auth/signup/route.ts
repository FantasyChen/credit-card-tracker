import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createVerificationToken } from '@/lib/tokens';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Don't reveal whether the email exists (security best practice)
      // But if the user has a password, they already signed up
      if (existingUser.password) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        );
      }

      // User exists from OAuth but has no password — let them add one
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { email: normalizedEmail },
        data: {
          password: hashedPassword,
          name: name || existingUser.name,
        },
      });

      // If they already verified via OAuth, no need to re-verify
      if (existingUser.emailVerified) {
        return NextResponse.json({
          message: 'Password added to your existing account. You can now sign in with email and password.',
          requiresVerification: false,
        });
      }
    } else {
      // Brand new user
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: name || null,
        },
      });
    }

    // Send verification email
    const token = await createVerificationToken(normalizedEmail);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`;

    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your CouponCycle email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Welcome to CouponCycle!</h1>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Verify Email
          </a>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link in your browser:<br/>
            <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
        </div>
      `,
      text: `Welcome to CouponCycle! Verify your email: ${verifyUrl}`,
    });

    return NextResponse.json({
      message: 'Account created! Please check your email to verify your address.',
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
