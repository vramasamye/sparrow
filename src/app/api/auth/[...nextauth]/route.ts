import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        name: { label: 'Name', type: 'text', optional: true }
      },
      async authorize(credentials) {
        if (!credentials?.email) return null

        try {
          console.log('Attempting auth with backend:', BACKEND_URL)
          
          // Try to login first
          const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          console.log('Login response status:', loginRes.status)

          if (loginRes.ok) {
            const data = await loginRes.json()
            console.log('Login successful')
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              username: data.user.username,
              accessToken: data.token
            }
          }

          // If login fails, try to register (for development)
          console.log('Login failed, trying registration')
          const registerRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              name: credentials.name || credentials.email.split('@')[0],
              username: credentials.email.split('@')[0],
            }),
          })

          console.log('Register response status:', registerRes.status)

          if (registerRes.ok) {
            const data = await registerRes.json()
            console.log('Registration successful')
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              username: data.user.username,
              accessToken: data.token
            }
          } else {
            const errorText = await registerRes.text()
            console.log('Registration failed:', errorText)
          }

          return null
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken
        token.username = user.username
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.user.username = token.username
      session.user.id = token.sub
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
})

export { handler as GET, handler as POST }