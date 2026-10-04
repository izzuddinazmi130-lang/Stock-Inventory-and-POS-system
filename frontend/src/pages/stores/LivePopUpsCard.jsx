import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, ArrowRight, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { rm } from '../../components/pos/Receipt';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, cn, focusRing } from '../../components/ui';

/** Overview card (head office): pop-up stores running right now, today's sales, one click to each report. */
export default function LivePopUpsCard({ businessId }) {
  const { socket } = useSocket() || {};
  const [live, setLive] = useState(null);

  const load = useCallback(() => {
    api.get('/stores', { params: businessId ? { business_id: businessId } : {} })
      .then(res => { if (res.data.success) setLive((res.data.stores || []).filter(s => s.status === 'active')); })
      .catch(() => setLive(prev => prev || []));
  }, [businessId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!socket) return;
    socket.on('stock_movement', load);
    return () => socket.off('stock_movement', load);
  }, [socket, load]);

  const today = (live || []).reduce((sum, s) => sum + s.today_revenue, 0);

  return (
    <Card>
      <CardHeader
        icon={Radio}
        title="Live pop-up stores"
        description={live && live.length > 0 ? `${rm(today)} taken today` : undefined}
        actions={live && live.length > 0 && <Badge tone="success" size="sm">{live.length} live</Badge>}
      />
      <div className="p-2">
        {live === null ? (
          <div className="space-y-3 p-3">{[0, 1].map(i => <Skeleton key={i} className="h-8" />)}</div>
        ) : live.length === 0 ? (
          <EmptyState compact icon={Radio} title="No pop-up store is live right now" />
        ) : (
          <ul>
            {live.slice(0, 5).map(s => (
              <li key={s.id}>
                <Link to={`/stores/${s.id}/report`} className={cn('flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-subtle transition-colors', focusRing)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                    <p className="text-caption text-ink-muted truncate">{s.business_name} · {s.branch_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink">{rm(s.today_revenue)}</p>
                    <p className="text-[11px] text-ink-muted tabular-nums">{s.today_sales} {s.today_sales === 1 ? 'receipt' : 'receipts'} today</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-subtle flex-shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="px-3 pt-1 pb-2"><Button variant="link" size="sm" iconRight={ArrowRight} to="/stores">All pop-up stores</Button></div>
      </div>
    </Card>
  );
}
