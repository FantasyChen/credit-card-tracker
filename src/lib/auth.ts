import { NextAuthOptions, DefaultSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import GoogleProvider from 'next-auth/providers/google';

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's id. */
      id: string;
    } & DefaultSession["user"]; // Add id to the default user type
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** OpenID ID Token */
    id: string; // Add id to the JWT type
  }
}

export const authOptions: NextAuthOptions = {
  // Ensure the adapter is configured correctly, especially if it uses the User model
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    // Add the user ID to the JWT in the jwt callback
    // The user parameter is only passed on sign-in
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // Persist the user id from the User model to the token
      }
      return token;
    },
    // Add the user ID from the token to the session
    async session({ session, token }) {
      // token.id is available because we added it in the jwt callback
      session.user.id = token.id; 
      return session; // Return the session object with the id included
    },
  },
  debug: process.env.NODE_ENV === 'development',
}; 