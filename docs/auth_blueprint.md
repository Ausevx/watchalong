# WatchAlong — Auth & Login Blueprint

> **Status: Blueprint Only** — This document describes *how* auth will be implemented when ready. No code exists yet.

---

## Recommended Stack

| Component | Technology | Notes |
|---|---|---|
| **Library** | **NextAuth.js (Auth.js v5)** | Framework-agnostic, encrypted JWT sessions by default |
| **Session Strategy** | **JWT (default)** | Stateless, no DB lookup per request; stored in HTTP-only cookie |
| **Password Hashing** | **bcrypt** (cost factor 12+) | Salted and slow by design |
| **OAuth Providers** | Google, GitHub, Discord | One-click social login |
| **Database Adapter** | **Prisma Adapter** | Stores accounts, users, sessions if DB strategy is chosen later |

---

## Auth Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │────▶│  NextAuth    │────▶│  Provider    │
│   (browser)  │     │  API Route   │     │  (Google,    │
│              │◀────│  /api/auth/* │◀────│   GitHub)    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │ Prisma DB     │
                    │ (user record) │
                    └───────────────┘
```

### Email/Password Flow
1. User submits email + password on signup form
2. Server hashes password with bcrypt → stores in DB
3. On login, compare hash → issue JWT (access token)
4. JWT stored in HTTP-only, Secure, SameSite cookie
5. Short-lived access token (15 min) + refresh token (7 days)

### OAuth Flow
1. User clicks "Sign in with Google"
2. NextAuth redirects to provider → user authorizes
3. Provider callback → NextAuth creates/links user in DB
4. JWT session issued

---

## Prisma Schema (Auth Models)

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?           // null for OAuth-only users
  accounts      Account[]
  sessions      Session[]
  rooms         Room[]            // rooms this user created
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Security Checklist

- [ ] HTTPS enforced in production
- [ ] Passwords hashed with bcrypt (cost ≥ 12)
- [ ] JWT in HTTP-only, Secure, SameSite=Strict cookies
- [ ] Access tokens expire in 15 minutes
- [ ] Refresh tokens expire in 7 days, single-use rotation
- [ ] CSRF protection via SameSite cookies + NextAuth built-in
- [ ] Rate limiting on `/api/auth/*` routes (e.g., 10 req/min)
- [ ] Input validation & sanitization on signup/login forms
- [ ] OAuth uses PKCE flow where supported

---

## NextAuth.js Config (Pseudocode)

```js
// src/app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import bcrypt from "bcrypt"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({ clientId: "...", clientSecret: "..." }),
    GitHubProvider({ clientId: "...", clientSecret: "..." }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        if (user && await bcrypt.compare(credentials.password, user.password)) {
          return user
        }
        return null
      }
    })
  ],
  callbacks: {
    jwt: async ({ token, user }) => { /* attach user id */ },
    session: async ({ session, token }) => { /* attach id to session */ },
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

---

## Implementation Steps (When Ready)

1. `npm install next-auth @auth/prisma-adapter bcrypt`
2. Add provider env vars to `.env.local`
3. Create `src/app/api/auth/[...nextauth]/route.js`
4. Add Prisma auth models + run migration
5. Create signup page with form + bcrypt hashing
6. Create login page (credentials + social buttons)
7. Wrap app with `SessionProvider`
8. Protect room creation routes with `getServerSession()`
9. Add rate limiting middleware
10. Test OAuth flow + credentials flow end-to-end
