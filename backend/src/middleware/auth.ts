import { Request, Response, NextFunction } from 'express'
import { verifyToken, extractTokenFromHeader } from '../utils/jwt'
import { AuthenticatedRequest } from '../types'

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization)
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }

    const decoded = verifyToken(token)
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}