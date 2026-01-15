import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Join.css';

interface InviteInfo {
  email: string;
  account_name: string;
  invited_by: string;
  expires_at: string;
}

export function Join() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const token = searchParams.get('token');

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInviteInfo();
    } else {
      setError('No invite token provided');
      setIsLoading(false);
    }
  }, [token]);

  const fetchInviteInfo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/account/invite/${token}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid or expired invite');
      }

      const data = await response.json();
      setInviteInfo(data.invite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!token) return;

    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/account/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join team');
      }

      setJoinSuccess(true);

      // Redirect to board after a short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setIsJoining(false);
    }
  };

  // Still loading auth state
  if (authLoading) {
    return (
      <div className="join-page">
        <div className="join-container">
          <div className="join-loading">Loading...</div>
        </div>
      </div>
    );
  }

  // No token provided
  if (!token) {
    return (
      <div className="join-page">
        <div className="join-container">
          <div className="join-card error-card">
            <h1>Invalid Invite Link</h1>
            <p>No invite token was provided in the URL.</p>
            <a href="/login" className="btn btn-primary">Go to Login</a>
          </div>
        </div>
      </div>
    );
  }

  // Loading invite info
  if (isLoading) {
    return (
      <div className="join-page">
        <div className="join-container">
          <div className="join-card">
            <div className="join-loading">Verifying invite...</div>
          </div>
        </div>
      </div>
    );
  }

  // Error loading invite
  if (error && !inviteInfo) {
    return (
      <div className="join-page">
        <div className="join-container">
          <div className="join-card error-card">
            <h1>Invalid Invite</h1>
            <p>{error}</p>
            <p className="error-hint">The invite link may have expired or already been used.</p>
            <a href="/login" className="btn btn-primary">Go to Login</a>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (joinSuccess) {
    return (
      <div className="join-page">
        <div className="join-container">
          <div className="join-card success-card">
            <div className="success-icon">✓</div>
            <h1>Welcome to the Team!</h1>
            <p>You've successfully joined <strong>{inviteInfo?.account_name}</strong>.</p>
            <p className="redirect-text">Redirecting to the board...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in - need to signup/login first
  if (!user) {
    return (
      <div className="join-page">
        <div className="join-container">
          <div className="join-card">
            <h1>You're Invited!</h1>
            {inviteInfo && (
              <div className="invite-details">
                <p><strong>{inviteInfo.invited_by}</strong> has invited you to join:</p>
                <div className="team-name">{inviteInfo.account_name}</div>
                <p className="invite-email">This invite is for: <strong>{inviteInfo.email}</strong></p>
              </div>
            )}

            <div className="auth-prompt">
              <p>To accept this invite, please sign up or log in with the email address above.</p>
              <div className="auth-buttons">
                <a
                  href={`/signup?token=${token}&email=${encodeURIComponent(inviteInfo?.email || '')}`}
                  className="btn btn-primary"
                >
                  Sign Up
                </a>
                <a
                  href={`/login?token=${token}&email=${encodeURIComponent(inviteInfo?.email || '')}`}
                  className="btn btn-secondary"
                >
                  Log In
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in - check email match
  const emailMatches = user.email?.toLowerCase() === inviteInfo?.email?.toLowerCase();

  if (!emailMatches) {
    return (
      <div className="join-page">
        <div className="join-container">
          <div className="join-card warning-card">
            <h1>Email Mismatch</h1>
            <p>This invite was sent to <strong>{inviteInfo?.email}</strong>, but you're logged in as <strong>{user.email}</strong>.</p>
            <p>Please log out and sign up or log in with the correct email address.</p>
            <div className="auth-buttons">
              <a href="/logout" className="btn btn-secondary">Log Out</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in with correct email - show join button
  return (
    <div className="join-page">
      <div className="join-container">
        <div className="join-card">
          <h1>Join Team</h1>
          {inviteInfo && (
            <div className="invite-details">
              <p><strong>{inviteInfo.invited_by}</strong> has invited you to join:</p>
              <div className="team-name">{inviteInfo.account_name}</div>
            </div>
          )}

          {error && (
            <div className="join-error">{error}</div>
          )}

          <button
            className="btn btn-primary btn-large"
            onClick={handleJoin}
            disabled={isJoining}
          >
            {isJoining ? 'Joining...' : 'Accept Invite & Join Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
