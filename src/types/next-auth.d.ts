import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      id: string
      email: string
      username: string
      name?: string | null
      avatar?: string | null
    }
  }

  interface User {
    id: string
    email: string
    username: string
    name?: string | null
    avatar?: string | null
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    avatar?: string | null
    accessToken?: string
  }
}