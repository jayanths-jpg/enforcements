import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { format, subDays } from 'date-fns';
import { Search, ExternalLink, AlertTriangle, Download } from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

function Cell({ value }) {
  if (!value) return <span className="text-gray-300">—</span>;
  return <span>{value}</span>;
}

export default function Enforcements() {
  const thirtyDaysAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [sortCol, setSortCol] = useState('check_date');
  const [sortDir, setSortDir] = useState('desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['enforcements', from, to, search, state],
    queryFn: () => api.getEnforcements({ from, to, search: search || undefined, state: state || undefined, limit: 500 }),
  });

  const rows = data?.data || [];

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortCol] || '';
    const bv = b[sortCol] || '';
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="text-gray-300 ml-0.5">↕</span>;
    return <span className="text-gray-600 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function exportCsv() {
    const headers = ['Date','Person/Entity','Affiliation','Institution','City','State','Offense','URL'];
    const csvRows = [
      headers.join(','),
      ...sorted.map(r =>
        [r.check_date, r.person_or_entity, r.individual_affiliation, r.entity_name, r.city, r.state, r.offense, r.url]
          .map(v => `"${(v || '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fed-enforcements-${from}-to-${to}.csv`;
    a.click();
  }

  const thClass = 'text-left text-xs font-medium text-gray-500 pb-2 cursor-pointer hover:text-gray-800 whitespace-nowrap';

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Enforcements</h1>
          <p className="text-sm text-gray-500 mt-1">All extracted enforcement actions</p>
        </div>
        <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">From</label>
            <input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">To</label>
            <input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">State</label>
            <select className="input w-28" value={state} onChange={e => setState(e.target.value)}>
              <option value="">All states</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-xs text-gray-500">Search</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-7 w-full"
                placeholder="Name, bank, city, offense…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 self-end pb-2">
            {isLoading ? 'Loading…' : `${sorted.length} result${sorted.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 mb-4">
          {error.message}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className={thClass + ' pl-4'} onClick={() => toggleSort('check_date')}>
                  Date <SortIcon col="check_date" />
                </th>
                <th className={thClass} onClick={() => toggleSort('person_or_entity')}>
                  Person / entity <SortIcon col="person_or_entity" />
                </th>
                <th className={thClass} onClick={() => toggleSort('individual_affiliation')}>
                  Affiliation <SortIcon col="individual_affiliation" />
                </th>
                <th className={thClass} onClick={() => toggleSort('entity_name')}>
                  Institution <SortIcon col="entity_name" />
                </th>
                <th className={thClass} onClick={() => toggleSort('city')}>
                  City <SortIcon col="city" />
                </th>
                <th className={thClass} onClick={() => toggleSort('state')}>
                  State <SortIcon col="state" />
                </th>
                <th className={thClass}>Offense</th>
                <th className={thClass + ' pr-4'}>Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-12 text-sm">
                    No enforcement actions found for the selected filters.
                  </td>
                </tr>
              )}
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-4 font-medium whitespace-nowrap">
                    {format(new Date(r.check_date + 'T12:00:00Z'), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 max-w-32">
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                      <span className="font-medium">{r.person_or_entity || '—'}</span>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600 max-w-36 text-xs">
                    <Cell value={r.individual_affiliation} />
                  </td>
                  <td className="py-3 text-gray-700 max-w-36">
                    <Cell value={r.entity_name} />
                  </td>
                  <td className="py-3 text-gray-600 whitespace-nowrap">
                    <Cell value={r.city} />
                  </td>
                  <td className="py-3">
                    {r.state
                      ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.state}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 text-gray-600 text-xs max-w-48">
                    <Cell value={r.offense} />
                  </td>
                  <td className="py-3 pr-4">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
