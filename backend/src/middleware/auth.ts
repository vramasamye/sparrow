import { Request, Response, NextFunction } from 'express'
import { verifyToken, extractTokenFromHeader } from '../utils/jwt'
import { AuthenticatedRequest, UserPayload } from '../types'
import { db } from '../services/database'
import { MemberRole } from '@prisma/client'
import { logger } from '../utils/logger'; // Import logger

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization)
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }

    const decoded = verifyToken(token)
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Ensure decoded is treated as UserPayload which should have an id
    const userPayload = decoded as UserPayload;
    req.user = userPayload; // Attach basic user info

    // If there's a workspaceId in params, fetch the user's role in that workspace
    if (req.params.workspaceId && userPayload.id) {
      try {
        const membership = await db.member.findUnique({
          where: {
            userId_workspaceId: {
              userId: userPayload.id,
              workspaceId: req.params.workspaceId,
            },
          },
          select: { role: true },
        });

        if (membership) {
          req.user.currentWorkspaceRole = membership.role;
        } else {
          req.user.currentWorkspaceRole = null; // User is not a member of this specific workspace
        }
      } catch (dbError) {
        console.error("Error fetching membership role in authMiddleware:", dbError);
        // Decide if this should be a 500 or if we proceed without role (potentially failing later role checks)
        // For now, proceed, role checks will fail if role is null and required.
        req.user.currentWorkspaceRole = null;
      }
    } else {
      // No workspaceId in params, so no specific workspace role to attach
      req.user.currentWorkspaceRole = null;
    }

    next()
  } catch (error) {
    // Log the actual error for server-side debugging
    console.error("Authentication middleware error:", error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

export const roleCheckMiddleware = (requiredRoles: MemberRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.currentWorkspaceRole;

    if (!userRole || !requiredRoles.includes(userRole)) {
      logger.warn(`Role check failed: User ${req.user?.id} with role ${userRole} attempted action requiring one of ${requiredRoles.join(', ')} for workspace ${req.params.workspaceId || 'N/A'}`);
      return res.status(403).json({ error: 'Forbidden: You do not have the required role for this action.' });
    }
    next();
  };
};