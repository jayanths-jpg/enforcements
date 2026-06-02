import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { format, subDays } from 'date-fns';
import { Play, CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';

function LogRow({ entry }) {
  const date = entry.date
    ? format(new Date(entry.date + 'T12:00:00Z'), 'MMM d, yyyy')
    : '—';

  if (entry.type === 'start') {
    return (
      <div className="text-xs text-gray-500 py-1.5 border-b border-gray-50">
        Starting scrape of {entry.total} day{entry.total !== 1 ? 's' : ''}…
      </div>
    );
  }
  if (entry.type === 'done') {
    return (
      <div className="text-xs font-medium text-gray-700 py-1.5 border-b border-gray-50">
        Done — {entry.succeeded} succeeded, {entry.failed} failed.
      </div>
    );
  }
  if (entry.type === 'progress') {
    return (
      <div className="flex items-center gap-3 py-1.5 border-b border-gray-50 text-xs">
        <span className="text-gray-400 w-4 text-right">{entry.index}</span>
        <span className="font-medium w-28 text-gray-700">{date}</span>
        {entry.error ? (
          <>
            <XCircle size={12} className="text-red-400 flex-shrink-0" />
            <span className="text-red-600">{entry.error}</span>
          </>
        ) : !entry.page_exists ? (
          <>
            <Minus size={12} className="text-gray-300 flex-shrink-0" />
            <span className="text-gray-400">No page published</span>
          </>
        ) : entry.enforcement_count > 0 ? (
          <>
            <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
            <span className="text-amber-700 font-medium">
              {entry.enforcement_count} enforcement action{entry.enforcement_count !== 1 ? 's' : ''} found
            </span>
          </>
        ) : (
          <>
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
            <span className="text-gray-500">Page exists, no actions</span>
          </>
        )}
      </div>
    );
  }
  return null;
}

export default function Scraper() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const lastWeek = format(subDays(new Date(), 6), 'yyyy-MM-dd');

  const [from, setFrom] = useState(lastWeek);
  const [to, setTo] = useState(today);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const queryClient = useQueryClient();

  async function runScrape() {
    if (!from || !to || from > to) return;
    setRunning(true);
    setLog([]);
    setProgress(0);

    await api.scrapeRange(from, to, (event) => {
      setLog((prev) => [...prev, event]);
      if (event.type === 'start') setTotal(event.total);
      if (event.type === 'progress') setProgress(event.index);
      if (event.type === 'done') {
        queryClient.invalidateQueries();
      }
    });

    setRunning(false);
  }

  async function scrapeToday() {
    setRunning(true);
    setLog([{ type: 'start', total: 1 }]);
    setTotal(1);
    try {
      const result = await api.scrapeToday();
      setLog([
        { type: 'start', total: 1 },
        {
          type: 'progress',
          index: 1,
          date: result.date,
          page_exists: result.page_exists,
          enforcement_count: result.enforcements?.length || 0,
          error: result.error,
        },
        { type: 'done', succeeded: 1, failed: 0 },
      ]);
      queryClient.invalidateQueries();
    } catch (err) {
      setLog((prev) => [...prev, { type: 'done', succeeded: 0, failed: 1 }]);
    }
    setRunning(false);
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Run scraper</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fetch and extract enforcement actions from the Federal Reserve website
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Scrape today</h2>
          <p className="text-xs text-gray-500 mb-4">
            Fetch today's enforcement page ({today}) and store any actions found.
          </p>
          <button className="btn btn-primary" onClick={scrapeToday} disabled={running}>
            <Play size={13} /> Scrape today
          </button>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Scrape date range</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">From</label>
              <input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} max={to} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">To</label>
              <input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} min={from} max={today} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary" onClick={runScrape} disabled={running || !from || !to}>
              <Play size={13} /> {running ? 'Running…' : 'Run scrape'}
            </button>
            <button className="btn" disabled={running} onClick={() => { setFrom(format(subDays(new Date(), 6), 'yyyy-MM-dd')); setTo(today); }}>Last 7 days</button>
            <button className="btn" disabled={running} onClick={() => { setFrom(format(subDays(new Date(), 29), 'yyyy-MM-dd')); setTo(today); }}>Last 30 days</button>
          </div>
        </div>
      </div>

      {log.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Scrape log</h2>
            {running && (
              <span className="text-xs text-gray-500">{pct}% complete</span>
            )}
          </div>
          {running && total > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-gray-800 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <div className="font-mono bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">
            {log.map((entry, i) => <LogRow key={i} entry={entry} />)}
            {running && (
              <div className="text-xs text-gray-400 pt-1.5 animate-pulse">Fetching…</div>
            )}
          </div>
        </div>
      )}

      <div className="card p-5 mt-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">Daily automation setup</h2>
        <p className="text-xs text-gray-500 mb-3">
          Set up <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">cron-job.org</a> to automatically hit this endpoint every day at 9am:
        </p>
        <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-xs space-y-1">
          <div><span className="text-gray-500">URL: </span>POST {window.location.origin.replace('3000', '3001')}/api/scrape/today</div>
          <div><span className="text-gray-500">Header: </span>x-cron-secret: YOUR_CRON_SECRET</div>
          <div><span className="text-gray-500">Schedule: </span>0 9 * * 1-5</div>
        </div>
      </div>
    </div>
  );
}
