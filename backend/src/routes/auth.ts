import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../services/database'
import { generateToken } from '../utils/jwt'
import { logger } from '../utils/logger'

const router = Router()

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, name } = req.body

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username, and password are required' })
    }

    // Check if user exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email or username already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await db.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        createdAt: true
      }
    })

    // Generate token
    const token = generateToken(user)

    logger.info(`User registered: ${user.username}`)

    res.status(201).json({
      success: true,
      token,
      user
    })
  } catch (error) {
    logger.error('Registration error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name
    })

    logger.info(`User logged in: ${user.username}`)

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name
      }
    })
  } catch (error) {
    logger.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Verify token (for frontend to check if token is still valid)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const { verifyToken } = await import('../utils/jwt')
    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Get fresh user data
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true
      }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    res.json({
      success: true,
      user
    })
  } catch (error) {
    logger.error('Token verification error:', error)
    res.status(401).json({ error: 'Token verification failed' })
  }
})

export default router