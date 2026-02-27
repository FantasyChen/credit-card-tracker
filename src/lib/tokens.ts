import { prisma } from './prisma';
import crypto from 'crypto';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createVerificationToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete any existing tokens for this email
  await prisma.emailVerificationToken.deleteMany({
    where: { email },
  });

  await prisma.emailVerificationToken.create({
    data: { email, token, expires },
  });

  return token;
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.deleteMany({
    where: { email },
  });

  await prisma.passwordResetToken.create({
    data: { email, token, expires },
  });

  return token;
}
