import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Sparkles, PenLine } from 'lucide-react';
import api from '../../../services/api';
import { Alert, Button, ChoiceCards, Field, Input, Modal, useToast } from '../../../components/ui';

/**
 * Super Admin: give a user who forgot their password a temporary one.
 * Passwords are stored hashed, so nobody can look them up; instead a temporary password is set, shown here
 * once, and the user must choose their own new password after signing in with it.
 */
export default function ResetPasswordModal({ user, onClose }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('generate');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // temporary password after a successful reset
  const [copied, setCopied] = useState(false);

  useEffect(() => { setMode('generate'); setCustom(''); setError(''); setResult(null); setCopied(false); }, [user?.id]);

  const reset = async (e) => {
    e.preventDefault();
    if (result) { onClose(); return; }
    if (mode === 'custom' && custom.trim().length < 6) { setError('Use at least 6 characters.'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/users/${user.id}/reset-password`, mode === 'custom' ? { password: custom.trim() } : {});
      setResult(res.data.temporary_password);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset the password.');
    } finally { setSaving(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Could not copy. Select the password and copy it manually.'); }
  };

  const firstName = user?.full_name?.split(' ')[0] || 'the user';

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={result ? 'Temporary password ready' : `Reset password for ${user?.full_name || ''}`}
      description={user?.email}
      icon={result ? Check : KeyRound}
      iconTone={result ? 'success' : 'accent'}
      onSubmit={reset}
      guardUnsaved={!result}
      footer={result ? (
        <Button type="submit">Done</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} icon={KeyRound}>Reset password</Button>
        </>
      )}
    >
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">Give this to {firstName} privately, in person or by direct message:</p>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle p-2 pl-4">
            <code className="flex-1 font-mono text-lg font-semibold tracking-wide text-ink select-all break-all">{result}</code>
            <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
          </div>
          <ul className="space-y-1.5 text-sm text-ink-secondary list-disc pl-5">
            <li>{firstName} signs in with it as usual.</li>
            <li>They are then asked to choose a new password before they can do anything else.</li>
            <li>This password is shown only now. If it gets lost, simply reset again.</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-ink-secondary">
            Passwords are stored encrypted, so nobody (not even a Super Admin) can see them. Instead you set a
            temporary password, and {firstName} chooses a new one the next time they sign in.
          </p>
          <Field label="Temporary password">
            <ChoiceCards
              name="Temporary password"
              value={mode}
              onChange={v => { setMode(v); setError(''); }}
              options={[
                { value: 'generate', icon: Sparkles, label: 'Generate one', description: 'A random, easy-to-read password like Kp7m-Xw3r-Tz.' },
                { value: 'custom', icon: PenLine, label: 'Type my own', description: 'Useful when telling it over the phone.' },
              ]}
            />
          </Field>
          {mode === 'custom' && (
            <Field label="Password to give them" error={error} hint={!error ? 'At least 6 characters.' : undefined}>
              <Input value={custom} onChange={e => { setCustom(e.target.value); setError(''); }} autoComplete="off" autoFocus />
            </Field>
          )}
          <Alert tone="warning">Their current password stops working straight away.</Alert>
        </div>
      )}
    </Modal>
  );
}
