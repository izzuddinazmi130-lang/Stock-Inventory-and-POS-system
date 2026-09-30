import React from 'react';
import { FormSection, Field, Input, ChoiceCards } from '../ui/Form';

// Fields shared by every "add / edit branch" form.
// Pass `showStatus` on edit forms to let the branch be switched on or off.
export default function BranchFields({ form, setForm, showStatus = false }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <>
      <FormSection title="Branch identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Branch name" required>
            <Input required placeholder="e.g. Bangi Central" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Branch code" optional hint="Short code printed at the start of every SKU, e.g. KAF-BG.">
            <Input placeholder="e.g. KAF-BG" value={form.branch_code} onChange={e => setForm({ ...form, branch_code: e.target.value.toUpperCase() })} className="font-mono" />
          </Field>
        </div>
        {showStatus && (
          <Field label="Status">
            <ChoiceCards
              value={Number(form.is_active) === 0 ? 0 : 1}
              onChange={v => setForm({ ...form, is_active: Number(v) })}
              options={[
                { value: 1, label: 'Active', description: 'Open for sales and stock.' },
                { value: 0, label: 'Inactive', description: 'Hidden from day-to-day use; data is kept.' }
              ]}
            />
          </Field>
        )}
      </FormSection>

      <FormSection title="Location">
        <Field label="Street address" optional>
          <Input placeholder="Lot number, building, street" value={form.address} onChange={set('address')} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="City" optional>
            <Input placeholder="e.g. Bandar Baru Bangi" value={form.city} onChange={set('city')} />
          </Field>
          <Field label="State" optional>
            <Input placeholder="e.g. Selangor" value={form.state} onChange={set('state')} />
          </Field>
          <Field label="Postcode" optional>
            <Input inputMode="numeric" placeholder="e.g. 43650" value={form.postcode} onChange={set('postcode')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contact & opening">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Branch manager" optional>
            <Input placeholder="Full name" value={form.contact_person} onChange={set('contact_person')} />
          </Field>
          <Field label="Phone" optional>
            <Input type="tel" placeholder="+60 3-8920 1122" value={form.contact_phone} onChange={set('contact_phone')} />
          </Field>
          <Field label="Email" optional>
            <Input type="email" placeholder="branch@company.com" value={form.contact_email} onChange={set('contact_email')} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Operating hours" optional>
            <Input placeholder="e.g. Mon–Sun, 10am – 10pm" value={form.operating_hours} onChange={set('operating_hours')} />
          </Field>
          <Field label="Opening date" optional>
            <Input type="date" value={form.opening_date || ''} onChange={set('opening_date')} />
          </Field>
        </div>
      </FormSection>
    </>
  );
}
