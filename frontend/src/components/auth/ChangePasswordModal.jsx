import React from 'react';
import { KeyRound } from 'lucide-react';
import { Alert, Button, Modal, useToast } from '../ui';
import { PasswordChangeFields, usePasswordChange } from './PasswordChangeFields';
import { t } from '../../i18n';

/** "Change password" from the account menu. */
export default function ChangePasswordModal({ open, onClose }) {
  const pw = usePasswordChange();
  const { toast } = useToast();

  const save = async (e) => {
    e.preventDefault();
    if (await pw.submit()) {
      toast.success(t('Password changed. Use the new one next time you sign in.'));
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('Change password')}
      description={t('You stay signed in on this device.')}
      icon={KeyRound}
      onSubmit={save}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" loading={pw.saving}>{t('Change password')}</Button>
        </>
      )}
    >
      {pw.errors.form && <Alert tone="danger">{pw.errors.form}</Alert>}
      <PasswordChangeFields {...pw} />
    </Modal>
  );
}
