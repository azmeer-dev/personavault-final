import { prisma } from "@/lib/prisma"; // Ensure prisma is correctly imported if not already.
// app/api/auth/[...nextauth]/options.ts
import {
  NextAuthOptions,
  //Session, 
} from "next-auth";
//import { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { createAuditLog } from '@/lib/audit'; // Added
import { AuditActorType, AuditLogOutcome } from '@prisma/client'; // Added
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
    async signIn(params) {
      const {user, account} = params
      const isNewUser = (params as { isNewUser?: boolean }).isNewUser ?? false;
      // Added account, profile, isNewUser
      console.log("NextAuth signIn callback:", { userEmail: user?.email, provider: account?.provider, isNewUser });

      if (user && user.id) {
        try {
          await createAuditLog({
            actorType: AuditActorType.USER,
            actorUserId: user.id,
            action: isNewUser ? "USER_SIGNUP_SUCCESS" : "USER_LOGIN_SUCCESS",
            targetEntityType: "User",
            targetEntityId: user.id,
            outcome: AuditLogOutcome.SUCCESS,
            details: { 
              provider: account?.provider, // account might be null for credentials
              email: user.email, 
              isNewUser: isNewUser === true 
            }
          });
        } catch (auditError) {
          console.error("Audit log failed in signIn callback:", auditError);
          // Do not block sign-in if audit log fails
        }
      } else {
        console.warn("Audit Log for signIn: User ID not available in signIn callback, skipping audit log.");
      }
      
      return true; // Default to allow sign-in
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
    async linkAccount({ user, account, profile }) { // Added user
      // only care about Google
      if (account.provider === "google" && profile?.email) {
        // Ensure user object and its id are available for linking, might need to fetch if not directly provided
        // This event runs AFTER a successful sign-in or OAuth link.
        // The user object here should be the NextAuth user object.
        if (user && user.id) {
            await prisma.account.updateMany({ // Use updateMany if emailFromProvider is not unique
              where: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  userId: user.id // Ensure we are updating the correct user's account
              },
              data: {
                emailFromProvider: profile.email,
              },
            });
            // Audit for account linking
            await createAuditLog({
                actorType: AuditActorType.USER,
                actorUserId: user.id,
                action: "ACCOUNT_LINKED",
                targetEntityType: "Account",
                targetEntityId: account.providerAccountId, // Using providerAccountId as a reference
                outcome: AuditLogOutcome.SUCCESS,
                details: { provider: account.provider, linkedEmail: profile.email }
            });
        } else {
            console.warn("Audit Log for linkAccount: User ID not available, skipping audit log for account link.");
        }
      }
    },
    async signOut({ token }) { // token contains JWT payload, session is the client session
      if (token && token.id) { // Use token.id as per how it's set in the jwt callback
        try {
          await createAuditLog({
            actorType: AuditActorType.USER,
            actorUserId: token.id as string,
            action: "USER_LOGOUT_SUCCESS",
            targetEntityType: "User",
            targetEntityId: token.id as string,
            outcome: AuditLogOutcome.SUCCESS,
            details: { email: token.email } // Email from token
          });
        } catch (auditError) {
            console.error("Audit log failed in signOut event:", auditError);
        }
      } else {
          console.warn("Audit Log for signOut: User ID (token.id) not available, skipping audit log.");
      }
    }
  },
};
