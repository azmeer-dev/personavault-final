import { prisma } from "@/lib/prisma";
// app/api/auth/[...nextauth]/options.ts
import {
  NextAuthOptions,
  //Session, // Kept for completeness
} from "next-auth";
//import { JWT } from "next-auth/jwt"; // Kept for completeness
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";
import TwitchProvider from "next-auth/providers/twitch";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
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
        const dbUser = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!dbUser || !dbUser.passwordHash) return null;

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          dbUser.passwordHash
        );

        if (isValidPassword) {
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.legalFullName || dbUser.globalDisplayName || null,
            image: dbUser.globalProfileImage || null,
          };
        }
        return null;
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
    async signIn({ user }) {
      console.log(user);

      // If this is a Google login…
      // if (account?.provider === "google" && profile?.email) {
      //   // Check if that email is exists in your Account table
      //   const acct = await prisma.account.findFirst({
      //     where: { emailFromProvider: profile.email },
      //   });

      //   if (!acct) {
      //     //check if user uses this email as credential if it is not in Account Table
      //     const userAcct = await prisma.user.findFirst({
      //       where: { email: profile.email },
      //     });
      //     if (!userAcct) return false;
      //   }
      // }
      // Allow credentials logins and known Google users
      return true;
    },

    async jwt({ token, user, account, profile }) {
      //cehck if email is in account tbale
      if (user && account?.provider === "google") {
        const acct = await prisma.account.findFirst({
          where: { emailFromProvider: user.email },
        });

        //if exixsts in account table, retriev User info
        if (acct) {
          const userAcct = await prisma.user.findFirst({
            where: { email: user.email || "" },
          });

          token.id = userAcct?.id;
          token.email = userAcct?.email;
          token.name = userAcct?.globalDisplayName || userAcct?.legalFullName;
          token.image = userAcct?.globalProfileImage;
        }

        //if does not in account table, check if user with same email exists
        else if (!acct) {
          //check if user uses this email as credential if it is not in Account Table
          const userAcct = await prisma.user.findFirst({
            where: { email: user.email || "" },
          });

          //email exists in user table
          if (userAcct) {
            //create new Account entry and link to User table
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              update: {
                userId: userAcct.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                id_token: account.id_token,
                emailFromProvider: user.email,
              },
              create: {
                userId: userAcct.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                id_token: account.id_token,
                emailFromProvider: user.email,
              },
            });
            //use google data to update missing values in User Table
            await prisma.user.update({
              where: { id: userAcct?.id },
              data: {
                globalProfileImage: profile?.image,
                globalDisplayName: profile?.name,
              },
            });

            //finally set token
            token.id = userAcct?.id;
            token.email = userAcct?.email;
            token.name = userAcct?.globalDisplayName || userAcct?.legalFullName;
            token.image = userAcct?.globalProfileImage;
          }
        }
      } else if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string | null | undefined;
        session.user.name = token.name as string | null | undefined;
        session.user.image = token.image as string | null | undefined;
      }
      return session;
    },
  },
  events: {
    async linkAccount({ account, profile }) {
      // only care about Google
      if (account.provider === "google" && profile?.email) {
        await prisma.account.update({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          data: {
            emailFromProvider: profile.email,
          },
        });
      }
    },
  },
};
