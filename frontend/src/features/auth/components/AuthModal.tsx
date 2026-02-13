import { useState, FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '../store';
import { getRememberMe, setRememberMe } from '@/shared/services/supabase';
import { AVATAR_ICONS, getAvatarIcon } from '@/shared/constants/avatarIcons';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
}

export function AuthModal({ isOpen }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'confirm'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('user');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [rememberMe, setLocalRememberMe] = useState(getRememberMe);
  const { signIn, signUp, error, isLoading, clearError } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      setRememberMe(rememberMe);
      await signIn(email, password);
    } else {
      const success = await signUp(
        email,
        password,
        displayName || undefined,
        selectedAvatar,
        preferredName || undefined
      );
      if (success) {
        setMode('confirm');
      }
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    clearError();
  };

  const backToLogin = () => {
    setMode('login');
    clearError();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title=""
      size="sm"
      hideCloseButton
    >
      <div className="auth-header">
        <img src="/qodex-logo.png" alt="Qodex" className="auth-logo" />
        <h2 className="auth-title">
          {mode === 'login' && 'Login or signup below'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'confirm' && 'Check your email'}
        </h2>
      </div>

      {mode === 'confirm' ? (
        <div className="auth-confirm">
          <p className="auth-confirm-text">
            We've sent a confirmation link to <strong>{email}</strong>. Please check your inbox and click the link to activate your account.
          </p>
          <button className="auth-submit" onClick={backToLogin}>
            Back to Sign In
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="auth-field">
                <label htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              {/* Avatar and Preferred Name Row - matching AccountSettingsModal */}
              <div className="auth-avatar-row">
                <div className="auth-avatar-section">
                  <div className="auth-avatar-header">
                    <label className="auth-avatar-label">Avatar</label>
                    <button
                      type="button"
                      className="auth-avatar-current"
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      title="Click to change avatar"
                    >
                      {(() => {
                        const CurrentIcon = getAvatarIcon(selectedAvatar);
                        return <CurrentIcon size={20} />;
                      })()}
                    </button>
                  </div>

                  {/* Avatar Picker Dropdown */}
                  {showAvatarPicker && (
                    <div className="auth-avatar-dropdown">
                      <div className="auth-avatar-dropdown-header">
                        <span>Choose an Avatar</span>
                        <button
                          type="button"
                          className="auth-avatar-dropdown-close"
                          onClick={() => setShowAvatarPicker(false)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="auth-avatar-grid">
                        {AVATAR_ICONS.map((avatar) => {
                          const Icon = avatar.icon;
                          return (
                            <button
                              key={avatar.id}
                              type="button"
                              className={`auth-avatar-option ${avatar.id === selectedAvatar ? 'active' : ''}`}
                              onClick={() => {
                                setSelectedAvatar(avatar.id);
                                setShowAvatarPicker(false);
                              }}
                              title={avatar.label}
                            >
                              <Icon size={16} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="auth-preferred-section">
                  <label htmlFor="preferredName" className="auth-avatar-label">What should Qodex call you?</label>
                  <div className="auth-input-row">
                    <input
                      id="preferredName"
                      type="text"
                      className="auth-preferred-input"
                      value={preferredName}
                      onChange={(e) => setPreferredName(e.target.value)}
                      placeholder="e.g. Joe, Laura"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'login' && (
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setLocalRememberMe(e.target.checked)}
              />
              Remember me when I login
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>

          <div className="auth-toggle">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button type="button" onClick={toggleMode}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={toggleMode}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
