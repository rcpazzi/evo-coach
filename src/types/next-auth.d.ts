import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      garminConnected: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    garminConnected: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    garminConnected?: boolean;
  }
}

export {};
