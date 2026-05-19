import { NextAuthOptions, DefaultSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getCanonicalAuthUrl, getSharedCookieDomain } from './site';
import { enrollBetaUser, getEffectiveTier, isBetaMode } from './subscription';

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: 'USER' | 'MODERATOR' | 'ADMIN';
      subscriptionTier?: 'FREE' | 'PRO';
      isBetaUser?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: 'USER' | 'MODERATOR' | 'ADMIN';
    subscriptionTier?: 'FREE' | 'PRO';
    storedSubscriptionTier?: 'FREE' | 'PRO';
    isBetaUser?: boolean;
  }
}

const canonicalNextAuthUrl = getCanonicalAuthUrl(process.env.NEXTAUTH_URL);

// NextAuth reads NEXTAUTH_URL internally when constructing OAuth redirect_uri.
// Keep production OAuth callbacks on the registered canonical www host even if
// the deployment environment is set to the apex domain.
if (canonicalNextAuthUrl) {
  process.env.NEXTAUTH_URL = canonicalNextAuthUrl;
}

const sharedCookieDomain = getSharedCookieDomain(canonicalNextAuthUrl);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        if (!user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  // Share session cookie across subdomains (www, loyalty, apex) in production
  cookies:
    process.env.NODE_ENV === 'production' &&
    sharedCookieDomain
      ? {
          sessionToken: {
            name: `__Secure-next-auth.session-token`,
            options: {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              secure: true,
              domain: sharedCookieDomain,
            },
          },
          callbackUrl: {
            name: `__Secure-next-auth.callback-url`,
            options: {
              sameSite: 'lax',
              path: '/',
              secure: true,
              domain: sharedCookieDomain,
            },
          },
        }
      : undefined,
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allow redirects to loyalty subdomain (same app, shared auth)
      if (process.env.NEXTAUTH_URL) {
        try {
          const base = new URL(process.env.NEXTAUTH_URL);
          base.hostname = base.hostname.replace(/^(www\.)?/, 'loyalty.');
          if (url.startsWith(base.origin)) return url;
        } catch {
          // ignore
        }
      }
      if (url.startsWith('http://loyalty.localhost')) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      if (!token.role || !token.storedSubscriptionTier || !('isBetaUser' in token)) {
        try {
          const dbUser = await prisma.user.findUnique({ 
            where: { id: token.id as string }, 
            select: { role: true, subscriptionTier: true, isBetaUser: true } 
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.storedSubscriptionTier = dbUser.subscriptionTier;
            token.subscriptionTier = getEffectiveTier(dbUser);
            token.isBetaUser = dbUser.isBetaUser;
          }
        } catch {
          // ignore
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      if (token.role) {
        session.user.role = token.role;
      }
      if (token.storedSubscriptionTier) {
        session.user.subscriptionTier = getEffectiveTier({
          subscriptionTier: token.storedSubscriptionTier,
          isBetaUser: Boolean(token.isBetaUser),
        });
      }
      if ('isBetaUser' in token) {
        session.user.isBetaUser = token.isBetaUser;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Enroll new OAuth users as beta users when beta mode is active
      if (isBetaMode() && user.id) {
        await enrollBetaUser(user.id);
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
}; 
