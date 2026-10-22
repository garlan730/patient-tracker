import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Users, Clock, CheckCircle2, UserPlus, CalendarCheck, MessageSquare, ArrowRight, AlertTriangle } from 'lucide-react';
import { PROGRAMS, programOf, stepsFor } from '../lib/constants.js';
import { getProgress } from '../lib/patients.js';
import { daysSince, fmtDate, fmtDateTime, toDate } from '../lib/dates.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { useInventory } from '../lib/inventory.jsx';
import { Card, PageHeader, cx } from '../components/ui.jsx';

const BAR = '#507801'; // brand-700, the logo green
const AXIS = { fontSize: 11, fill: '#64748b' };

export default function Dashboard() {
  const { patients, doctors, doctorName } = useData();
  const { user } = useAuth();
  const { lowStock } = useInventory();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const program = PROGRAMS[params.get('program')] ? params.get('program') : 'tanam';
  // Tracker links keep the dashboard's program so the tracker opens on the matching tab.
  const trackerUrl = (query = '') => {
    const q = new URLSearchParams(query);
    if (program !== 'tanam') q.set('program', program);
    const str = q.toString();
    return `/tracker${str ? `?${str}` : ''}`;
  };

  const stats = useMemo(() => {
    const inProgram = patients.filter((p) => programOf(p) === program);
    const active = inProgram.filter((p) => !p.archived).map((p) => ({ p, pr: getProgress(p) }));
    const monthStart = startOfMonth(new Date());

    const byStage = PROGRAMS[program].steps.map((s) => ({
      id: s.id,
      label: s.label,
      count: active.filter(({ pr }) => pr.nextStep?.id === s.id).length,
    }));

    const byDoctor = doctors
      .map((d) => ({ id: d.id, label: d.name.replace(/^drg\.\s*/, '').split(',')[0], full: d.name, count: active.filter(({ p }) => p.doctorId === d.id).length }))
      .sort((a, b) => b.count - a.count);

    const months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(new Date(), 11 - i)));
    const monthly = months.map((m) => ({ key: format(m, 'yyyy-MM'), label: format(m, 'MMM yy'), count: 0 }));
    const activity = [];
    for (const p of inProgram) {
      for (const s of stepsFor(p)) {
        const st = p.steps?.[s.id];
        if (!st?.date) continue;
        const bucket = monthly.find((m) => m.key === st.date.slice(0, 7));
        if (bucket) bucket.count++;
        activity.push({ type: 'step', when: st.date, p, text: s.label, note: st.note });
      }
      for (const n of p.notes || []) activity.push({ type: 'note', when: n.createdAt, p, text: n.text, author: n.authorName });
    }
    activity.sort((a, b) => b.when.localeCompare(a.when));

    return {
      total: active.length,
      inProgress: active.filter(({ pr }) => pr.status === 'in_progress').length,
      completed: active.filter(({ pr }) => pr.status === 'completed').length,
      notStarted: active.filter(({ pr }) => pr.status === 'not_started').length,
      newThisMonth: active.filter(({ p }) => new Date(p.createdAt) >= monthStart).length,
      stepsLast30: activity.filter((a) => a.type === 'step' && daysSince(a.when) <= 30 && daysSince(a.when) >= 0).length,
      byStage,
      byDoctor,
      monthly,
      recent: activity.filter((a) => toDate(a.when.slice(0, 10)) <= new Date()).slice(0, 8),
    };
  }, [patients, doctors, program]);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description={`${PROGRAMS[program].label} · overview as of ${format(new Date(), 'EEEE, dd MMMM yyyy')}`}
        actions={
          <div className="inline-flex rounded-lg bg-slate-200/70 p-1" role="tablist">
            {Object.entries(PROGRAMS).map(([key, prog]) => (
              <button
                key={key}
                role="tab"
                aria-selected={program === key}
                onClick={() => setParams(key === 'tanam' ? {} : { program: key }, { replace: true })}
                className={cx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  program === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {prog.label}
              </button>
            ))}
          </div>
        }
      />

      {lowStock.length > 0 && (
        <Link
          to="/inventory"
          className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 hover:bg-red-100"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">
            <b>{lowStock.length} material{lowStock.length === 1 ? ' is' : 's are'} low on stock:</b>{' '}
            {lowStock.slice(0, 3).map((i) => i.name).join(', ')}{lowStock.length > 3 ? '…' : ''}
          </span>
          <ArrowRight size={14} />
        </Link>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Users} label="Active patients" value={stats.total} to={trackerUrl()} />
        <Kpi icon={Clock} label="In progress" value={stats.inProgress} to={trackerUrl("status=in_progress")} />
        <Kpi icon={CheckCircle2} label="Completed" value={stats.completed} to={trackerUrl("status=completed")} />
        <Kpi icon={UserPlus} label="New this month" value={stats.newThisMonth} to={trackerUrl("sort=created")} />
        <Kpi icon={CalendarCheck} label="Steps done (30 days)" value={stats.stepsLast30} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Patients by next step" subtitle="Where active patients are waiting. Click a bar to see them." className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.byStage} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={AXIS} interval={0} angle={-30} textAnchor="end" height={70} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTip unit="patient" />} />
              <Bar
                dataKey="count"
                fill={BAR}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                cursor="pointer"
                onClick={(d) => navigate(trackerUrl(`stage=${d.id ?? d.payload?.id}`))}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status breakdown" subtitle="Active patients">
          <div className="space-y-4 pt-2">
            {[
              { label: 'Not started', value: stats.notStarted, color: 'bg-slate-400', to: 'not_started' },
              { label: 'In progress', value: stats.inProgress, color: 'bg-amber-500', to: 'in_progress' },
              { label: 'Completed', value: stats.completed, color: 'bg-brand-600', to: 'completed' },
            ].map((s) => (
              <Link key={s.label} to={trackerUrl(`status=${s.to}`)} className="block rounded-lg p-1 hover:bg-slate-50">
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {s.value} <span className="font-normal text-slate-400">({stats.total ? Math.round((s.value / stats.total) * 100) : 0}%)</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${s.color}`} style={{ width: `${stats.total ? (s.value / stats.total) * 100 : 0}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Treatment steps per month" subtitle="Steps recorded, last 12 months" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTip unit="step" />} />
              <Bar dataKey="count" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Patients per doctor" subtitle="Active caseload">
          <ul className="space-y-3 pt-1">
            {stats.byDoctor.map((d) => {
              const max = stats.byDoctor[0]?.count || 1;
              return (
                <li key={d.id}>
                  <Link to={trackerUrl(`doctor=${d.id}`)} className="block rounded-lg p-1 hover:bg-slate-50" title={d.full}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate text-slate-600">{d.label}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{d.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${(d.count / max) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ChartCard>

        <ChartCard title="Recent activity" className="xl:col-span-3">
          {stats.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recent.map((a, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${a.type === 'note' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700'}`}>
                    {a.type === 'note' ? <MessageSquare size={14} /> : <CalendarCheck size={14} />}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-slate-700">
                      <span className="font-medium text-slate-900">{a.p.name}</span>
                      {a.type === 'step' ? <> · {a.text}</> : <> · note by {a.author}</>}
                      <span className="text-slate-400"> · {doctorName(a.p.doctorId)}</span>
                    </p>
                    {(a.type === 'note' ? a.text : a.note) && (
                      <p className="truncate text-xs text-slate-500">{a.type === 'note' ? a.text : a.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {a.type === 'note' ? fmtDateTime(a.when) : fmtDate(a.when)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to={trackerUrl()} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            Open tracker <ArrowRight size={14} />
          </Link>
        </ChartCard>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, to }) {
  const body = (
    <Card className={`p-4 ${to ? 'transition hover:border-brand-200 hover:shadow' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon size={18} className="text-slate-400" />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function ChartCard({ title, subtitle, className = '', children }) {
  return (
    <Card className={`p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-slate-500">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </Card>
  );
}

function ChartTip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const { label, count } = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-slate-900">{label}</p>
      <p className="text-slate-500">{count} {unit}{count === 1 ? '' : 's'}</p>
    </div>
  );
}
