import React from 'react';
import { ShieldCheck, Store, Pencil, CheckCircle2, Lock, Building2 } from 'lucide-react';
import { Badge, BusinessDot, Button, ChoiceCards, Field, FormSection, Modal, Select, StatusPill } from '../../../components/ui';

export const relativeTime = (dt) => {
  if (!dt) return 'Never';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function RoleBadge({ role, size = 'sm' }) {
  return role === 'super_admin'
    ? <Badge tone="violet" size={size} icon={ShieldCheck}>Super admin</Badge>
    : <Badge tone="neutral" size={size} icon={Store}>Branch admin</Badge>;
}

// Role + business/branch assignment, shared by the Add and Edit user forms
export function UserAccessFields({ form, setForm, businesses, branches }) {
  return (
    <FormSection title="Access" description="Decide what this person can see and do.">
      <ChoiceCards
        name="Role"
        value={form.role}
        onChange={role => setForm({ ...form, role })}
        options={[
          { value: 'admin', icon: Store, label: 'Branch admin', description: 'Runs one branch: products, POS, stores, damage and reports for that branch.' },
          { value: 'super_admin', icon: ShieldCheck, label: 'Super admin', description: 'HQ access to every business, branch, user and setting.' },
        ]}
      />
      {form.role === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          <Field label="Business" required>
            <Select required value={form.business_id} onChange={e => setForm({ ...form, business_id: e.target.value, branch_id: '' })}>
              <option value="">Choose a business…</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Branch" required hint={form.business_id && branches.length === 0 ? 'This business has no branches yet.' : undefined}>
            <Select required value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })} disabled={!form.business_id || branches.length === 0}>
              <option value="">{form.business_id ? 'Choose a branch…' : 'Choose a business first'}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        </div>
      )}
    </FormSection>
  );
}

/** Read-only view of what a user can access. */
export function UserAccessModal({ user, allBranches, onClose, onEdit }) {
  const isSuper = user.role === 'super_admin';
  const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';
  return (
    <Modal
      title={user.full_name}
      description={user.email}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" icon={Pencil} onClick={onEdit} className="mr-auto">Change access</Button>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </>}
    >
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-ink text-white font-semibold flex items-center justify-center">{initial}</span>
        <div className="flex flex-wrap gap-1.5">
          <RoleBadge role={user.role} size="md" />
          <StatusPill kind="user" value={user.status} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 bg-subtle rounded-lg">
          <dt className="text-caption text-ink-muted">Last sign-in</dt>
          <dd className="font-medium text-ink mt-0.5">{relativeTime(user.last_login)}</dd>
        </div>
        <div className="p-3 bg-subtle rounded-lg">
          <dt className="text-caption text-ink-muted">Account created</dt>
          <dd className="font-medium text-ink mt-0.5">{user.created_at ? new Date(user.created_at).toLocaleDateString('en-MY', { dateStyle: 'medium' }) : '—'}</dd>
        </div>
      </dl>

      <section>
        <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-ink-muted" aria-hidden="true" /> Branch access</h3>
        {isSuper ? (
          <>
            <p className="text-sm text-ink-secondary mb-3">Super admins can manage every business and branch.</p>
            <ul className="space-y-1.5">
              {allBranches.map(br => (
                <li key={br.id} className="p-2.5 border border-line rounded-lg flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-success-fg flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium text-ink truncate">{br.name}</span>
                    <span className="text-caption text-ink-muted truncate">{br.business_name}</span>
                  </span>
                  <Badge tone="violet" size="sm">Full access</Badge>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 bg-success-soft border border-success-line rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{user.branch_name || 'No branch assigned'}</span>
                {user.branch_code && <Badge size="sm" className="font-mono">{user.branch_code}</Badge>}
              </div>
              <p className="text-caption text-ink-secondary mt-0.5 flex items-center gap-1.5">
                <BusinessDot business={{ id: user.business_id, name: user.business_name }} size="sm" />{user.business_name || 'No business'}
              </p>
              <p className="text-caption text-success-fg mt-2">Can manage stock, the POS, pop-up stores and damage records for this branch.</p>
            </div>
            {allBranches.filter(br => String(br.id) !== String(user.branch_id)).length > 0 && (
              <div>
                <p className="text-caption text-ink-muted mb-1.5">Other branches (no access)</p>
                <ul className="space-y-1.5">
                  {allBranches.filter(br => String(br.id) !== String(user.branch_id)).map(br => (
                    <li key={br.id} className="p-2.5 bg-subtle border border-line-soft rounded-lg flex items-center gap-2 text-sm text-ink-muted">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{br.name}</span>
                      <span className="text-caption truncate">· {br.business_name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </Modal>
  );
}
