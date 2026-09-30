import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Boxes, Lock, Mail, User, ShieldAlert, CheckCircle, Building2 } from 'lucide-react';

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

  const inputClass = "bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full pl-10";
  const selectClass = "bg-white border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  const getBusinessColor = (name) => {
    if (name.toLowerCase().includes('kaftan')) return 'bg-[#B4502E]';
    if (name.toLowerCase().includes('astech')) return 'bg-[#2563EB]';
    return 'bg-slate-400';
  };

  return (
    <div className="min-h-screen bg-[#F1F3F9] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white mx-auto mb-4">
            <Boxes className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">HQ Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">Multi-Role Warehouse & Inventory Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && (
            <div>
              <label className={labelClass}>Full Name *</label>
              <div className="relative">
                <input type="text" name="full_name" required placeholder="e.g. Sarah Jenkins" value={formData.full_name} onChange={handleChange} className={inputClass} />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>{isRegisterMode ? 'Email Address *' : 'Email or Username *'}</label>
            <div className="relative">
              <input type={isRegisterMode ? 'email' : 'text'} name="email" required placeholder={isRegisterMode ? 'user@domain.com' : 'superadmin@hq.com'} value={formData.email} onChange={handleChange} className={inputClass} />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Password *</label>
            <div className="relative">
              <input type="password" name="password" required minLength={6} placeholder="••••••••" value={formData.password} onChange={handleChange} className={inputClass} />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {isRegisterMode && (
            <>
              <div>
                <label className={labelClass}>Business *</label>
                <div className="relative">
                  {formData.business_id && (
                    <span className={"absolute left-3 top-3.5 inline-block w-2 h-2 rounded-full " + getBusinessColor(businesses.find(b => b.id.toString() === formData.business_id)?.name || '')}></span>
                  )}
                  <select name="business_id" value={formData.business_id} onChange={handleChange} className={selectClass + (formData.business_id ? " pl-7" : "")}>
                    <option value="">— Select a business —</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Branch *</label>
                <select name="branch_id" value={formData.branch_id} onChange={handleChange} disabled={!formData.business_id || branches.length === 0} className={selectClass + " disabled:opacity-50 disabled:cursor-not-allowed"}>
                  <option value="">{formData.business_id ? '— Select a branch —' : '— Select a business first —'}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Confirm Password *</label>
                <div className="relative">
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" className={inputClass} />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors mt-2">
            {submitting ? 'Processing...' : isRegisterMode ? 'Submit Registration Request' : 'Sign In to Portal'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setError(''); setSuccess(''); }} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">
            {isRegisterMode ? 'Already have an account? Sign In' : 'Need an account? Submit Registration Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
