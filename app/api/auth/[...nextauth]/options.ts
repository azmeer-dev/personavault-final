import { NextAuthOptions, Profile } from "next-auth";
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

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/signin",
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
      authorization: { params: { scope: "openid profile email" } },
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
    // Always issue JWT with the user's email from the User table
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email!;
      }
      return token;
    },

    // Always read email for the session from token.email (i.e. user.email)
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },

    // On first OAuth sign-in, populate user.name/image if missing
    async signIn({ user, account, profile }) {
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
  },

  events: {
    // After linking an OAuth account, persist its email into the account table
    async linkAccount({ account, profile }) {
      if (
        (account.provider === "google" ||
          account.provider === "github" ||
          account.provider === "linkedin" ||
          account.provider === "twitch") &&
        (profile as Profile).email
      ) {
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

    // Merge newly created OAuth user into an existing credentials user if same email
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
