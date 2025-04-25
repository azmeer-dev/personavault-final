// app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions, Profile } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";
import TwitchProvider from "next-auth/providers/twitch";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // Use JWT sessions
  session: {
    strategy: "jwt",
  },

  // Custom sign-in page
  pages: {
    signIn: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.password) return null;
        const valid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        return valid ? user : null;
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // ensure we get email in the OAuth response
      authorization: { params: { scope: "openid profile email" } },
      // preserve your merging logic
      allowDangerousEmailAccountLinking: true,
    }),

    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
      }
      if (account?.provider !== "credentials" && profile?.email) {
        token.email = profile.email;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      // on first OAuth sign-in, populate user.name/image if missing
      if (
        account?.provider !== "credentials" &&
        (profile as Profile).name &&
        !user.name
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            name: (profile as Profile).name,
            image: (profile as Profile).image ?? undefined,
          },
        });
      }
      return true;
    },

    // redirect after sign-in
    async redirect() {
      return "/dashboard";
    },
  },

  events: {
    // AFTER the Account row is created/linked, persist the provider's email
    async linkAccount({ account, profile }) {
      if (account.provider === "google" && (profile as Profile).email) {
        await prisma.account.update({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          data: {
            email: (profile as Profile).email,
          },
        });
      }
    },

    // merge newly created OAuth user into existing credentials user
    async createUser({ user }) {
      if (!user.email) return;
      const existing = await prisma.user.findFirst({
        where: {
          email: user.email,
          id: { not: user.id },
        },
      });
      if (existing) {
        if (!existing.name && user.name) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { name: user.name, image: user.image ?? undefined },
          });
        }
        await prisma.account.updateMany({
          where: { userId: user.id },
          data: { userId: existing.id },
        });
        await prisma.user.delete({ where: { id: user.id } });
      }
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
