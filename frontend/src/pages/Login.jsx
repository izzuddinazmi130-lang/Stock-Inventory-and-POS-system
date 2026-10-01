import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, ArrowRight, Package, QrCode, Receipt, BarChart3, Tags, Boxes } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { Alert, BusinessDot, Button, Field, Input, Select, SegmentedControl } from '../components/ui';

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
      <LoginBackdrop />

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="relative w-full max-w-[26rem] animate-scale-in">
          {/* Glow behind the card */}
          <div aria-hidden="true" className="absolute -inset-px rounded-2xl bg-gradient-to-b from-accent/25 via-violet/10 to-transparent blur-xl" />

          <div className="relative rounded-2xl border border-line/80 bg-surface/85 backdrop-blur-xl shadow-modal px-6 py-8 sm:px-9 sm:py-10">
            <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />

            <div className="flex flex-col items-center text-center mb-7">
              <div className="relative mb-5">
                <div aria-hidden="true" className="absolute inset-0 rounded-xl bg-accent/40 blur-lg" />
                <BrandMark size="lg" className="relative" />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
                {isRegisterMode ? 'Request an account' : 'Welcome back'}
              </h1>
              <p className="text-sm text-ink-muted mt-1.5 max-w-[18rem]">
                {isRegisterMode ? 'HQ reviews every request before you can sign in.' : 'Sign in to HQ Inventory to continue.'}
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
          </div>
        </div>
      </main>

      <footer className="relative pb-6 text-center text-caption text-ink-muted">
        © {new Date().getFullYear()} HQ Inventory · Inventory &amp; point of sale
      </footer>
    </div>
  );
}

/** Decorative background: drifting colour fields, a fading dot grid and floating inventory glyphs. */
function LoginBackdrop() {
  const tiles = [
    { Icon: Package, className: 'left-[12%] top-[18%]', delay: '0s' },
    { Icon: QrCode, className: 'left-[20%] bottom-[20%]', delay: '1.5s' },
    { Icon: Receipt, className: 'right-[13%] top-[24%]', delay: '0.8s' },
    { Icon: BarChart3, className: 'right-[19%] bottom-[16%]', delay: '2.2s' },
    { Icon: Tags, className: 'left-[6%] top-[52%]', delay: '3s' },
    { Icon: Boxes, className: 'right-[6%] top-[56%]', delay: '1.1s' },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-accent/20 blur-3xl animate-drift" />
      <div className="absolute -bottom-48 -right-24 w-[34rem] h-[34rem] rounded-full bg-violet/20 blur-3xl animate-drift [animation-delay:-6s]" />
      <div className="absolute top-1/3 left-1/2 w-[22rem] h-[22rem] -translate-x-1/2 rounded-full bg-info/10 blur-3xl animate-drift [animation-delay:-12s]" />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(rgb(var(--ink-subtle) / 0.45) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
        }}
      />
      {tiles.map(({ Icon, className, delay }) => (
        <div
          key={className}
          className={`absolute hidden lg:flex w-14 h-14 items-center justify-center rounded-2xl border border-line/80 bg-surface/70 backdrop-blur shadow-card text-accent/70 animate-float ${className}`}
          style={{ animationDelay: delay }}
        >
          <Icon className="w-6 h-6" />
        </div>
      ))}
    </div>
  );
}
