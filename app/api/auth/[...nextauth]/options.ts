import { prisma } from "@/lib/prisma"; // Ensure prisma is correctly imported if not already.
// app/api/auth/[...nextauth]/options.ts
import {
  NextAuthOptions,
  //Session,
} from "next-auth";
//import { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { createAuditLog } from "@/lib/audit"; // Added
import { AuditActorType, AuditLogOutcome } from "@prisma/client"; // Added
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";
import TwitchProvider from "next-auth/providers/twitch";
import bcrypt from "bcrypt";
import {
  GitHubEmail,
  GitHubProfile,
  TwitchProfile,
} from "@/types/providerTypes";

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
            name: dbUser.globalDisplayName || dbUser.legalFullName || null,
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
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: { params: { scope: "read:user user:email" } },
      allowDangerousEmailAccountLinking: true,
      async profile(profile: GitHubProfile, tokens) {
        let email = profile.email ?? null;

        // Fetch verified primary email if missing
        if (!email && tokens?.access_token) {
          try {
            const res = await fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `token ${tokens.access_token}`,
                Accept: "application/vnd.github+json",
              },
            });

            if (res.ok) {
              const emails: GitHubEmail[] = await res.json();
              const primary = emails.find(
                (e) => e.primary === true && e.verified === true
              );
              if (primary) email = primary.email;
            }
          } catch (err) {
            console.error("Failed to fetch GitHub user emails:", err);
          }
        }

        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email,
          image: profile.avatar_url ?? null,
        };
      },
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID ?? "",
      clientSecret: process.env.TWITCH_CLIENT_SECRET ?? "",
      authorization: { params: { scope: "openid user:read:email" } },
      allowDangerousEmailAccountLinking: true,
      profile(profile: TwitchProfile) {
        return {
          id: profile.sub, // Twitch unique ID
          name: profile.preferred_username ?? null, // Twitch username
          email: profile.email ?? null, // requires user:read:email
          image: profile.picture ?? null, // Twitch avatar
        };
      },
    }),
  ],
  callbacks: {
    async signIn(params) {
      const { user, account } = params;
      const isNewUser = (params as { isNewUser?: boolean }).isNewUser ?? false;
      // Added account, profile, isNewUser
      console.log("NextAuth signIn callback:", {
        userEmail: user?.email,
        provider: account?.provider,
        isNewUser,
      });

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
              isNewUser: isNewUser === true,
            },
          });
        } catch (auditError) {
          console.error("Audit log failed in signIn callback:", auditError);
          // Do not block sign-in if audit log fails
        }
      } else {
        console.warn(
          "Audit Log for signIn: User ID not available in signIn callback, skipping audit log."
        );
      }

      return true; // Default to allow sign-in
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
      }

      // Always pull fresh values from DB
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            globalDisplayName: true,
            legalFullName: true,
            globalProfileImage: true,
          },
        });

        if (dbUser) {
          token.name =
            dbUser.globalDisplayName || dbUser.legalFullName || token.name;
          token.image = dbUser.globalProfileImage || token.image;
        }
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
    async linkAccount({ user, account, profile }) {
      if (!user?.id) {
        console.warn(
          "Audit Log for linkAccount: User ID not available, skipping audit log."
        );
        return;
      }

      let linkedEmail: string | null = null;
      let linkedName: string | null = null;

      if (account.provider === "google" && profile && "email" in profile) {
        linkedEmail = (profile as { email?: string | null }).email ?? null;
        linkedName =
          "name" in profile
            ? (profile as { name?: string | null }).name ?? null
            : null;
      } else if (account.provider === "github") {
        const ghProfile = profile as unknown as GitHubProfile; // safe narrowing
        linkedEmail = ghProfile.email ?? null;
        linkedName = ghProfile.name || ghProfile.login;
      } else if (account.provider === "twitch") {
        const twitchProfile = profile as unknown as TwitchProfile;
        linkedEmail = twitchProfile.email ?? null;
        linkedName = twitchProfile.preferred_username ?? null;
      }

      if (linkedEmail || linkedName) {
        await prisma.account.updateMany({
          where: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            userId: user.id,
          },
          data: {
            emailFromProvider: linkedEmail,
          },
        });

        await createAuditLog({
          actorType: AuditActorType.USER,
          actorUserId: user.id,
          action: "ACCOUNT_LINKED",
          targetEntityType: "Account",
          targetEntityId: account.providerAccountId,
          outcome: AuditLogOutcome.SUCCESS,
          details: {
            provider: account.provider,
            linkedEmail,
            linkedName,
          },
        });
      }
    },

    async signOut({ token }) {
      // token contains JWT payload, session is the client session
      if (token && token.id) {
        // Use token.id as per how it's set in the jwt callback
        try {
          await createAuditLog({
            actorType: AuditActorType.USER,
            actorUserId: token.id as string,
            action: "USER_LOGOUT_SUCCESS",
            targetEntityType: "User",
            targetEntityId: token.id as string,
            outcome: AuditLogOutcome.SUCCESS,
            details: { email: token.email }, // Email from token
          });
        } catch (auditError) {
          console.error("Audit log failed in signOut event:", auditError);
        }
      } else {
        console.warn(
          "Audit Log for signOut: User ID (token.id) not available, skipping audit log."
        );
      }
    },
  },
};
