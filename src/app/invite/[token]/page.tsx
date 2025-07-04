'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link'; // For Sign Up/Log In links

interface InviteDetails {
  workspaceId: string;
  workspaceName: string;
  invitedBy: string;
  roleToBeGranted: string; // Should match MemberRole enum values
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string | undefined;
  const { data: session, status: sessionStatus } = useSession();

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (token) {
      const fetchInviteDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/invites/${token}`);
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Failed to fetch invite details (${response.status})`);
          }
          setInviteDetails(data);
        } catch (err: any) {
          console.error("Fetch invite details error:", err);
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchInviteDetails();
    } else {
      setError("No invite token provided.");
      setIsLoading(false);
    }
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!token || !session) {
      setError("Cannot accept invite: missing token or not logged in.");
      return;
    }
    setIsAccepting(true);
    setError(null);
    try {
      const authToken = localStorage.getItem('token') || session.accessToken; // From next-auth session
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json', // Though body might be empty for this request
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to accept invite (${response.status})`);
      }
      // Success! Redirect to the workspace.
      alert(data.message || "Successfully joined workspace!"); // Temporary feedback
      router.push(`/dashboard?workspaceId=${inviteDetails?.workspaceId || data.workspace?.id}`);
    } catch (err: any) {
      console.error("Accept invite error:", err);
      setError(err.message);
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-700 dark:text-slate-300">Loading invite information...</p>
        {/* Add spinner later */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 text-center">
        <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Invite Error</h1>
        <p className="text-slate-700 dark:text-slate-300 mb-6">{error}</p>
        <Link href="/dashboard" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (!inviteDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-700 dark:text-slate-300">Invite details not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-6">
      <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-8 md:p-12 w-full max-w-lg text-center">
        <div className="mb-6">
          {/* Placeholder for Workspace Logo/Icon if available */}
          <div className="w-16 h-16 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">
              {inviteDetails.workspaceName?.[0]?.toUpperCase() || 'W'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            You're invited to join
          </h1>
          <p className="text-xl md:text-2xl font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
            {inviteDetails.workspaceName}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Invited by <span className="font-medium">{inviteDetails.invitedBy}</span> as a <span className="font-medium">{inviteDetails.roleToBeGranted.toLowerCase()}</span>.
          </p>
        </div>

        {sessionStatus === 'authenticated' && session ? (
          <button
            onClick={handleAcceptInvite}
            disabled={isAccepting}
            className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-70 transition-all duration-150 flex items-center justify-center"
          >
            {isAccepting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Accepting...
              </>
            ) : (
              'Accept Invite & Join Workspace'
            )}
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-700 dark:text-slate-300">
              Please sign in or create an account to accept this invitation.
            </p>
            <button
              onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })}
              className="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all duration-150"
            >
              Sign In / Sign Up
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You'll be redirected back to this page after signing in.
            </p>
          </div>
        )}
        {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
      <Link href="/dashboard" className="mt-8 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        Go to Dashboard
      </Link>
    </div>
  );
}
