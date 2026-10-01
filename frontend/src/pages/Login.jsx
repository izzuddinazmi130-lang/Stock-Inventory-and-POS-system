import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, BellRing, Network, ScanLine } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import {
  Alert, BusinessDot, Button, ButtonBase, Checkbox, Field, Input, PasswordInput, Select, SegmentedControl,
} from '../components/ui';
import { cn, prefersReducedMotion } from '../components/ui/cn';
import stockCheckImg from '../assets/illustrations/stock-check.webp';
import shopFloorImg from '../assets/illustrations/shop-floor.webp';
import reportsImg from '../assets/illustrations/reports.webp';

const SLIDES = [
  { img: stockCheckImg, icon: ScanLine, title: 'QR receiving & stock counts', text: 'Scan labels to receive deliveries and count shelves in seconds.' },
  { img: shopFloorImg, icon: Network, title: 'Every site in sync', text: 'Map products to each branch and store, with stock kept in step.' },
  { img: reportsImg, icon: BellRing, title: 'Low-stock alerts', text: 'See what is running low before shelves go empty, then restock.' },
];
const SLIDE_MS = 5000;
const REMEMBER_KEY = 'hq-remembered-login';
const EMPTY_FORM = { email: '', password: '', confirmPassword: '', full_name: '', business_id: '', branch_id: '' };

// Auth fields: 44px tall, 12px radius, 15px text (see DESIGN.md › Sign-in page)
const field = 'h-11 rounded-xl text-[15px]';
const label = 'text-[13px]';

function readRemembered() {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState(() => ({ ...EMPTY_FORM, email: readRemembered() }));
  const [remember, setRemember] = useState(() => Boolean(readRemembered()));
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForgot, setShowForgot] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  // Same rules the form enforced before (required fields, 6-character password, matching confirmation),
  // shown inline under each field instead of as browser bubbles.
  const validate = () => {
    const errs = {};
    if (isRegisterMode && !formData.full_name.trim()) errs.full_name = 'Enter your full name.';
    if (!formData.email.trim()) errs.email = isRegisterMode ? 'Enter your email address.' : 'Enter your email or username.';
    else if (isRegisterMode && !/^\S+@\S+\.\S+$/.test(formData.email)) errs.email = 'Enter a valid email address.';
    if (!formData.password) errs.password = 'Enter your password.';
    else if (formData.password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (isRegisterMode) {
      if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
      if (!formData.business_id) errs.business_id = 'Select your business.';
      if (!formData.branch_id) errs.branch_id = 'Select your branch.';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
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
          setSuccess(data.message);
          setIsRegisterMode(false);
          setFormData({ ...EMPTY_FORM, email: readRemembered() });
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
          navigate('/dashboard');
        } else {
          setError(res.message);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBusiness = businesses.find(b => String(b.id) === String(formData.business_id));
  const switchMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError(''); setSuccess(''); setFieldErrors({}); setShowForgot(false);
  };

  return (
    <div className="theme-system relative min-h-screen overflow-hidden bg-page text-ink font-sans flex flex-col">
      {/* One soft glow behind the card */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-[min(64rem,120vw)] h-[36rem] rounded-full bg-accent/15 blur-[120px]" />

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[28rem] min-[860px]:max-w-[60rem] animate-slide-up">
          <div className="min-[860px]:hidden flex justify-center mb-8">
            <BrandMark withName subtitle={null} />
          </div>

          <div className="grid min-[860px]:grid-cols-2 rounded-3xl border border-line bg-surface shadow-elevated overflow-hidden">
            <Showcase />

            <section className="p-8 sm:p-12 flex flex-col justify-center">
              <div className="mb-7">
                <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">
                  {isRegisterMode ? 'Request an account' : 'Welcome back'}
                </h1>
                <p className="text-[15px] text-ink-muted mt-2">
                  {isRegisterMode ? 'HQ reviews every request before you can sign in.' : 'Sign in to continue to HQ Inventory.'}
                </p>
              </div>

              <SegmentedControl
                fullWidth
                label="Choose sign in or account request"
                className="mb-7"
                value={isRegisterMode ? 'register' : 'signin'}
                onChange={v => { if ((v === 'register') !== isRegisterMode) switchMode(); }}
                tabs={[{ value: 'signin', label: 'Sign in' }, { value: 'register', label: 'Request access' }]}
              />

              {error && <Alert tone="danger" className="mb-5" onClose={() => setError('')}>{error}</Alert>}
              {success && <Alert tone="success" className="mb-5" onClose={() => setSuccess('')}>{success}</Alert>}

              <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
                {isRegisterMode && (
                  <Field label="Full name" labelClassName={label} required hideRequiredMark error={fieldErrors.full_name}>
                    <Input className={field} type="text" name="full_name" autoComplete="name" placeholder="e.g. Sarah Jenkins" value={formData.full_name} onChange={handleChange} />
                  </Field>
                )}

                <Field label={isRegisterMode ? 'Email address' : 'Email or username'} labelClassName={label} required hideRequiredMark error={fieldErrors.email}>
                  <Input
                   
                    className={field}
                    type={isRegisterMode ? 'email' : 'text'}
                    name="email"
                    autoComplete={isRegisterMode ? 'email' : 'username'}
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </Field>

                <Field
                  label="Password"
                  labelClassName={label}
                  required
                  hideRequiredMark
                  error={fieldErrors.password}
                  labelAction={!isRegisterMode && (
                    <Button variant="link" onClick={() => setShowForgot(v => !v)} aria-expanded={showForgot} className="text-[13px] font-medium rounded">
                      Forgot password?
                    </Button>
                  )}
                >
                  <PasswordInput className={field} name="password" autoComplete={isRegisterMode ? 'new-password' : 'current-password'} placeholder="Enter your password" value={formData.password} onChange={handleChange} />
                </Field>

                {showForgot && !isRegisterMode && (
                  <Alert tone="info" onClose={() => setShowForgot(false)}>
                    Passwords are reset by your HQ administrator. Ask them to set a new one for you.
                  </Alert>
                )}

                {isRegisterMode && (
                  <>
                    <Field label="Confirm password" labelClassName={label} required hideRequiredMark error={fieldErrors.confirmPassword}>
                      <PasswordInput className={field} name="confirmPassword" autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Business" labelClassName={label} required hideRequiredMark error={fieldErrors.business_id}>
                        <div className="relative">
                          {selectedBusiness && <BusinessDot business={selectedBusiness} className="absolute left-3.5 top-1/2 -translate-y-1/2 z-[1] pointer-events-none" />}
                          <Select name="business_id" value={formData.business_id} onChange={handleChange} className={cn(field, selectedBusiness && 'pl-8')}>
                            <option value="">Select…</option>
                            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </Select>
                        </div>
                      </Field>
                      <Field label="Branch" labelClassName={label} required hideRequiredMark error={fieldErrors.branch_id}>
                        <Select name="branch_id" className={field} value={formData.branch_id} onChange={handleChange} disabled={!formData.business_id || branches.length === 0}>
                          <option value="">{formData.business_id ? 'Select…' : 'Business first'}</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                      </Field>
                    </div>
                  </>
                )}

                {!isRegisterMode && (
                  <Checkbox label="Remember me" checked={remember} onChange={e => setRemember(e.target.checked)} className="pt-1" />
                )}

                <Button type="submit" loading={submitting} fullWidth size="lg" className="group h-11 rounded-xl text-[15px] mt-2">
                  {submitting ? 'Please wait…' : isRegisterMode ? 'Send request' : 'Sign in'}
                  {!submitting && (
                    <ArrowRight className="w-4 h-4 transition-transform duration-fast ease-out group-hover:translate-x-0.5" aria-hidden="true" />
                  )}
                </Button>
              </form>
            </section>
          </div>
        </div>
      </main>

      <footer className="relative pb-6 px-4 text-center text-caption text-ink-muted">
        © {new Date().getFullYear()} HQ Inventory
        <span aria-hidden="true" className="mx-2">·</span>
        Illustrations by <a href="https://storyset.com" target="_blank" rel="noreferrer" className="rounded underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">Storyset</a>
      </footer>
    </div>
  );
}

/** Left panel (≥860px): feature carousel. Auto-advances every 5s; pauses on hover/focus and for reduced motion. */
function Showcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const t = setTimeout(() => setActive(a => (a + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused]);

  const slide = SLIDES[active];
  const Icon = slide.icon;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="HQ Inventory features"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="hidden min-[860px]:flex flex-col p-12 bg-subtle border-r border-line-soft"
    >
      <div className="relative flex-1 min-h-[17rem]">
        {SLIDES.map((s, i) => (
          <img
            key={s.title}
            src={s.img}
            alt=""
            draggable="false"
            className={cn(
              'illustration-adaptive absolute inset-0 m-auto max-h-full w-full object-contain transition-[opacity,transform] duration-500 ease-out',
              i === active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
          />
        ))}
      </div>

      <div key={active} className="mt-8 min-h-[4.5rem] animate-slide-up" aria-live="polite">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-ink">
          <Icon className="w-4 h-4 text-accent" aria-hidden="true" />
          {slide.title}
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">{slide.text}</p>
      </div>

      <div className="mt-6 flex items-center gap-1.5">
        {SLIDES.map((s, i) => (
          <ButtonBase
            key={s.title}
            onClick={() => setActive(i)}
            aria-label={`Show slide ${i + 1} of ${SLIDES.length}: ${s.title}`}
            aria-current={i === active ? 'true' : undefined}
            className="py-2 px-0.5 rounded-full group"
          >
            <span className={cn(
              'block h-1.5 rounded-full transition-all duration-base ease-out',
              i === active ? 'w-5 bg-accent' : 'w-1.5 bg-line-strong group-hover:bg-ink-subtle'
            )} />
          </ButtonBase>
        ))}
      </div>
    </section>
  );
}
