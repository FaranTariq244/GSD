import { useState, useEffect } from 'react';
import './Team.css';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
}

interface Invite {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [_isLoadingInvites, setIsLoadingInvites] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; link: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchInvites();
  }, []);

  const fetchMembers = async () => {
    try {
      setIsLoadingMembers(true);
      const response = await fetch('/api/account/members', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const fetchInvites = async () => {
    try {
      setIsLoadingInvites(true);
      const response = await fetch('/api/account/invites', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites || []);
      }
    } catch (error) {
      console.error('Failed to fetch invites:', error);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const response = await fetch('/api/account/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invite');
      }

      // Generate invite link
      const inviteLink = `${window.location.origin}/join?token=${data.invite.token}`;

      setInviteSuccess({
        email: inviteEmail,
        link: inviteLink,
      });
      setInviteEmail('');
      setInviteName('');

      // Refresh invites list
      fetchInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const copyInviteLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isInviteExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const pendingInvites = invites.filter(inv => !inv.used_at && !isInviteExpired(inv.expires_at));

  return (
    <div className="team-page">
      <div className="team-container">
        <header className="team-header">
          <h1>Team Members</h1>
          <a href="/" className="back-link">Back to Board</a>
        </header>

        {/* Invite Form */}
        <section className="invite-section">
          <h2>Invite New Member</h2>
          <form onSubmit={handleInvite} className="invite-form">
            <div className="invite-form-fields">
              <div className="form-group">
                <label htmlFor="inviteName">Name (optional)</label>
                <input
                  type="text"
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  disabled={isInviting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="inviteEmail">Email *</label>
                <input
                  type="email"
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  disabled={isInviting}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isInviting}>
                {isInviting ? 'Sending...' : 'Generate Invite Link'}
              </button>
            </div>
          </form>

          {inviteError && (
            <div className="invite-error">
              {inviteError}
            </div>
          )}

          {inviteSuccess && (
            <div className="invite-success">
              <p>Invite created for <strong>{inviteSuccess.email}</strong></p>
              <p className="invite-instructions">Share this link with them:</p>
              <div className="invite-link-box">
                <input
                  type="text"
                  value={inviteSuccess.link}
                  readOnly
                  className="invite-link-input"
                />
                <button
                  type="button"
                  className="btn btn-secondary copy-btn"
                  onClick={() => copyInviteLink(inviteSuccess.link)}
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="invite-note">This link expires in 7 days.</p>
            </div>
          )}
        </section>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <section className="pending-invites-section">
            <h2>Pending Invites</h2>
            <div className="invites-list">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="invite-item">
                  <div className="invite-info">
                    <span className="invite-email">{invite.email}</span>
                    <span className="invite-date">
                      Invited {formatDate(invite.created_at)} · Expires {formatDate(invite.expires_at)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => copyInviteLink(`${window.location.origin}/join?token=${invite.token}`)}
                  >
                    Copy Link
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Team Members List */}
        <section className="members-section">
          <h2>Current Members ({members.length})</h2>
          {isLoadingMembers ? (
            <div className="loading-text">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="empty-text">No members yet</div>
          ) : (
            <div className="members-list">
              {members.map(member => (
                <div key={member.id} className="member-item">
                  <div className="member-avatar">{getInitials(member.name)}</div>
                  <div className="member-info">
                    <span className="member-name">{member.name}</span>
                    <span className="member-email">{member.email}</span>
                  </div>
                  <div className="member-meta">
                    <span className={`member-role ${member.role}`}>{member.role}</span>
                    <span className="member-joined">Joined {formatDate(member.joined_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
