import React, { useEffect, useRef, useState } from 'react';
import { MailCheck } from 'lucide-react';
import api from '../../services/api';
import { Alert, Button, Field, Input, PasswordInput, cn } from '../ui';
import { t, lang } from '../../i18n';

const RESEND_SECONDS = 60;
const looksLikeEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v || '').trim());

/**
 * Forgot password on the sign-in page, in two steps:
 *   1. email → the server emails a 6-digit code (same answer whether or not the email has an account)
 *   2. code + new password → password changed and signed in (onDone gets the user)
 * When email isn't set up on the server, it says to ask the HQ Super Admin instead.
 */
export default function ForgotPassword({ initialEmail = '', onBack, onDone, controlClassName, labelClassName }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(looksLikeEmail(initialEmail) ? initialEmail.trim() : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null); // { tone, text }
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(true);
  const [wait, setWait] = useState(0);
  const formRef = useRef(null);

  useEffect(() => {
    api.get('/auth/reset-available').then(r => setAvailable(Boolean(r.data.available))).catch(() => {});
  }, []);

  // "Send a new code" countdown
  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const focusError = () => requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());

  const sendCode = async (e) => {
    e?.preventDefault();
    setAlert(null);
    if (!looksLikeEmail(email)) { setErrors({ email: t('Enter a valid email address.') }); focusError(); return; }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim(), lang });
      setStep('code');
      setWait(RESEND_SECONDS);
      setAlert({ tone: 'success', text: res.data.message });
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'EMAIL_OFF') setAvailable(false);
      else setAlert({ tone: 'danger', text: d?.message || t('Something went wrong. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setAlert(null);
    const errs = {};
    if (!/^\d{6}$/.test(code.trim())) errs.code = t('Enter the 6-digit code from the email.');
    if (password.length < 6) errs.password = t('Password must be at least 6 characters.');
    else if (password !== confirm) errs.confirm = t('Passwords do not match.');
    if (Object.keys(errs).length) { setErrors(errs); focusError(); return; }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.post('/auth/reset-password', { email: email.trim(), code: code.trim(), new_password: password });
      onDone?.(res.data.user);
    } catch (err) {
      const d = err.response?.data || {};
      if (d.code === 'CODE_WRONG') {
        setErrors({ code: `${d.message} ${t('{n} {n|try|tries} left.', { n: d.attempts_left })}` });
        focusError();
      } else if (d.code === 'CODE_INVALID' || d.code === 'CODE_LOCKED') {
        setCode('');
        setAlert({ tone: 'danger', text: d.message });
      } else if (d.code === 'weak_password') {
        setErrors({ password: d.message }); focusError();
      } else {
        setAlert({ tone: 'danger', text: d.message || t('Something went wrong. Please try again.') });
      }
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="mb-5">
      <p className="text-base font-semibold text-ink">{t('Reset your password')}</p>
      <p className="mt-1 text-sm text-ink-muted">
        {step === 'email'
          ? t('Enter the email of your account. We’ll email you a 6-digit code.')
          : t('Enter the code from the email and choose a new password.')}
      </p>
    </div>
  );

  if (!available) {
    return (
      <div className="animate-fade-in">
        {header}
        <Alert tone="info" className="mb-6">
          {t('Ask your HQ Super Admin to reset it. They’ll give you a temporary password, and you’ll choose your own new one right after signing in.')}
        </Alert>
        <Button variant="secondary" fullWidth className={controlClassName} onClick={onBack}>{t('Back to sign in')}</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {header}
      {alert && <Alert tone={alert.tone} className="mb-5" onClose={() => setAlert(null)}>{alert.text}</Alert>}

      {step === 'email' ? (
        <form ref={formRef} onSubmit={sendCode} noValidate className="space-y-4">
          <Field label={t('Email')} labelClassName={labelClassName} required hideRequiredMark error={errors.email}>
            <Input className={controlClassName} type="email" name="reset_email" autoComplete="email" placeholder="you@gmail.com"
              value={email} onChange={e => { setEmail(e.target.value); setErrors({}); }} autoFocus />
          </Field>
          <Button type="submit" loading={busy} fullWidth size="lg" className={controlClassName}>{t('Send code')}</Button>
          <Button variant="secondary" fullWidth className={controlClassName} onClick={onBack}>{t('Back to sign in')}</Button>
        </form>
      ) : (
        <form ref={formRef} onSubmit={resetPassword} noValidate className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg bg-subtle px-3 py-2.5 text-caption text-ink-secondary">
            <MailCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
            <span>{t('Sent to {email}. Not there? Check the spam folder.', { email: email.trim() })}</span>
          </p>
          <Field label={t('6-digit code')} labelClassName={labelClassName} required hideRequiredMark error={errors.code}>
            <Input className={cn(controlClassName, 'tracking-[0.4em] font-semibold tabular-nums')} name="reset_code" inputMode="numeric"
              autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors(er => ({ ...er, code: undefined })); }} autoFocus />
          </Field>
          <Field label={t('New password')} labelClassName={labelClassName} required hideRequiredMark error={errors.password}>
            <PasswordInput className={controlClassName} name="reset_password" autoComplete="new-password" placeholder={t('At least 6 characters')}
              value={password} onChange={e => { setPassword(e.target.value); setErrors(er => ({ ...er, password: undefined })); }} />
          </Field>
          <Field label={t('Confirm new password')} labelClassName={labelClassName} required hideRequiredMark error={errors.confirm}>
            <PasswordInput className={controlClassName} name="reset_confirm" autoComplete="new-password" placeholder={t('Re-enter your password')}
              value={confirm} onChange={e => { setConfirm(e.target.value); setErrors(er => ({ ...er, confirm: undefined })); }} />
          </Field>
          <Button type="submit" loading={busy} fullWidth size="lg" className={controlClassName}>
            {busy ? t('Please wait…') : t('Change password and sign in')}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <Button variant="link" className="text-[13px] font-medium" onClick={() => { setStep('email'); setAlert(null); setErrors({}); setCode(''); }}>
              {t('Use a different email')}
            </Button>
            <Button variant="link" className="text-[13px] font-medium" disabled={wait > 0 || busy} onClick={() => sendCode()}>
              {wait > 0 ? t('Send a new code ({s}s)', { s: wait }) : t('Send a new code')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
