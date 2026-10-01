import React, { useState } from 'react';
import api from '../../services/api';
import { Field, PasswordInput } from '../ui';

export const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' };

/**
 * Shared state + submit for changing your own password (account menu modal and the forced page after a reset).
 *   const pw = usePasswordChange();  …  <PasswordChangeFields {...pw} />  …  await pw.submit()
 * submit() resolves true on success; errors are shown inline under the fields.
 */
export function usePasswordChange() {
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => {
    setValues(v => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors(er => ({ ...er, [key]: undefined }));
  };

  const submit = async () => {
    const errs = {};
    if (!values.current) errs.current = 'Enter your current password.';
    if (!values.next) errs.next = 'Choose a new password.';
    else if (values.next.length < 6) errs.next = 'Use at least 6 characters.';
    else if (values.next === values.current) errs.next = 'Choose a password different from the current one.';
    if (values.next && values.confirm !== values.next) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return false;

    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: values.current, new_password: values.next });
      setValues(EMPTY_PASSWORDS);
      return true;
    } catch (err) {
      const { code, message } = err.response?.data || {};
      if (code === 'wrong_password') setErrors({ current: message });
      else if (code === 'same_password' || code === 'weak_password') setErrors({ next: message });
      else setErrors({ form: message || 'Could not change the password. Please try again.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { values, errors, saving, set, submit };
}

export function PasswordChangeFields({ values, errors, set, currentLabel = 'Current password', inputClassName, labelClassName }) {
  return (
    <div className="space-y-4">
      <Field label={currentLabel} labelClassName={labelClassName} error={errors.current}>
        <PasswordInput className={inputClassName} name="current-password" autoComplete="current-password" value={values.current} onChange={set('current')} autoFocus />
      </Field>
      <Field label="New password" labelClassName={labelClassName} error={errors.next} hint={!errors.next ? 'At least 6 characters.' : undefined}>
        <PasswordInput className={inputClassName} name="new-password" autoComplete="new-password" value={values.next} onChange={set('next')} />
      </Field>
      <Field label="Confirm new password" labelClassName={labelClassName} error={errors.confirm}>
        <PasswordInput className={inputClassName} name="confirm-password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />
      </Field>
    </div>
  );
}
