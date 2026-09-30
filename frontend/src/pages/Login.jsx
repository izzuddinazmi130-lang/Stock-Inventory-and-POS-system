import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, Building2, ScanLine, PackageMinus, ArrowRight } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { Alert, BusinessDot, Button, Field, Input, Select } from '../components/ui';

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
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel (large screens) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink text-white p-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div aria-hidden="true" className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-lg font-semibold tracking-tight">HQ Inventory</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold tracking-tight leading-tight">Stock, sales and every branch in one calm place.</h2>
          <ul className="mt-8 space-y-4 text-sm text-white/80">
            {[
              [ScanLine, 'Scan and sell at the counter, with receipts'],
              [PackageMinus, 'Low-stock alerts before shelves run empty'],
              [Building2, 'Each branch sees only its own data'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" aria-hidden="true" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-caption text-white/50">Multi-business inventory &amp; point of sale</p>
      </aside>

      {/* Form */}
      <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="lg:hidden flex justify-center mb-8"><BrandMark withName /></div>

          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {isRegisterMode ? 'Request an account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              {isRegisterMode ? 'HQ reviews every request before you can sign in.' : 'Sign in to manage stock and sales.'}
            </p>
          </div>

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

          <p className="mt-6 text-center text-sm text-ink-muted">
            {isRegisterMode ? 'Already have an account?' : 'New to the team?'}{' '}
            <Button variant="link" onClick={switchMode} className="text-sm font-semibold">
              {isRegisterMode ? 'Sign in' : 'Request an account'}
            </Button>
          </p>
        </div>
      </main>
    </div>
  );
}
