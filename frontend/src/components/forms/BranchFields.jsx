import React from 'react';
import { FormSection, Field, Input, Select, ChoiceCards } from '../ui/Form';
import { t } from '../../i18n';

// Malaysian states and federal territories for the State dropdown
const MALAYSIAN_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang',
  'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur', 'W.P. Labuan', 'W.P. Putrajaya',
];

// Fields shared by every "add / edit branch" form.
// Pass `showStatus` on edit forms to let the branch be switched on or off.
export default function BranchFields({ form, setForm, showStatus = false }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <>
      <FormSection title={t('Branch identity')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('Branch name')} required>
            <Input required placeholder={t('e.g. Kuala Terengganu')} value={form.name} onChange={set('name')} />
          </Field>
          <Field label={t('Branch code')} optional hint={t('Short code printed at the start of every SKU, e.g. KAF-KT.')}>
            <Input placeholder={t('e.g. KAF-KT')} value={form.branch_code} onChange={e => setForm({ ...form, branch_code: e.target.value.toUpperCase() })} className="font-mono" />
          </Field>
        </div>
        {showStatus && (
          <Field label={t('Status')}>
            <ChoiceCards
              value={Number(form.is_active) === 0 ? 0 : 1}
              onChange={v => setForm({ ...form, is_active: Number(v) })}
              options={[
                { value: 1, label: t('Active'), description: t('Open for sales and stock.') },
                { value: 0, label: t('Inactive'), description: t('Hidden from day-to-day use; data is kept.') }
              ]}
            />
          </Field>
        )}
      </FormSection>

      <FormSection title={t('Location')}>
        <Field label={t('Street address')} optional>
          <Input placeholder={t('Lot number, building, street')} value={form.address} onChange={set('address')} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={t('City')} optional>
            <Input placeholder={t('e.g. Chendering')} value={form.city} onChange={set('city')} />
          </Field>
          <Field label={t('State')} optional>
            <Select value={form.state || ''} onChange={set('state')}>
              <option value="">{t('Select a state…')}</option>
              {MALAYSIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
              {/* A state saved earlier as free text stays selectable, so editing the branch doesn't drop it */}
              {form.state && !MALAYSIAN_STATES.includes(form.state) && <option value={form.state}>{form.state}</option>}
            </Select>
          </Field>
          <Field label={t('Postcode')} optional>
            <Input inputMode="numeric" placeholder="e.g. 20000" value={form.postcode} onChange={set('postcode')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t('Contact & opening')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={t('Branch manager')} optional>
            <Input placeholder={t('Full name')} value={form.contact_person} onChange={set('contact_person')} />
          </Field>
          <Field label={t('Phone')} optional>
            <Input type="tel" placeholder="+60 12-33445566" value={form.contact_phone} onChange={set('contact_phone')} />
          </Field>
          <Field label={t('Email')} optional>
            <Input type="email" placeholder="you@gmail.com" value={form.contact_email} onChange={set('contact_email')} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('Operating hours')} optional>
            <Input placeholder={t('e.g. Mon–Sun, 10am – 10pm')} value={form.operating_hours} onChange={set('operating_hours')} />
          </Field>
          <Field label={t('Opening date')} optional>
            <Input type="date" value={form.opening_date || ''} onChange={set('opening_date')} />
          </Field>
        </div>
      </FormSection>
    </>
  );
}
