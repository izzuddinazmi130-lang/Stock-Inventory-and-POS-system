import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { Alert, Button, useToast } from '../components/ui';
import { PasswordChangeFields, usePasswordChange } from '../components/auth/PasswordChangeFields';

/**
 * Shown straight after signing in with a temporary password (set by a Super Admin reset).
 * The rest of the system stays locked, on the server too, until a new password is chosen.
 */
export default function ChangePassword() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const pw = usePasswordChange();

  if (!user.must_change_password) return <Navigate to="/dashboard" replace />;

  const save = async (e) => {
    e.preventDefault();
    if (await pw.submit()) {
      await refreshUser();
      toast.success('New password saved. Welcome back!');
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] animate-slide-up">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">HQ Inventory</span>
        </div>

        <div className="rounded-xl border border-line bg-surface shadow-card p-6 sm:p-8">
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-ink">Choose a new password</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Hi {user.full_name?.split(' ')[0] || 'there'}, your password was reset by an administrator.
            Pick a new one only you know to continue.
          </p>

          <form onSubmit={save} noValidate className="mt-6 space-y-5">
            {pw.errors.form && <Alert tone="danger">{pw.errors.form}</Alert>}
            <PasswordChangeFields {...pw} currentLabel="Temporary password" inputClassName="h-11" labelClassName="text-[13px]" />
            <Button type="submit" fullWidth size="lg" loading={pw.saving} className="h-11">Save new password</Button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Button variant="link" icon={LogOut} onClick={logout} className="text-sm text-ink-muted hover:text-ink">Sign out</Button>
        </div>
      </div>
    </div>
  );
}
