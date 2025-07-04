'use client'

import { useState } from 'react'

interface InviteUserModalProps {
  onClose: () => void
  onUserInvited: (member: any) => void
  workspaceId: string
}

export function InviteUserModal({ onClose, onUserInvited, workspaceId }: InviteUserModalProps) {
  const [email, setEmail] = useState('')
  const [email, setEmail] = useState('')
  const [loadingDirectInvite, setLoadingDirectInvite] = useState(false)
  const [directInviteError, setDirectInviteError] = useState('')
  const [directInviteSuccess, setDirectInviteSuccess] = useState('')

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => { // This is for Direct Email Invite
    e.preventDefault()
    setLoadingDirectInvite(true)
    setDirectInviteError('')
    setDirectInviteSuccess('')

    try {
      // TODO: Get token for auth
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Added Authorization
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        const invitedUserDetails = data.user || (data.member ? data.member.user : null); // API might return `member.user` or just `user`
        setDirectInviteSuccess(`${invitedUserDetails?.name || invitedUserDetails?.username || email} has been invited as a ${data.member?.role || 'Member'}!`);
        onUserInvited(data.member || { user: invitedUserDetails, role: data.role || 'MEMBER' }); // Pass consistent structure
        setEmail(''); // Clear email field to allow another invite
        // Keep modal open to show success message. User can close manually or invite another.
      } else {
        setDirectInviteError(data.error || 'Failed to invite user');
      }
    } catch (err: any) {
      setDirectInviteError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoadingDirectInvite(false);
    }
  }

  const handleGenerateLink = async () => {
    setLoadingLink(true);
    setLinkError('');
    setGeneratedLink(null);
    setLinkCopied(false);
    // TODO: Get token for auth
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Added Authorization
        },
        body: JSON.stringify({ role: 'MEMBER' }), // Default role, could add UI to select role
      });
      const data = await response.json();
      if (response.ok) {
        // Construct full link for display/copy
        const inviteToken = data.invite.token;
        const fullInviteLink = `${window.location.origin}/invite/${inviteToken}`;
        setGeneratedLink(fullInviteLink);
      } else {
        setLinkError(data.error || "Failed to generate invite link.");
      }
    } catch (err) {
      setLinkError("An error occurred while generating the link.");
    } finally {
      setLoadingLink(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000); // Reset after 2s
      }, (err) => {
        console.error('Failed to copy link: ', err);
        alert("Failed to copy link.");
      });
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Invite to Workspace</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Direct Email Invite Section */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Invite by Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="user@example.com"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The user must already have an account
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loadingDirectInvite || !email.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingDirectInvite ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
          <span className="flex-shrink mx-4 text-gray-400 dark:text-slate-500 text-xs">OR</span>
          <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
        </div>

        {/* Generate Invite Link Section */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Create an Invite Link
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              Share this link with anyone you want to invite (defaults to Member role, no expiry).
            </p>
            <button
              type="button"
              onClick={handleGenerateLink}
              disabled={loadingLink}
              className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors text-sm"
            >
              {loadingLink ? 'Generating...' : 'Generate Invite Link'}
            </button>
          </div>

          {linkError && (
            <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-lg flex items-center gap-2">
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {linkError}
            </div>
          )}

          {generatedLink && (
            <div className="space-y-2">
              <p className="text-xs text-green-600 dark:text-green-400">Link generated successfully!</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="w-full border border-gray-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-70"
                  title={linkCopied ? "Copied!" : "Copy link"}
                >
                  {linkCopied ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-8.5-3.5h5.326a3 3 0 012.865 2.092l.533 1.6a1 1 0 00 .931.675h1.975a1 1 0 01.93.675l.534 1.602a3 3 0 01-2.865 2.092H8.5"></path></svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}