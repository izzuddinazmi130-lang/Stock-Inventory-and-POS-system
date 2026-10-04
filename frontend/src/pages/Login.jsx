import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, Lock } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import AuthPreview, { AuthArtwork } from '../components/auth/AuthPreview';
import {
  Alert, BusinessDot, Button, Checkbox, Field, Input, PasswordInput, Select, SegmentedControl, cn,
} from '../components/ui';

const REMEMBER_KEY = 'hq-remembered-login';
// Faint blue and violet light around the card, picking up the colours of the artwork
const PAGE_GLOW = {
  backgroundImage: [
    'radial-gradient(45% 55% at 0% 0%, rgb(var(--info) / 0.10) 0%, transparent 70%)',
    'radial-gradient(45% 55% at 100% 100%, rgb(var(--accent) / 0.10) 0%, transparent 70%)',
  ].join(', '),
};
const EMPTY_FORM = { email: '', password: '', confirmPassword: '', full_name: '', business_id: '', branch_id: '' };

// Sign-in controls: 44px tall, 10px radius (rounded-lg), 14px text, 13px labels
const control = 'h-11 text-sm';
const label = 'text-[13px]';

function readRemembered() {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState(() => ({ ...EMPTY_FORM, email: readRemembered() }));
  const [remember, setRemember] = useState(() => Boolean(readRemembered()));
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForgot, setShowForgot] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/register-options').then(r => r.json()).then(d => {
      if (d.success) setBusinesses(d.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (formData.business_id) {
      setBranches([]);
      setFormData(f => ({ ...f, branch_id: '' }));
      fetch(`/api/auth/register-options?business_id=${encodeURIComponent(formData.business_id)}`)
        .then(r => r.json())
        .then(d => { if (d.success) setBranches(d.data); })
        .catch(() => {});
    } else {
      setBranches([]);
    }
  }, [formData.business_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(f => ({ ...f, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(fe => ({ ...fe, [name]: undefined }));
  };

  const showErrors = (errs) => {
    setFieldErrors(errs);
    requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
  };

  // Same rules as before (required fields, 6-character password, matching confirmation), shown inline.
  const validate = () => {
    const errs = {};
    if (isRegisterMode && !formData.full_name.trim()) errs.full_name = 'Enter your full name.';
    if (!formData.email.trim()) errs.email = isRegisterMode ? 'Enter your work email.' : 'Enter your email or username.';
    else if (isRegisterMode && !/^\S+@\S+\.\S+$/.test(formData.email)) errs.email = 'Enter a valid email address.';
    if (!formData.password) errs.password = isRegisterMode ? 'Choose a password.' : 'Enter your password.';
    else if (formData.password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (isRegisterMode) {
      if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
      if (!formData.business_id) errs.business_id = 'Select your business.';
      if (!formData.branch_id) errs.branch_id = 'Select your site or branch.';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    if (Object.keys(errs).length) { showErrors(errs); return; }
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (isRegisterMode) {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: formData.full_name,
            email: formData.email,
            password: formData.password,
            business_id: parseInt(formData.business_id),
            branch_id: parseInt(formData.branch_id)
          })
        });
        const data = await response.json();
        if (data.success) {
          setRequestSent(true);
          setFormData({ ...EMPTY_FORM, email: readRemembered() });
        } else if (/email/i.test(data.message || '')) {
          showErrors({ email: data.message });
        } else {
          setError(data.message);
        }
      } else {
        const res = await login(formData.email, formData.password);
        if (res.success) {
          try {
            if (remember) localStorage.setItem(REMEMBER_KEY, formData.email);
            else localStorage.removeItem(REMEMBER_KEY);
          } catch { /* storage unavailable: nothing to remember */ }
          navigate(res.user?.must_change_password ? '/change-password' : '/dashboard');
        } else {
          showErrors({ password: res.message || 'Incorrect email or password.' });
        }
      }
    } catch (err) {
      // Wrong credentials come back as 4xx: show them under the password; anything else at the top
      const message = err.response?.data?.message;
      if (!isRegisterMode && err.response?.status < 500 && message) showErrors({ password: message });
      else setError(message || err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const setMode = (register) => {
    if (register === isRegisterMode) return;
    setIsRegisterMode(register);
    setRequestSent(false);
    setError(''); setFieldErrors({}); setShowForgot(false);
  };

  const selectedBusiness = businesses.find(b => String(b.id) === String(formData.business_id));

  return (
    <div className="relative min-h-screen overflow-hidden bg-page text-ink flex flex-col items-center justify-center px-3 py-6 sm:px-6 sm:py-10">
      {/* Soft colour wash behind the card */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={PAGE_GLOW} />

      <div className="relative grid w-full max-w-[1120px] rounded-[28px] border border-line/70 bg-surface p-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_30px_80px_-24px_rgb(var(--ink)/0.22)] sm:p-3 min-[900px]:min-h-[680px] min-[900px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] animate-slide-up">
        <AuthPreview className="hidden min-[900px]:flex" />

        {/* Phones and small tablets: a slim strip of the artwork instead of the side panel */}
        <div className="relative h-28 overflow-hidden rounded-[22px] min-[900px]:hidden">
          <AuthArtwork />
          <div className="relative flex h-full items-end p-5">
            <BrandMark className="[&_img]:brightness-0 [&_img]:invert" />
          </div>
        </div>

        <main className="flex items-center justify-center px-4 py-10 sm:px-10 min-[900px]:px-14 min-[900px]:py-12">
          {/* Reserves the height of the taller "Request access" form at every breakpoint, so the card keeps
              one size and the logo, heading and tabs never move when switching tabs. */}
          <div className="w-full max-w-[400px] min-h-[49.5rem] sm:min-h-[43rem] min-[900px]:min-h-[47.5rem]">
            <BrandMark size="lg" className="mb-7 hidden min-[900px]:inline-flex" />
            {/* The heading is the only child here: re-keying it on a tab switch replays the fade without ever
                leaving a second heading next to it */}
            <div className="mb-8">
              <div key={isRegisterMode ? 'register' : 'signin'} className="animate-fade-in">
                <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
                  {isRegisterMode ? 'Request access' : 'Welcome back'}
                </h1>
                <p className="mt-2 text-sm text-ink-muted">
                  {isRegisterMode ? 'HQ reviews every request before you can sign in.' : 'Sign in to manage your inventory.'}
                </p>
              </div>
            </div>

            <SegmentedControl
              fullWidth
              label="Choose sign in or request access"
              className="mb-8"
              value={isRegisterMode ? 'register' : 'signin'}
              onChange={v => setMode(v === 'register')}
              tabs={[{ value: 'signin', label: 'Sign in' }, { value: 'register', label: 'Request access' }]}
            />

            {/* Switching tabs fades the fields in (no height change: see the reserved height above) */}
            <div className="relative">
            <div key={isRegisterMode ? 'register' : 'signin'} className="animate-slide-up">
            {error && <Alert tone="danger" className="mb-6" onClose={() => setError('')}>{error}</Alert>}

            {isRegisterMode && requestSent ? (
              <div className="rounded-xl border border-success-line bg-success-soft p-6 text-center animate-fade-in" role="status">
                <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-success shadow-soft">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-ink">Request sent.</p>
                <p className="mt-1 text-sm text-ink-secondary">An administrator will review your access.</p>
                <Button variant="secondary" className={cn(control, 'mt-6')} fullWidth onClick={() => setMode(false)}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
                {isRegisterMode && (
                  <Field label="Full name" labelClassName={label} required hideRequiredMark error={fieldErrors.full_name}>
                    <Input className={control} type="text" name="full_name" autoComplete="name" placeholder="e.g. Ali bin Abu" value={formData.full_name} onChange={handleChange} />
                  </Field>
                )}

                <Field label={isRegisterMode ? 'Work email' : 'Email or username'} labelClassName={label} required hideRequiredMark error={fieldErrors.email}>
                  <Input
                    className={control}
                    type={isRegisterMode ? 'email' : 'text'}
                    name="email"
                    autoComplete={isRegisterMode ? 'email' : 'username'}
                    placeholder="you@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </Field>

                <Field label="Password" labelClassName={label} required hideRequiredMark error={fieldErrors.password}>
                  <PasswordInput
                    className={control}
                    name="password"
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    placeholder={isRegisterMode ? 'At least 6 characters' : 'Enter your password'}
                    value={formData.password}
                    onChange={handleChange}
                  />
                </Field>

                {!isRegisterMode && (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <Checkbox label="Remember me" checked={remember} onChange={e => setRemember(e.target.checked)} />
                      <Button variant="link" onClick={() => setShowForgot(v => !v)} aria-expanded={showForgot} className="text-[13px] font-medium rounded">
                        Forgot password?
                      </Button>
                    </div>
                    {showForgot && (
                      <Alert tone="info" onClose={() => setShowForgot(false)}>
                        Ask your HQ Super Admin to reset it. They’ll give you a temporary password, and you’ll choose your own new one right after signing in.
                      </Alert>
                    )}
                  </>
                )}

                {isRegisterMode && (
                  <>
                    <Field label="Confirm password" labelClassName={label} required hideRequiredMark error={fieldErrors.confirmPassword}>
                      <PasswordInput className={control} name="confirmPassword" autoComplete="new-password" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Business" labelClassName={label} required hideRequiredMark error={fieldErrors.business_id}>
                        <div className="relative">
                          {selectedBusiness && <BusinessDot business={selectedBusiness} className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2" />}
                          <Select name="business_id" value={formData.business_id} onChange={handleChange} className={cn(control, selectedBusiness && 'pl-8')}>
                            <option value="">Select…</option>
                            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </Select>
                        </div>
                      </Field>
                      <Field label="Branch" labelClassName={label} required hideRequiredMark error={fieldErrors.branch_id}>
                        <Select name="branch_id" className={control} value={formData.branch_id} onChange={handleChange} disabled={!formData.business_id || branches.length === 0}>
                          <option value="">{formData.business_id ? 'Select…' : 'Business first'}</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                      </Field>
                    </div>
                  </>
                )}

                <div className="pt-2">
                  <Button type="submit" loading={submitting} fullWidth size="lg" className={control}>
                    {submitting ? 'Please wait…' : isRegisterMode ? 'Submit request' : 'Sign in'}
                  </Button>
                  <p className="mt-4 flex items-center justify-center gap-1.5 text-caption text-ink-muted">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Access is restricted to authorized staff.
                  </p>
                </div>
              </form>
            )}
            </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="relative mt-6 text-center text-caption text-ink-muted">
        © {new Date().getFullYear()} HQ Inventory · Inventory &amp; point of sale
      </footer>
    </div>
  );
}
