import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, PackageCheck, Store, BarChart3 } from 'lucide-react';
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet via-violet-hover to-accent flex flex-col">
      <Shapes />

      <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[64rem] grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] rounded-[2rem] bg-surface shadow-2xl shadow-ink/30 overflow-hidden animate-scale-in">
          <Showcase />

          <section className="px-7 py-10 sm:px-12 sm:py-14 flex flex-col justify-center">
            <div className="mb-8">
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight">
                {isRegisterMode ? 'Request an account' : 'Welcome back'}
              </h1>
              <p className="text-sm text-ink-muted mt-2">
                {isRegisterMode ? 'HQ reviews every request before you can sign in.' : 'Sign in to continue to HQ Inventory.'}
              </p>
            </div>

            <SegmentedControl
              fullWidth
              label="Choose sign in or account request"
              className="mb-7 rounded-xl"
              value={isRegisterMode ? 'register' : 'signin'}
              onChange={v => { if ((v === 'register') !== isRegisterMode) switchMode(); }}
              tabs={[{ value: 'signin', label: 'Sign in' }, { value: 'register', label: 'Request access' }]}
            />

            {error && <Alert tone="danger" className="mb-5" onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert tone="success" className="mb-5" onClose={() => setSuccess('')}>{success}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
              {isRegisterMode && (
                <Field label="Full name" required>
                  <Input className={line} type="text" name="full_name" required autoComplete="name" placeholder="e.g. Sarah Jenkins" value={formData.full_name} onChange={handleChange} />
                </Field>
              )}

              <Field label={isRegisterMode ? 'Email address' : 'Email or username'} required>
                <Input
                  className={line}
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
                <Input className={line} type="password" name="password" required minLength={6} autoComplete={isRegisterMode ? 'new-password' : 'current-password'} placeholder="••••••••" value={formData.password} onChange={handleChange} />
              </Field>

              {isRegisterMode && (
                <>
                  <Field label="Confirm password" required>
                    <Input className={line} type="password" name="confirmPassword" autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Business" required>
                      <div className="relative">
                        {selectedBusiness && <BusinessDot business={selectedBusiness} className="absolute left-0 top-1/2 -translate-y-1/2 z-[1] pointer-events-none" />}
                        <Select name="business_id" value={formData.business_id} onChange={handleChange} className={cn(line, selectedBusiness && 'pl-5')}>
                          <option value="">Select…</option>
                          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                      </div>
                    </Field>
                    <Field label="Branch" required>
                      <Select name="branch_id" className={line} value={formData.branch_id} onChange={handleChange} disabled={!formData.business_id || branches.length === 0}>
                        <option value="">{formData.business_id ? 'Select…' : 'Business first'}</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </Select>
                    </Field>
                  </div>
                </>
              )}

              <Button type="submit" loading={submitting} fullWidth size="lg" iconRight={submitting ? undefined : ArrowRight} className="mt-3 rounded-xl shadow-lg shadow-accent/25">
                {submitting ? 'Please wait…' : isRegisterMode ? 'Send request' : 'Sign in'}
              </Button>
            </form>
          </section>
        </div>
      </main>

      <footer className="relative pb-6 px-4 text-center text-caption text-white/70">
        © {new Date().getFullYear()} HQ Inventory
        <span aria-hidden="true" className="mx-2 text-white/40">·</span>
        Illustrations by <a href="https://storyset.com" target="_blank" rel="noreferrer" className="underline decoration-white/40 underline-offset-2 hover:text-white">Storyset</a>
      </footer>
    </div>
  );
}

/** Underline-style fields for the sign-in card. */
const line = 'h-11 rounded-none border-0 border-b border-line bg-transparent px-0 shadow-none hover:border-line-strong focus:border-accent focus:ring-0 disabled:bg-transparent';

/** Translucent rounded shapes floating over the purple page background. */
function Shapes() {
  // Each shape: [position/size + motion, look + rotation]. Rotation sits on the inner element so the
  // float/drift animation (which sets transform) doesn't cancel it.
  const items = [
    ['-top-24 -left-20 w-80 h-80 animate-drift', 'rounded-[3rem] bg-white/10 rotate-[24deg]'],
    ['top-16 right-[8%] w-40 h-56 animate-float', 'rounded-[2rem] bg-white/10 rotate-[18deg]'],
    ['bottom-[12%] -left-10 w-44 h-28 animate-float [animation-delay:-2s]', 'rounded-[1.75rem] bg-white/[0.07] -rotate-[20deg]'],
    ['-bottom-28 right-[18%] w-96 h-72 animate-drift [animation-delay:-9s]', 'rounded-[3rem] bg-white/[0.08] rotate-[28deg]'],
    ['top-[42%] right-[3%] w-16 h-16 animate-float [animation-delay:-4s]', 'rounded-2xl border border-white/25 rotate-12'],
    ['top-[8%] left-[38%] w-10 h-10 animate-float [animation-delay:-1s]', 'rounded-xl bg-white/15 -rotate-12'],
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {items.map(([outer, inner]) => (
        <div key={outer} className={`absolute ${outer}`}>
          <div className={`w-full h-full ${inner}`} />
        </div>
      ))}
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
      className="relative hidden md:flex flex-col justify-center p-10 lg:p-12 bg-gradient-to-br from-violet-soft via-accent-soft/60 to-surface overflow-hidden"
    >
      {/* Soft platform behind the illustration */}
      <div aria-hidden="true" className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[85%] aspect-square rounded-full bg-violet-muted/60 blur-2xl" />
      <div aria-hidden="true" className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[62%] aspect-square rounded-full border border-violet-line/60" />

      <div className="relative min-h-[20rem] flex-1 max-h-[24rem]">
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

      <div className="relative mt-8 flex items-end justify-between gap-6">
        <div key={active} className="animate-slide-up min-w-0" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-surface shadow-card text-violet-fg flex items-center justify-center flex-shrink-0">
              <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
            </span>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{slide.title}</h2>
          </div>
          <p className="mt-2 text-sm text-ink-secondary">{slide.text}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 pb-1">
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
                i === active ? 'w-6 bg-violet' : 'w-1.5 bg-violet-line group-hover:bg-violet/50'
              )} />
            </ButtonBase>
          ))}
        </div>
      </div>
    </section>
  );
}
