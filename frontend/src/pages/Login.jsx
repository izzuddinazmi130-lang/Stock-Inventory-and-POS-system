import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, ArrowRight, PackageCheck, Store, BarChart3 } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { Alert, BusinessDot, Button, ButtonBase, Field, Input, Select, SegmentedControl } from '../components/ui';
import { cn, prefersReducedMotion } from '../components/ui/cn';
import stockCheckImg from '../assets/illustrations/stock-check.webp';
import shopFloorImg from '../assets/illustrations/shop-floor.webp';
import reportsImg from '../assets/illustrations/reports.webp';

const SLIDES = [
  { img: stockCheckImg, icon: PackageCheck, title: 'Every item accounted for', text: 'Receive, count and restock with QR labels.' },
  { img: shopFloorImg, icon: Store, title: 'Made for the shop floor', text: 'Sell at the counter and keep every branch in step.' },
  { img: reportsImg, icon: BarChart3, title: 'Reports at a glance', text: 'Sales, low stock and movements in one place.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    business_id: '',
    branch_id: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    fetch('/api/auth/register-options').then(r => r.json()).then(d => {
      if (d.success) setBusinesses(d.data);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (isRegisterMode) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match.');
          setSubmitting(false);
          return;
        }
        if (!formData.business_id || !formData.branch_id) {
          setError('Please select a business and branch.');
          setSubmitting(false);
          return;
        }
        
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
          setFormData({ email: '', password: '', confirmPassword: '', full_name: '', business_id: '', branch_id: '' });
        } else {
          setError(data.message);
        }
      } else {
        const res = await login(formData.email, formData.password);
        if (res.success) {
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
  const switchMode = () => { setIsRegisterMode(!isRegisterMode); setError(''); setSuccess(''); };

  return (
    <div className="relative min-h-screen overflow-hidden bg-page flex flex-col">
      {/* Soft colour fields */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -left-40 w-[40rem] h-[40rem] rounded-full bg-violet/15 blur-3xl animate-drift" />
        <div className="absolute -bottom-56 -right-40 w-[38rem] h-[38rem] rounded-full bg-accent/15 blur-3xl animate-drift [animation-delay:-9s]" />
      </div>

      <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[60rem] grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] rounded-3xl border border-line/80 bg-surface shadow-modal overflow-hidden animate-scale-in">
          <Showcase />

          <section className="px-6 py-8 sm:px-10 sm:py-12 flex flex-col justify-center">
            <BrandMark withName className="md:hidden mb-8" />

            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
                {isRegisterMode ? 'Request an account' : 'Welcome back'}
              </h1>
              <p className="text-sm text-ink-muted mt-1.5">
                {isRegisterMode ? 'HQ reviews every request before you can sign in.' : 'Sign in to continue to HQ Inventory.'}
              </p>
            </div>

            <SegmentedControl
              fullWidth
              label="Choose sign in or account request"
              className="mb-6"
              value={isRegisterMode ? 'register' : 'signin'}
              onChange={v => { if ((v === 'register') !== isRegisterMode) switchMode(); }}
              tabs={[{ value: 'signin', label: 'Sign in' }, { value: 'register', label: 'Request access' }]}
            />

          {error && <Alert tone="danger" className="mb-5" onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert tone="success" className="mb-5" onClose={() => setSuccess('')}>{success}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            {isRegisterMode && (
              <Field label="Full name" required>
                <Input icon={User} type="text" name="full_name" required autoComplete="name" placeholder="e.g. Sarah Jenkins" value={formData.full_name} onChange={handleChange} />
              </Field>
            )}

            <Field label={isRegisterMode ? 'Email address' : 'Email or username'} required>
              <Input
                icon={Mail}
                type={isRegisterMode ? 'email' : 'text'}
                name="email"
                required
                autoComplete={isRegisterMode ? 'email' : 'username'}
                placeholder={isRegisterMode ? 'you@company.com' : 'you@company.com'}
                value={formData.email}
                onChange={handleChange}
              />
            </Field>

            <Field label="Password" required>
              <Input icon={Lock} type="password" name="password" required minLength={6} autoComplete={isRegisterMode ? 'new-password' : 'current-password'} placeholder="••••••••" value={formData.password} onChange={handleChange} />
            </Field>

            {isRegisterMode && (
              <>
                <Field label="Confirm password" required>
                  <Input icon={Lock} type="password" name="confirmPassword" autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Business" required>
                    <div className="relative">
                      {selectedBusiness && <BusinessDot business={selectedBusiness} className="absolute left-3 top-1/2 -translate-y-1/2 z-[1] pointer-events-none" />}
                      <Select name="business_id" value={formData.business_id} onChange={handleChange} className={selectedBusiness ? 'pl-7' : ''}>
                        <option value="">Select…</option>
                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </Select>
                    </div>
                  </Field>
                  <Field label="Branch" required>
                    <Select name="branch_id" value={formData.branch_id} onChange={handleChange} disabled={!formData.business_id || branches.length === 0}>
                      <option value="">{formData.business_id ? 'Select…' : 'Business first'}</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </Field>
                </div>
              </>
            )}

            <Button type="submit" loading={submitting} fullWidth size="lg" iconRight={submitting ? undefined : ArrowRight} className="mt-2">
              {submitting ? 'Please wait…' : isRegisterMode ? 'Send request' : 'Sign in'}
            </Button>
          </form>
          </section>
        </div>
      </main>

      <footer className="relative pb-6 px-4 text-center text-caption text-ink-muted">
        © {new Date().getFullYear()} HQ Inventory
        <span aria-hidden="true" className="mx-2 text-ink-subtle">·</span>
        Illustrations by <a href="https://storyset.com" target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-ink">Storyset</a>
      </footer>
    </div>
  );
}

/** Left half of the card (tablet and up): rotating illustrations with a short caption. */
function Showcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const t = setTimeout(() => setActive(a => (a + 1) % SLIDES.length), 6000);
    return () => clearTimeout(t);
  }, [active, paused]);

  const slide = SLIDES[active];
  const Icon = slide.icon;

  return (
    <section
      aria-label="About HQ Inventory"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative hidden md:flex flex-col p-10 bg-gradient-to-br from-violet-soft via-surface to-accent-soft border-r border-line-soft"
    >
      <BrandMark withName />

      <div className="relative flex-1 my-6 min-h-[18rem]">
        {SLIDES.map((s, i) => (
          <img
            key={s.title}
            src={s.img}
            alt=""
            draggable="false"
            className={cn(
              'absolute inset-0 m-auto max-h-full w-full object-contain mix-blend-multiply transition-[opacity,transform] duration-700 ease-out',
              i === active ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            )}
          />
        ))}
      </div>

      <div key={active} className="animate-slide-up" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-violet-soft border border-violet-line text-violet-fg flex items-center justify-center flex-shrink-0">
            <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{slide.title}</h2>
        </div>
        <p className="mt-2 text-sm text-ink-secondary">{slide.text}</p>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {SLIDES.map((s, i) => (
          <ButtonBase
            key={s.title}
            onClick={() => setActive(i)}
            aria-label={`Show slide ${i + 1}: ${s.title}`}
            aria-current={i === active ? 'true' : undefined}
            className="group py-2 rounded-full"
          >
            <span className={cn(
              'block h-1.5 rounded-full transition-all duration-base ease-out',
              i === active ? 'w-6 bg-violet' : 'w-1.5 bg-line-strong group-hover:bg-ink-subtle'
            )} />
          </ButtonBase>
        ))}
      </div>
    </section>
  );
}
