// src/utils/displayUtils.ts

export const DEFAULT_AVATAR_PATH = '/default-avatar.png'; // Path to a default avatar in /public

/**
 * Constructs the URL for a user's avatar.
 * Assumes avatarFilename is either a full URL or just the unique filename.
 * If it's just a filename, it constructs a path to the public file viewer.
 * @param avatarFilenameOrUrl The avatar filename or full URL from User.avatar
 * @returns The full URL to display the avatar, or a default path.
 */
export const getAvatarUrl = (avatarFilenameOrUrl?: string | null): string => {
  if (!avatarFilenameOrUrl) {
    return DEFAULT_AVATAR_PATH;
  }
  if (avatarFilenameOrUrl.startsWith('http://') || avatarFilenameOrUrl.startsWith('https://')) {
    return avatarFilenameOrUrl; // It's already a full URL
  }
  // Assuming it's a unique filename that our public file viewer can serve
  return `/api/public-files/view/${avatarFilenameOrUrl}`;
};

/**
 * Generates initials from a name or username.
 * @param name The user's full name.
 * @param username The user's username.
 * @returns A string of 1 or 2 initials, or 'U' if no name/username.
 */
export const getInitials = (name?: string | null, username?: string | null): string => {
  let initials = '';
  if (name) {
    const parts = name.split(' ');
    initials = parts[0][0] || '';
    if (parts.length > 1) {
      initials += parts[parts.length - 1][0] || '';
    }
  } else if (username) {
    initials = username[0] || '';
  }
  return initials.toUpperCase() || 'U';
};
