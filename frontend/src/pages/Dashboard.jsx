import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { format, subDays } from 'date-fns';
import { AlertTriangle, Calendar, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

function Metric({ label, value, sub }) {
  return (
    <div className="metric-card">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ check }) {
  if (!check.page_exists && !check.error) {
    return <span className="badge badge-nopage">No page</span>;
  }
  if (check.error) {
    return <span className="badge badge-error">Error</span>;
  }
  if (check.enforcement_count > 0) {
    return (
      <span className="badge badge-found">
        <AlertTriangle size={10} />
        {check.enforcement_count} action{check.enforcement_count !== 1 ? 's' : ''}
      </span>
    );
  }
  return <span className="badge badge-none">None found</span>;
}

export default function Dashboard() {
  const thirtyDaysAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
  });

  const { data: checksData, isLoading: loadingChecks } = useQuery({
    queryKey: ['checks', thirtyDaysAgo, today],
    queryFn: () => api.getChecks({ from: thirtyDaysAgo, to: today }),
  });

  const checks = checksData?.data || [];
  const foundDays = checks.filter((c) => c.enforcement_count > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Federal Reserve enforcement action monitoring</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Metric
          label="Total days checked"
          value={loadingStats ? '…' : stats?.total_checks}
        />
        <Metric
          label="Total actions extracted"
          value={loadingStats ? '…' : stats?.total_enforcements}
        />
        <Metric
          label="Days with actions"
          value={loadingStats ? '…' : stats?.days_with_actions}
        />
        <Metric
          label="Last checked"
          value={loadingStats ? '…' : stats?.last_checked ? format(new Date(stats.last_checked + 'T12:00:00Z'), 'MMM d, yyyy') : 'Never'}
        />
      </div>

      {foundDays.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent enforcement actions (last 30 days)</h2>
          <div className="space-y-2">
            {foundDays.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {format(new Date(c.check_date + 'T12:00:00Z'), 'MMM d, yyyy')}
                  </span>
                  <StatusBadge check={c} />
                </div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Source <ExternalLink size={10} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Daily check log — last 30 days
          {loadingChecks && <span className="ml-2 text-xs font-normal text-gray-400">Loading…</span>}
        </h2>
        {checks.length === 0 && !loadingChecks && (
          <p className="text-sm text-gray-400 py-4 text-center">
            No data yet. Go to <strong>Run scraper</strong> to fetch some dates.
          </p>
        )}
        <div className="overflow-x-auto">
          {checks.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                  <th className="pb-2 font-medium">Checked at</th>
                  <th className="pb-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="py-2 font-medium">
                      {format(new Date(c.check_date + 'T12:00:00Z'), 'MMM d, yyyy')}
                    </td>
                    <td className="py-2"><StatusBadge check={c} /></td>
                    <td className="py-2 text-gray-600">{c.enforcement_count || 0}</td>
                    <td className="py-2 text-gray-400 text-xs">
                      {c.checked_at ? format(new Date(c.checked_at), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td className="py-2">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View <ExternalLink size={10} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
