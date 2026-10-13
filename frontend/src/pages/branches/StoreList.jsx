import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Store, Plus, Trash2, FileBarChart, Pencil, CircleStop, MapPin, Phone, Radio, CalendarClock, CircleSlash, List } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Modal, FormSection, Field, Input, Select, Textarea, Button, Card, CardHeader, Menu, PageHeader, StatusPill, Tabs,
  Table, THead, TBody, TH, TR, TD, TableState, EmptyState, useConfirm, useToast, cn,
} from '../../components/ui';
import { t, locale } from '../../i18n';

const PHASE_TO_STATUS = { during: 'active', before: 'upcoming', after: 'ended' };

// Helper: format full datetime string nicely (e.g. "18 Sep 2026, 10:00 AM")
function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Helper: extract 'YYYY-MM-DD' for date input
function toDateInputValue(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: extract 'HH:mm' for time input
function toTimeInputValue(val, defaultTime = '09:00') {
  if (!val) return defaultTime;
  const d = new Date(val);
  if (isNaN(d.getTime())) return defaultTime;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Helper: determine real-time phase (before, during, after)
function getStorePhase(store) {
  const now = Date.now();
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

  if (store.status === 'ended' || (eTime > 0 && now > eTime)) {
    return 'after'; // Ended / Concluded
  }
  if (sTime > 0 && now < sTime) {
    return 'before'; // Upcoming
  }
  if (sTime > 0 && eTime > 0 && now >= sTime && now <= eTime) {
    return 'during'; // Active / Happening Now
  }
  return store.status === 'active' ? 'during' : 'before';
}

// Helper: countdown or relative timing text
function getTimingStatusText(store, phase) {
  const now = Date.now();
  const sTime = store.start_date ? new Date(store.start_date).getTime() : 0;
  const eTime = store.end_date ? new Date(store.end_date).getTime() : 0;

  if (phase === 'before') {
    const diffMs = sTime - now;
    if (diffMs <= 0) return t('Starts shortly');
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return t('Starts in {days} day{value}{value2}', { days, value: days > 1 ? 's' : '', value2: remHours > 0 ? `, ${remHours}h` : '' });
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return t('Starts in {hours}h {value}m', { hours, value: mins % 60 });
    return t('Starts in {n} min{value}', { n: Math.max(1, mins), value: mins !== 1 ? 's' : '' });
  }

  if (phase === 'during') {
    const diffMs = eTime - now;
    if (diffMs <= 0) return t('Ending now');
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) {
      return t('Live Now • Closes in {days}d {remHours}h', { days, remHours });
    }
    const mins = Math.floor(diffMs / (1000 * 60));
    if (hours > 0) return t('Live Now • Ends in {hours}h {value}m', { hours, value: mins % 60 });
    return t('Live Now • Ends in {n} mins', { n: Math.max(1, mins) });
  }

  // Phase is 'after'
  if (store.ended_at || eTime > 0) {
    const closedTime = store.ended_at ? new Date(store.ended_at).getTime() : eTime;
    const diffMs = now - closedTime;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days > 0) return t('Concluded {days} day{value} ago', { days, value: days > 1 ? 's' : '' });
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) return t('Concluded {hours} hour{value} ago', { hours, value: hours > 1 ? 's' : '' });
    return t('Recently concluded');
  }

  return t('Concluded');
}

export default function StoreList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [branch, setBranch] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // `message` only carries errors shown inside the add/edit form; page messages are toasts
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  // Redirect branch admin if attempting to access another branch's store list
  useEffect(() => {
    if (user && !isSuperAdmin && user.branch_id && String(id) !== String(user.branch_id)) {
      navigate(`/branches/${user.branch_id}/stores`, { replace: true });
    }
  }, [user, isSuperAdmin, id, navigate]);

  // Filter tab: 'all' | 'during' (live) | 'before' (upcoming) | 'after' (concluded)
  const [filterTab, setFilterTab] = useState('all');

  // Detail Inspect Modal

  // Add Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    venue: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '22:00',
    person_in_charge: '',
    contact_phone: '',
    notes: ''
  });

  // Edit Form
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    name: '',
    venue: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '22:00',
    person_in_charge: '',
    contact_phone: '',
    notes: '',
    status: 'auto'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [brRes, stRes] = await Promise.all([
        api.get(`/branches/${id}`),
        api.get(`/branches/${id}/stores`)
      ]);
      if (brRes.data.success) setBranch(brRes.data.branch || brRes.data.data);
      if (stRes.data.success) setStores(stRes.data.stores || stRes.data.data || []);
    } catch (err) {
      setLoadError(err.response?.data?.message || t('Could not load the pop-up stores.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Compute counts for filter tabs
  const phaseCounts = useMemo(() => {
    let before = 0, during = 0, after = 0;
    stores.forEach(s => {
      const p = getStorePhase(s);
      if (p === 'before') before++;
      else if (p === 'during') during++;
      else if (p === 'after') after++;
    });
    return { before, during, after, all: stores.length };
  }, [stores]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (filterTab === 'all') return stores;
    return stores.filter(s => getStorePhase(s) === filterTab);
  }, [stores, filterTab]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const startDateTime = `${addForm.start_date} ${addForm.start_time}:00`;
      const endDateTime = `${addForm.end_date} ${addForm.end_time}:00`;

      if (new Date(endDateTime) < new Date(startDateTime)) {
        setMessage({ type: 'danger', text: t('End date and time cannot be earlier than start date and time.') });
        return;
      }

      setSaving(true);
      const res = await api.post('/stores', {
        branch_id: id,
        name: addForm.name,
        venue: addForm.venue,
        start_date: startDateTime,
        end_date: endDateTime,
        person_in_charge: addForm.person_in_charge,
        contact_phone: addForm.contact_phone,
        notes: addForm.notes
      });

      if (res.data.success) {
        toast.success(res.data.message);
        setMessage(null);
        setShowAddModal(false);
        setAddForm({
          name: '', venue: '', start_date: '', start_time: '09:00',
          end_date: '', end_time: '22:00', person_in_charge: '', contact_phone: '', notes: ''
        });
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || t('Could not create the pop-up store') });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const startDateTime = `${editForm.start_date} ${editForm.start_time}:00`;
      const endDateTime = `${editForm.end_date} ${editForm.end_time}:00`;

      if (new Date(endDateTime) < new Date(startDateTime)) {
        setMessage({ type: 'danger', text: t('End date and time cannot be earlier than start date and time.') });
        return;
      }

      setSaving(true);
      const res = await api.put(`/stores/${editForm.id}`, {
        name: editForm.name,
        venue: editForm.venue,
        start_date: startDateTime,
        end_date: endDateTime,
        person_in_charge: editForm.person_in_charge,
        contact_phone: editForm.contact_phone,
        notes: editForm.notes,
        status: editForm.status
      });

      if (res.data.success) {
        toast.success(res.data.message);
        setMessage(null);
        setShowEditModal(false);
        fetchData();
      } else {
        setMessage({ type: 'danger', text: res.data.message || t('Could not save the pop-up store') });
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (storeId, storeName) => {
    const ok = await confirm({
      title: t('Close {storeName} now?', { storeName }),
      message: t('The store closes straight away, before its planned end time.'),
      confirmLabel: t('Close store'),
    });
    if (!ok) return;
    try {
      const res = await api.put(`/stores/${storeId}/close`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchData();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = async (s) => {
    const phase = getStorePhase(s);
    if (phase === 'during') {
      toast.warning(t('{name} is live right now. End the event first, then delete it.', { name: s.name }));
      return;
    }

    const ok = await confirm({
      title: t('Delete {name}?', { name: s.name }),
      message: t('This permanently deletes the pop-up store. It cannot be undone.'),
      confirmLabel: t('Delete event'),
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await api.delete(`/stores/${s.id}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchData();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const openEditModal = (s) => {
    setEditForm({
      id: s.id,
      name: s.name || '',
      venue: s.venue || '',
      start_date: toDateInputValue(s.start_date),
      start_time: toTimeInputValue(s.start_date, '09:00'),
      end_date: toDateInputValue(s.end_date),
      end_time: toTimeInputValue(s.end_date, '22:00'),
      person_in_charge: s.person_in_charge || '',
      contact_phone: s.contact_phone || '',
      notes: s.notes || s.description || '',
      status: 'auto'
    });
    setMessage(null);
    setShowEditModal(true);
  };

  const openAdd = () => { setMessage(null); setShowAddModal(true); };
  const phaseTabs = [
    { value: 'all', label: t('All'), count: phaseCounts.all, icon: List },
    { value: 'during', label: t('Live now'), count: phaseCounts.during, icon: Radio },
    { value: 'before', label: t('Upcoming'), count: phaseCounts.before, icon: CalendarClock },
    { value: 'after', label: t('Ended'), count: phaseCounts.after, icon: CircleSlash },
  ];

  return (
    <Layout>
      <PageHeader
        breadcrumbs={isSuperAdmin
          ? [
            { label: t('Businesses'), to: '/businesses' },
            { label: branch?.business_name || t('Business'), to: `/businesses/${branch?.business_id}/branches` },
            { label: branch?.name || t('Branch'), to: `/branches/${id}` },
            { label: t('Pop-up stores') },
          ]
          : [{ label: t('Pop-up stores') }]}
        title={t('Pop-up stores')}
        description={t('Pop-ups, bazaars and booths run by {name}. Each event has its own sales report.', { name: branch?.name || t('this branch') })}
        actions={<>
          <Button variant="secondary" icon={FileBarChart} to={`/branches/${id}/floor-report`}>{t('Branch counter sales')}</Button>
          <Button icon={Plus} onClick={openAdd}>{t('Add pop-up store')}</Button>
        </>}
      />

      <Tabs value={filterTab} onChange={setFilterTab} tabs={phaseTabs} label={t('Filter pop-up stores')} className="mb-4" />

      {!loading && !loadError && stores.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title={t('No pop-up stores yet')}
            description={t('Add a booth, bazaar or pop-up store to see its sales separately.')}
            action={<Button icon={Plus} onClick={openAdd}>{t('Add pop-up store')}</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={t('Schedule')}
            description={loading && stores.length === 0 ? t('Loading…') : t('{n} {n|store|stores}', { n: filteredStores.length })}
          />
          <Table minWidth="54rem">
            <THead>
              <TR>
                <TH>{t('Event')}</TH>
                <TH>{t('When')}</TH>
                <TH>{t('Status')}</TH>
                <TH>{t('Person in charge')}</TH>
                <TH className="w-px"><span className="sr-only">{t('Actions')}</span></TH>
              </TR>
            </THead>
            <TBody>
              <TableState
                colSpan={5}
                loading={loading && stores.length === 0}
                error={!loading && loadError && stores.length === 0 ? loadError : null}
                onRetry={fetchData}
                empty={!loading && !loadError && stores.length > 0 && filteredStores.length === 0}
                emptyIcon={Store}
                emptyTitle={t('No pop-up stores here')}
                emptyAction={<Button variant="secondary" size="sm" onClick={() => setFilterTab('all')}>{t('Show all')}</Button>}
              />
              {filteredStores.map((s, i) => {
                const phase = getStorePhase(s);
                const live = phase === 'during';
                return (
                  <TR key={s.id} index={i} className={cn(live && '[&>td]:bg-success-soft/30')}>
                    <TD className="max-w-[18rem]">
                      <div className="font-medium text-ink flex items-center gap-2">
                        <span className="truncate">{s.name}</span>
                        {live && (
                          <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-caption text-ink-muted mt-0.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{s.venue || t('No venue set')}</span>
                      </div>
                    </TD>
                    <TD>
                      <dl className="text-caption space-y-0.5 tabular-nums">
                        <div className="flex gap-2"><dt className="w-9 text-ink-muted">{t('Start')}</dt><dd className="text-ink whitespace-nowrap">{formatDateTime(s.start_date)}</dd></div>
                        <div className="flex gap-2"><dt className="w-9 text-ink-muted">{t('End')}</dt><dd className="text-ink-secondary whitespace-nowrap">{formatDateTime(s.end_date)}</dd></div>
                      </dl>
                    </TD>
                    <TD>
                      <StatusPill kind="store" value={PHASE_TO_STATUS[phase]} size="sm" />
                      <div className="text-caption text-ink-muted mt-1">{getTimingStatusText(s, phase)}</div>
                    </TD>
                    <TD>
                      <div className="text-sm text-ink">{s.person_in_charge || t('HQ staff')}</div>
                      {s.contact_phone && (
                        <div className="text-caption text-ink-muted flex items-center gap-1 mt-0.5 tabular-nums">
                          <Phone className="w-3 h-3" aria-hidden="true" /> {s.contact_phone}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant={live ? 'primary' : 'secondary'} size="sm" icon={FileBarChart} onClick={() => navigate(`/stores/${s.id}/report`)}>
                          {live ? t('Live report') : t('Report')}
                        </Button>
                        <Menu
                          label={t('More actions for {name}', { name: s.name })}
                          items={[
                            { label: t('Edit'), icon: Pencil, onClick: () => openEditModal(s) },
                            { label: t('Close store now'), icon: CircleStop, onClick: () => handleClose(s.id, s.name), hidden: !live },
                            { divider: true },
                            { label: live ? t('Delete (end it first)') : t('Delete event'), icon: Trash2, tone: 'danger', disabled: live, onClick: () => handleDelete(s) },
                          ]}
                        />
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {/* ── Add Store Event Modal ── */}
      {showAddModal && (
        <Modal
          icon={Store}
          title={t('Add a pop-up store')}
          description={t('A pop-up, bazaar or booth run by {name}. Sales made during it are reported separately.', { name: branch?.name || t('this branch') })}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={saving}>{t('Create pop-up store')}</Button>
          </>}
        >
          <StoreFields form={addForm} setForm={setAddForm} />
        </Modal>
      )}

      {/* ── Edit Store Event Modal ── */}
      {showEditModal && (
        <Modal
          icon={Pencil}
          title={t('Edit {value}', { value: editForm.name || 'pop-up store' })}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          error={message?.type === 'danger' ? message.text : null}
          onDismissError={() => setMessage(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={saving}>{t('Save changes')}</Button>
          </>}
        >
          <StoreFields form={editForm} setForm={setEditForm} showStatus />
        </Modal>
      )}
    </Layout>
  );
}

// "18 Sep, 9:00 AM" for the schedule summary
function formatScheduleEnd(date, time) {
  const d = new Date(`${date}T${time || '00:00'}`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

// Fields shared by the Add and Edit store-event forms
function StoreFields({ form, setForm, showStatus = false }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const start = form.start_date ? new Date(`${form.start_date}T${form.start_time || '00:00'}`) : null;
  const end = form.end_date ? new Date(`${form.end_date}T${form.end_time || '00:00'}`) : null;
  const endBeforeStart = start && end && end < start;
  const days = start && end && !endBeforeStart
    ? Math.round((new Date(form.end_date) - new Date(form.start_date)) / 86400000) + 1
    : null;

  return (
    <>
      <FormSection title={t('Event')}>
        <Field label={t('Store name')} required>
          <Input required placeholder={t('e.g. Ramadan Bazaar 2026')} value={form.name} onChange={set('name')} />
        </Field>
        <Field label={t('Venue')} optional>
          <Input placeholder={t('e.g. Mid Valley Southkey, Ground Floor, Booth 12')} value={form.venue} onChange={set('venue')} />
        </Field>
      </FormSection>

      <FormSection title={t('Schedule')} description={t('The store opens and closes by itself at these times.')}>
        <div className="grid grid-cols-[4rem_1fr_7.5rem] gap-2 items-center">
          <span className="text-sm font-medium text-ink">{t('Starts')}<span className="text-danger-fg">*</span></span>
          <Input type="date" required value={form.start_date}
            onChange={e => setForm({ ...form, start_date: e.target.value, end_date: form.end_date || e.target.value })} />
          <Input type="time" required value={form.start_time} onChange={set('start_time')} />

          <span className="text-sm font-medium text-ink">{t('Ends')}<span className="text-danger-fg">*</span></span>
          <Input type="date" required min={form.start_date || undefined} value={form.end_date} onChange={set('end_date')} error={endBeforeStart} />
          <Input type="time" required value={form.end_time} onChange={set('end_time')} error={endBeforeStart} />
        </div>
        {endBeforeStart ? (
          <p className="text-caption text-danger-fg">{t('The end is before the start. Check the dates and times.')}</p>
        ) : days ? (
          <p className="text-caption text-ink-muted">
            {t('Runs')}{' '}{days === 1 ? t('1 day') : t('{days} days', { days })}: {formatScheduleEnd(form.start_date, form.start_time)} → {formatScheduleEnd(form.end_date, form.end_time)}
          </p>
        ) : null}

        {showStatus && (
          <Field label={t('Status')} hint={t('Leave on Automatic unless you need to open or close the store early.')}>
            <Select value={form.status} onChange={set('status')}>
              <option value="auto">{t('Automatic (follows the schedule above)')}</option>
              <option value="upcoming">{t('Upcoming')}</option>
              <option value="active">{t('Live now')}</option>
              <option value="ended">{t('Ended')}</option>
            </Select>
          </Field>
        )}
      </FormSection>

      <FormSection title={t('Person in charge')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('Name')} optional>
            <Input placeholder={t('Who runs the store')} value={form.person_in_charge} onChange={set('person_in_charge')} />
          </Field>
          <Field label={t('Phone')} optional>
            <Input type="tel" placeholder="+60 12-345 6789" value={form.contact_phone} onChange={set('contact_phone')} />
          </Field>
        </div>
        <Field label={t('Notes')} optional>
          <Textarea rows={2} placeholder={t('Booth size, expected crowd, special instructions…')} value={form.notes} onChange={set('notes')} />
        </Field>
      </FormSection>
    </>
  );
}
