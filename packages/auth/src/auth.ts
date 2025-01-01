import { betterAuth, BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@plura/db";
import { multiSession } from "better-auth/plugins";

const BaseDomain = process.env.NODE_ENV === "production" ? process.env.API_DOMAIN as string : "http://localhost:3001";

export const auth = betterAuth({
  trustedOrigins: [
    "https://www.plura.pro",
    "http://localhost:3004",
    "https://app.plura.pro",
    "http://localhost:3003",
  ],
  baseURL: BaseDomain,
  basePath: "/v1/auth",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [multiSession()],
  user: {
    additionalFields:{
      isOnboarding: {
        type: "boolean",
        nullable:false,
        required:true,
        input:false,
        defaultValue: false
      },
      role : {
        type : "string",
        nullable : false,
        required : true,
        input : false,
        defaultValue : "user"
      }
    }
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  ...(process.env.NODE_ENV === "production" && {
    advanced: {
      crossSubDomainCookies: {
        enabled: true,
        domain: "plura.pro",
      },
    },
  }),
});

export type Session = typeof auth.$Infer.Session;
