import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { UserCheck, Check, X, Trash2, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PendingUsers() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/pending');
      if (res.data.success) {
        setPendingUsers(res.data.pendingUsers);
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id, name) => {
    if (!window.confirm(`Approve user registration for '${name}'? They will be granted immediate access.`)) return;
    try {
      const res = await api.post(`/users/${id}/approve`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchPending();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleReject = async (id, name) => {
    if (!window.confirm(`Decline registration request for '${name}'?`)) return;
    try {
      const res = await api.post(`/users/${id}/reject`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchPending();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pending record?')) return;
    try {
      const res = await api.delete(`/users/${id}`);
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchPending();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Pending User Approvals</h1>
          <p className="text-xs text-slate-400 mt-1">Review self-registration submissions, verify facility assignments, and grant access</p>
        </div>
        <Link to="/users" className="btn-modern btn-ghost">
          <Users className="w-4 h-4" /> User Directory
        </Link>
      </div>

      {/* Alert */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="data-panel">
        <div className="data-panel-header">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h6>Registration Queue ({pendingUsers.length} Pending)</h6>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Applicant Details</th>
                <th>Requested Role</th>
                <th>Business / Branch</th>
                <th>Submitted At</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-500">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-60" />
                    <h6 className="font-bold text-white text-sm">All Caught Up!</h6>
                    <p className="text-xs text-slate-400">There are currently no registration requests pending approval.</p>
                  </td>
                </tr>
              ) : (
                pendingUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-bold text-white">{u.full_name}</div>
                      <div className="font-mono text-xs text-indigo-400">{u.email}</div>
                    </td>
                    <td>
                      <span className={`badge-modern ${u.role === 'admin_kaftanasia' ? 'badge-gold' : 'badge-red'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className="text-white text-xs block">{u.business_name || '—'}</span>
                      <span className="text-slate-400 text-xs">{u.branch_name || '—'}</span>
                    </td>
                    <td className="text-xs font-mono text-slate-400">
                      {new Date(u.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge-modern badge-gold"><Clock className="w-3 h-3" /> PENDING</span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApprove(u.id, u.full_name)}
                          className="btn-modern btn-success-dark py-1 px-2.5 text-xs"
                          title="Approve Account"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(u.id, u.full_name)}
                          className="btn-modern btn-ghost text-amber-400 hover:bg-amber-500/20 py-1 px-2.5 text-xs"
                          title="Decline Request"
                        >
                          <X className="w-3.5 h-3.5" /> Decline
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="btn-modern btn-ghost text-rose-400 hover:bg-rose-500/20 py-1 px-2 text-xs"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
