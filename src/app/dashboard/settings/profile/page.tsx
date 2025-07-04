'use client'

import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation'; // For redirecting if not authenticated
import EmojiPicker from '@/components/ui/emoji-picker';

interface UserProfile {
  id: string;
  username: string;
  name?: string | null;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  pronouns?: string | null;
  customStatusText?: string | null;
  customStatusEmoji?: string | null;
  createdAt: string;
  members?: Array<{workspace?: {id: string}}>;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for editing
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for custom status editing
  const [customStatusText, setCustomStatusText] = useState('');
  const [customStatusEmoji, setCustomStatusEmoji] = useState('');
  const [showStatusEmojiPicker, setShowStatusEmojiPicker] = useState(false);
  const statusEmojiPickerButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (profile) { // Initialize form data and status when profile loads, not just on edit toggle
      setFormData({
        name: profile.name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        jobTitle: profile.jobTitle || "",
        pronouns: profile.pronouns || "",
        avatar: profile.avatar
      });
      setCustomStatusText(profile.customStatusText || '');
      setCustomStatusEmoji(profile.customStatusEmoji || '');
    }
    if (profile && isEditing) { // When entering edit mode specifically
      setNewAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [profile, isEditing]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token') || session.accessToken; // Adjust based on actual token storage
        const response = await fetch('/api/users/profile', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch profile');
        }
        const data = await response.json();
        setProfile(data.user);
      } catch (err: any) {
        setError(err.message);
        console.error("Fetch profile error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Loading profile...</p>
        {/* Add a spinner later */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-red-500">
        <p>Error loading profile: {error}</p>
        {/* Optionally add a retry button */}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p>Could not load profile data.</p>
      </div>
    );
  }

  // Placeholder for avatar base URL if User.avatar stores only filename
  // And if a general file viewer is at /api/files/view/
  // If avatar URL is absolute or workspace-scoped, this needs adjustment.
  const getAvatarUrl = (avatarFilename?: string | null) => {
    if (!avatarFilename) return '/default-avatar.png'; // Fallback to a default placeholder
    // Assuming User.avatar stores only the unique filename (e.g., "timestamp_user_orig.jpg")
    // and not a full path or URL from a different service.
    if (avatarFilename.startsWith('http://') || avatarFilename.startsWith('https://')) {
      return avatarFilename; // It's already a full URL
    }
    return `/api/public-files/view/${avatarFilename}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Basic client-side validation for avatar (e.g., type and size)
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file for the avatar.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Avatar image size should not exceed 5MB.');
        return;
      }
      setNewAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !profile) return;
    setIsSubmitting(true);
    setError(null);

    let newAvatarUrl = profile.avatar; // Start with current avatar URL

    // 1. Upload new avatar if selected
    if (newAvatarFile) {
      const uploadFormData = new FormData();
      uploadFormData.append('file', newAvatarFile);

      // Determine a workspaceId for upload.
      // Use the first workspace ID from the profile's memberships.
      const workspaceIdForUpload = profile.members?.[0]?.workspace?.id;

      if (!workspaceIdForUpload) {
           setError("Cannot upload avatar: No associated workspace found for context. Please join or create a workspace first.");
           setIsSubmitting(false);
           return;
      }

      try {
        const token = localStorage.getItem('token') || session.accessToken;
        const uploadResponse = await fetch(`/api/workspaces/${workspaceIdForUpload}/files/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: uploadFormData,
        });
        if (!uploadResponse.ok) {
          const errData = await uploadResponse.json();
          throw new Error(errData.error || 'Avatar upload failed');
        }
        const uploadData = await uploadResponse.json();
        newAvatarUrl = uploadData.attachment.url; // This is the unique filename
      } catch (err: any) {
        setError(`Avatar upload error: ${err.message}`);
        setIsSubmitting(false);
        return;
      }
    }

    // 2. Update profile with text fields and new avatar URL (filename)
    const profileUpdatePayload: any = {
      name: formData.name,
      username: formData.username,
      bio: formData.bio,
      jobTitle: formData.jobTitle,
      pronouns: formData.pronouns,
      avatar: newAvatarUrl, // This will be the unique filename
    };

    // Remove fields that haven't changed from payload to avoid unnecessary updates
    // or sending undefined if not touched.
    Object.keys(profileUpdatePayload).forEach(key => {
      if (profileUpdatePayload[key] === profile[key as keyof UserProfile] && key !== 'avatar') { // Always send avatar if new one was processed
        // delete profileUpdatePayload[key]; // This logic might be too simple if "" means clear
      }
      if (formData[key as keyof UserProfile] === undefined && profile[key as keyof UserProfile] === null && key !== 'avatar' ) {
        // If form field was not touched and original was null, don't send.
        // delete profileUpdatePayload[key];
      }
    });


    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const profileResponse = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profileUpdatePayload),
      });
      if (!profileResponse.ok) {
        const errData = await profileResponse.json();
        throw new Error(errData.error || 'Failed to update profile');
      }
      const updatedProfileData = await profileResponse.json();
      setProfile(updatedProfileData.user); // Update local profile state
      setIsEditing(false);
      // TODO: Potentially update session data if name/username/avatar changed, or prompt reload.
      // For now, local profile state is updated. Next session fetch will get new data.
      alert("Profile updated successfully!");
    } catch (err: any) {
      setError(`Profile update error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSetCustomStatus = async () => {
    if (!session) return;
    setIsSubmitting(true); // Can use a separate loading state for status if preferred
    setError(null);
    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch('/api/users/me/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: customStatusText, emoji: customStatusEmoji }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to set status');
      }
      const data = await response.json();
      // Update local profile state for immediate feedback, though socket should also update presence context
      if (profile) {
        setProfile(prev => prev ? {...prev, customStatusText: data.customStatusText, customStatusEmoji: data.customStatusEmoji } : null);
      }
      alert("Status updated!"); // Or a more subtle notification
    } catch (err: any) {
      setError(`Status update error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearCustomStatus = async () => {
    if (!session) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch('/api/users/me/status', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to clear status');
      }
      setCustomStatusText('');
      setCustomStatusEmoji('');
      if (profile) {
         setProfile(prev => prev ? {...prev, customStatusText: null, customStatusEmoji: null } : null);
      }
      alert("Status cleared!");
    } catch (err: any) {
      setError(`Status clear error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusEmojiSelect = (emoji: string) => {
    setCustomStatusEmoji(emoji);
    setShowStatusEmojiPicker(false);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">My Profile</h1>
      </header>

      {/* Custom Status Section - Placed above the main profile edit form */}
      <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 md:p-8 mb-8">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">Set Your Status</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                ref={statusEmojiPickerButtonRef}
                onClick={() => setShowStatusEmojiPicker(prev => !prev)}
                className="p-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {customStatusEmoji || '🙂'} {/* Default emoji if none selected */}
              </button>
              {showStatusEmojiPicker && (
                <div className="absolute z-10 mt-1" ref={emojiPickerRef}>
                  <EmojiPicker onEmojiSelect={handleStatusEmojiSelect} onClose={() => setShowStatusEmojiPicker(false)} />
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="What's your status?"
              value={customStatusText}
              onChange={(e) => setCustomStatusText(e.target.value)}
              maxLength={100}
              className="flex-grow mt-0 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            {(profile?.customStatusText || profile?.customStatusEmoji) && ( // Show clear only if a status is set
                 <button type="button" onClick={handleClearCustomStatus} disabled={isSubmitting} className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
                    Clear Status
                 </button>
            )}
            <button type="button" onClick={handleSetCustomStatus} disabled={isSubmitting} className="px-4 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center">
              {isSubmitting && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              Set Status
            </button>
          </div>
        </div>
        {/* Display current status if not actively editing it in fields above */}
        {(!customStatusText && !customStatusEmoji && (profile?.customStatusText || profile?.customStatusEmoji)) && (
             <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Current: {profile.customStatusEmoji} {profile.customStatusText}
            </p>
        )}
      </div>
      {isEditing ? (
        <form onSubmit={handleSubmitEdit} className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 md:p-8 space-y-6">
          {/* Avatar Editing */}
          <div className="flex flex-col items-center gap-4">
            <img
              src={avatarPreview || getAvatarUrl(profile?.avatar)}
              alt="Avatar preview"
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700 shadow-md"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-700/50 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-600/50"
            />
          </div>

          {/* Text Fields */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
            <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
            <input type="text" name="username" id="username" value={formData.username || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Bio</label>
            <textarea name="bio" id="bio" value={formData.bio || ''} onChange={handleChange} rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
          </div>
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Job Title</label>
            <input type="text" name="jobTitle" id="jobTitle" value={formData.jobTitle || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="pronouns" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Pronouns</label>
            <input type="text" name="pronouns" id="pronouns" value={formData.pronouns || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 flex items-center">
              {isSubmitting && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <img
                src={getAvatarUrl(profile.avatar)}
                alt={profile.name || profile.username}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700 shadow-md"
              />
            </div>

            {/* Profile Details */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{profile.name || profile.username}</h2>
              <p className="text-slate-600 dark:text-slate-400">@{profile.username}</p>
              {profile.pronouns && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{profile.pronouns}</p>}
              {profile.jobTitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{profile.jobTitle}</p>}

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Email</dt>
                    <dd className="text-sm text-slate-900 dark:text-slate-100">{profile.email}</dd>
                  </div>
                  {profile.bio && (
                    <div>
                      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Bio</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{profile.bio}</dd>
                    </div>
                  )}
                   <div>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Joined</dt>
                    <dd className="text-sm text-slate-900 dark:text-slate-100">{new Date(profile.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="mt-8 text-right">
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Edit Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
