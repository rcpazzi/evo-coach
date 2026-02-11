import bcrypt from "bcrypt";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

type AuthenticatedUser = {
  id: string;
  email: string;
  garminConnected: boolean;
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return {
          id: String(user.id),
          email: user.email,
          garminConnected: user.garminConnected,
        } satisfies AuthenticatedUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as AuthenticatedUser;
        token.userId = authenticatedUser.id;
        token.email = authenticatedUser.email;
        token.garminConnected = authenticatedUser.garminConnected;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.email =
          typeof token.email === "string" ? token.email : session.user.email;
        session.user.garminConnected = Boolean(token.garminConnected);
      }

      return session;
    },
  },
};
