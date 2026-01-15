import { useState, useEffect } from 'react';
import './OnboardingHints.css';

export function OnboardingHints() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if hints have been dismissed before
    const dismissed = localStorage.getItem('onboarding-hints-dismissed');
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('onboarding-hints-dismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div className="onboarding-hints">
      <div className="onboarding-hints-header">
        <h3 className="onboarding-hints-title">Getting Started with GSD</h3>
        <button className="onboarding-hints-close" onClick={handleDismiss}>
          &times;
        </button>
      </div>
      <div className="onboarding-hints-content">
        <div className="hint-item">
          <span className="hint-icon">📥</span>
          <div className="hint-text">
            <strong>Start with Inbox</strong> - New tasks appear in Inbox by default. Capture everything here first.
          </div>
        </div>
        <div className="hint-item">
          <span className="hint-icon">🎯</span>
          <div className="hint-text">
            <strong>Today Limit (Max 3)</strong> - Focus on 3 tasks each day. Drag tasks to the Today column to commit.
          </div>
        </div>
        <div className="hint-item">
          <span className="hint-icon">🖱️</span>
          <div className="hint-text">
            <strong>Drag & Drop</strong> - Move tasks between columns by dragging. Reorder within columns by dropping between tasks.
          </div>
        </div>
      </div>
    </div>
  );
}
