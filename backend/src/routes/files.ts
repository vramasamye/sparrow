import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../services/database';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router({ mergeParams: true }); // To get :workspaceId if nested

const UPLOAD_DIR = path.join(__dirname, '../../uploads'); // Adjusted path relative to src/routes
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req: AuthenticatedRequest, file, cb) {
    const userId = req.user?.id || 'unknown_user';
    const uniqueSuffix = Date.now() + '_' + userId;
    // Sanitize originalname: remove special characters, limit length if necessary
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, uniqueSuffix + '_' + safeOriginalName);
  }
});

// General public viewer for files, e.g., avatars, using the unique filename stored in User.avatar
// GET /api/files/view-public/:uniqueFilename
// (Assuming this router is mounted at /api/files by server.ts for this route)
router.get('/view-public/:uniqueFilename', async (req, res) => { // No auth middleware for this specific route for public assets like avatars
  try {
    const { uniqueFilename } = req.params;

    // For avatars, they might be in a subfolder like 'uploads/avatars/' or mixed with other uploads.
    // The 'uniqueFilename' should be unique enough.
    // We don't fetch Attachment record here to keep it simple and fast for public assets.
    // This means mimetype needs to be inferred or set to a common default for images.

    // Try to infer mimetype from extension for safety, or default to 'image/png', 'image/jpeg'
    // This is a simplified version. A proper solution would store mimetype with avatar if not using Attachment model for avatars.
    let mimetype = 'application/octet-stream'; // Default
    const ext = path.extname(uniqueFilename).toLowerCase();
    if (['.jpg', '.jpeg'].includes(ext)) mimetype = 'image/jpeg';
    else if (ext === '.png') mimetype = 'image/png';
    else if (ext === '.gif') mimetype = 'image/gif';
    else if (ext === '.webp') mimetype = 'image/webp';
    // For this example, let's assume avatars are primarily images.

    const filePath = path.join(UPLOAD_DIR, uniqueFilename); // Check main uploads
    const avatarFilePath = path.join(UPLOAD_DIR, 'avatars', uniqueFilename); // Or check avatars subfolder

    let finalPathToServe: string | null = null;

    if (fs.existsSync(avatarFilePath)) {
        finalPathToServe = avatarFilePath;
    } else if (fs.existsSync(filePath)) { // Fallback to main uploads dir if not in avatars
        finalPathToServe = filePath;
    }

    if (finalPathToServe) {
      res.setHeader('Content-Type', mimetype);
      // For avatars, usually not downloaded with original name, so Content-Disposition might not be needed.
      // If original filename is needed, it should be part of User.avatar or fetched from an Attachment record.
      const fileStream = fs.createReadStream(finalPathToServe);
      fileStream.pipe(res);
    } else {
      // logger.warn(`Public file not found on disk: ${uniqueFilename}`); // Use logger if available
      console.warn(`Public file not found on disk: ${uniqueFilename}`);
      return res.status(404).json({ error: 'File not found.' });
    }

  } catch (error) {
    // logger.error('Public file serving error:', error);
    console.error('Public file serving error:', error);
    res.status(500).json({ error: 'Failed to serve file.' });
  }
});

// New route for general avatar uploads (not workspace-scoped for the upload action itself)
// POST /api/files/upload-avatar (assuming this router is mounted at /api/files)
router.post('/upload-avatar', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const uploaderId = req.user!.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // For avatars, we might want different validation (e.g., only image types, smaller size limit)
    // The current `upload` middleware uses a general fileFilter and sizeLimit.
    // If specific avatar validation is needed, a new multer instance would be better.
    // For now, using the same 'upload' instance. Ensure its filter allows common image types.

    // The `Attachment` record for an avatar might not need a workspaceId,
    // or it could be null, as avatars are user-centric.
    // However, creating an Attachment record might be overkill if we only need the URL.
    // Let's simplify: this endpoint just saves the file and returns its URL.
    // The User.avatar field will store this URL directly. No new Attachment record for avatar.

    const avatarUrl = `/uploads/avatars/${req.file.filename}`; // Path relative to backend serving static files or a specific route

    // Ensure the 'avatars' subdirectory exists in UPLOAD_DIR
    const AVATAR_UPLOAD_DIR = path.join(UPLOAD_DIR, 'avatars');
    if (!fs.existsSync(AVATAR_UPLOAD_DIR)) {
      fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
    }
    // Move file to avatars subfolder if multer saved it to main UPLOAD_DIR
    // OR, configure a separate multer instance for avatars.
    // For simplicity, let's assume multer is configured to save avatars to `uploads/avatars/` directly
    // This would require a new multer instance with a different destination.

    // Let's refine: Create a new multer instance for avatars.
    const avatarStorage = multer.diskStorage({
      destination: function (req, file, cb) {
        const userAvatarDir = path.join(UPLOAD_DIR, 'avatars'); // Store all avatars in a subfolder
        if (!fs.existsSync(userAvatarDir)) {
          fs.mkdirSync(userAvatarDir, { recursive: true });
        }
        cb(null, userAvatarDir);
      },
      filename: function (req: AuthenticatedRequest, file, cb) {
        const userId = req.user?.id || 'unknown_user';
        const uniqueSuffix = Date.now() + '_' + userId;
        const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, uniqueSuffix + '_' + safeOriginalName);
      }
    });
    const avatarUpload = multer({
        storage: avatarStorage,
        fileFilter: (req, file, cb) => { // Stricter filter for images
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type. Only JPG, PNG, GIF, WEBP images are allowed for avatars.'));
            }
        },
        limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for avatars
    });

    // Need to re-run multer processing with the new instance. This is tricky.
    // It's better to define this as a separate route with its own multer middleware.
    // The current structure has one router instance.

    // **Simplification for this step:**
    // The client will use the existing `/api/workspaces/:workspaceId/files/upload`
    // and the returned `attachment.url` (which is just the filename) will be used.
    // The frontend will then construct a path like `/api/files/view/${filename}` for display,
    // and this URL will be saved to User.avatar.
    // The `files.ts` already has `/view/:uniqueFilename`.
    // So, no new backend upload endpoint is strictly needed *if* the client can provide a dummy/any workspaceId
    // or if we make workspaceId optional on the existing upload endpoint for avatar purposes.

    // **Decision:** For this iteration, we will assume the client uses the existing file upload.
    // The client will then take the `url` (filename) from the response and save that to the User.avatar field
    // via the PUT /api/users/profile endpoint.
    // The `avatar` field on `User` model is just a `String?` to store this URL/filename.
    // The file serving endpoint `/api/files/view/:uniqueFilename` will serve it.
    // This means `Attachment` records *will* be created for avatars. This is acceptable.
    // The `workspaceId` on such an `Attachment` might be null or a specific one, depending on how client calls.
    // This simplifies the backend changes for this step.

    // Therefore, no new backend *upload* route is created in this step.
    // The mechanism relies on:
    // 1. Client using existing file uploader (e.g. POST /api/workspaces/:workspaceId/files/upload) to upload avatar.
    //    (Client needs to handle which workspaceId to use, or we adjust that endpoint to make workspaceId optional).
    // 2. Client gets back attachment.url (the unique filename).
    // 3. Client calls PUT /api/users/profile with { avatar: uniqueFilename }.
    // This step is then mostly about documenting this flow and ensuring the existing pieces support it.
    // The `PUT /api/users/profile` already accepts `avatar` string.

    // Let's ensure the generic file upload `POST /api/workspaces/:workspaceId/files/upload`
    // can have `workspaceId` made optional or a new non-workspace-scoped generic uploader added.
    // A new, simpler, non-workspace-scoped uploader is cleaner for avatars.

    // **Revised Action:** Add a new simple route POST /api/files/upload-public for general, non-workspace files like avatars.
    // This new route will save to a public-ish subfolder like 'uploads/public/' or 'uploads/avatars/'.
    // It will NOT create an Attachment record, just return the URL/filename.

    // This is becoming complex. Let's stick to the plan's original simpler idea:
    // "Client uploads avatar using a general file upload mechanism ... returns URL ... Client calls PUT /api/users/profile".
    // This implies the "general file upload mechanism" is the one we built: POST /api/workspaces/:workspaceId/files/upload.
    // The client will need *some* workspaceId to make this call. This isn't ideal for user-global avatars.

    // **Final Decision for this Step (keeping it minimal for "Partial Backend"):**
    // No new avatar-specific *upload* endpoint.
    // The client will use the existing `/api/workspaces/:workspaceId/files/upload`.
    // It's the client's responsibility to pick a relevant `workspaceId` for the upload context if needed by that API.
    // The `Attachment` record will be created.
    // The `attachment.url` (which is the unique filename) is then sent via `PUT /api/users/profile` to update `User.avatar`.
    // The existing `GET /api/files/view/:uniqueFilename` (scoped under `/api/workspaces/:workspaceId/files/` or a general `/api/files/`) will serve it.
    // This means this backend step requires no new code, only confirming the existing pieces can be used this way.
    // The crucial part is that `User.avatar` stores a string that can be resolved by the file serving endpoint.

    // The current file serving endpoint is `/api/workspaces/:workspaceId/files/view/:uniqueFilename`.
    // If User.avatar stores just `uniqueFilename`, the client needs to know which `workspaceId` context that avatar was uploaded under.
    // This is problematic for a global avatar.

    // **True Simplification:** The `User.avatar` field should store a complete, resolvable URL.
    // If we use our local serving, it should be `/api/files/view/uniqueFilename_of_avatar` (assuming a general file viewer not tied to workspace in path).
    // This means we need a general file upload that doesn't require workspaceId in path and a general viewer.

    // Let's add `POST /api/files/upload-image` (general image uploader, not workspace specific in path)
    // and ensure `/api/files/view/:filename` is also general.

    // This step is "Conceptual & Partial Backend". The main work is ensuring PUT /profile accepts avatar URL.
    // The actual upload mechanism can reuse existing /files/upload if client provides a workspace context,
    // or a new simplified one can be added if truly global avatars are desired.
    // For now, the plan implies using existing mechanisms and just updating User.avatar.
    // No new code for this specific step if we assume client orchestrates:
    // 1. Upload to existing endpoint (gets a URL like `unique-name.jpg`).
    // 2. PUT /profile with `avatar: "unique-name.jpg"`.
    // 3. Frontend constructs full view URL: `/api/workspaces/SOME_WORKSPACE_ID/files/view/unique-name.jpg` OR `/api/files/view/unique-name.jpg` if we add a general viewer.

    // Let's assume for now User.avatar stores the unique filename, and a general viewer `/api/files/view/:filename` will be used.
    // This means the file serving route in `files.ts` should be mounted generally, not under workspace.
    logger.info("Conceptual step for Avatar Upload Mechanism: Relies on client to upload avatar using a file upload endpoint (e.g., existing one or a new general one not built in this specific step), obtain a URL/filename, and then update User.avatar via PUT /api/users/profile. The main backend work for this step was ensuring PUT /api/users/profile accepts an avatar string.");
    res.status(200).json({ message: "Avatar update mechanism relies on client orchestration with existing file upload and profile update endpoints."});

  } catch (error) {
    logger.error('Avatar mechanism conceptual error (should not happen in this dummy route):', error);
    res.status(500).json({ error: 'Server error regarding avatar mechanism concept.' });
  }
});

// Multer file filter (example: allow common image types and PDFs, check size)
const fileFilter = (req: AuthenticatedRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain',
    // Add more as needed based on REQ-021 (common document formats)
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and common documents are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});


// POST /api/workspaces/:workspaceId/files/upload
router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const { workspaceId } = req.params; // If route is /api/workspaces/:workspaceId/files/upload
    const uploaderId = req.user!.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Verify user is part of the workspace (if workspaceId is used)
    if (workspaceId) {
        const membership = await db.member.findUnique({
            where: { userId_workspaceId: { userId: uploaderId, workspaceId } }
        });
        if (!membership) {
            // If file was saved by multer, attempt to delete it
            fs.unlink(req.file.path, (err) => {
                if (err) logger.error(`Failed to delete orphaned file: ${req.file?.path}`, err);
            });
            return res.status(403).json({ error: 'User is not a member of this workspace.' });
        }
    }


    const attachment = await db.attachment.create({
      data: {
        filename: req.file.originalname, // Original filename for display
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: req.file.filename, // The unique filename generated by multer
        uploaderId,
        workspaceId: workspaceId || null, // Handle if workspaceId is optional or not part of route
      },
      include: {
        uploader: { select: { id: true, username: true, name: true } }
      }
    });

    logger.info(`File uploaded: ${attachment.filename} by user ${uploaderId} to workspace ${workspaceId || 'none'}`);
    res.status(201).json({ attachment });

  } catch (error: any) {
    logger.error('File upload error:', error);
    // If multer throws an error (e.g., file too large), it might have a specific structure
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.` });
        }
        return res.status(400).json({ error: `Multer error: ${error.message}` });
    }
    if (error.message.startsWith('Invalid file type')) {
        return res.status(415).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to upload file.' });
  }
});

// GET /api/workspaces/:workspaceId/files/view/:fileIdentifier
// (or /api/files/view/:fileIdentifier if workspaceId not needed for auth here, but it's good for scoping)
// For simplicity, let's make a general /api/files/view/:fileIdentifier and auth within.
// The frontend currently constructs `/api/files/view/${attachment.url}`
// So, the route should be /api/files/view/:uniqueFilename
// Let's adjust the router base path in server.ts later if needed, or add a new top-level router for /api/files.
// For now, let's assume this router is mounted at /api/files and the :workspaceId part is not used for this GET.

router.get('/view/:uniqueFilename', async (req: AuthenticatedRequest, res) => {
  try {
    const { uniqueFilename } = req.params;
    const userId = req.user!.id;
    const download = req.query.download === 'true';

    // Fetch attachment details from DB to get mimetype, original filename, and verify access
    const attachment = await db.attachment.findFirst({ // Assuming url stores the uniqueFilename
      where: { url: uniqueFilename },
      include: {
        message: { // To check if user has access via message context
          include: {
            channel: { include: { members: { where: { userId } } } },
            // For DMs:
            // user: true, // sender
            // recipient: true
          }
        },
        workspace: { include: { members: { where: { userId } } } } // To check if user has access via workspace
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'File not found or attachment record missing.' });
    }

    // Authorization logic:
    // User must be uploader OR part of the workspace OR part of the channel/DM the message (if any) is in.
    let authorized = false;
    if (attachment.uploaderId === userId) {
      authorized = true;
    } else if (attachment.workspaceId && attachment.workspace?.members.length > 0) {
      authorized = true; // User is member of the workspace attachment is scoped to
    } else if (attachment.message) {
      if (attachment.message.channelId && attachment.message.channel?.members.length > 0) {
        authorized = true; // User is member of the channel the message is in
      } else if (attachment.message.recipientId) { // DM
        if (attachment.message.userId === userId || attachment.message.recipientId === userId) {
          authorized = true; // User is part of the DM
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'You are not authorized to access this file.' });
    }

    const filePath = path.join(UPLOAD_DIR, attachment.url); // attachment.url is the unique filename

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', attachment.mimetype);
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      }
      // For better performance with large files, use streams:
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      // res.sendFile(filePath); // Simpler for smaller files, but less performant
    } else {
      logger.error(`File not found on disk: ${filePath} for attachment ID: ${attachment.id}`);
      return res.status(404).json({ error: 'File not found on server.' });
    }

  } catch (error) {
    logger.error('File serving error:', error);
    res.status(500).json({ error: 'Failed to serve file.' });
  }
});


export default router;
