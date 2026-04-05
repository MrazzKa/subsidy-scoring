import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = import.meta.env.VITE_API_URL || '';

const COLORS = {
  bg: '#0a0e1a',
  card: '#131829',
  cardHover: '#1a2035',
  border: '#1e2a45',
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accent1: '#8b5cf6',
  accent2: '#ec4899',
};

const FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace";

const RISK_COLORS = {
  recommended: COLORS.success,
  low_risk: COLORS.primary,
  medium_risk: COLORS.warning,
  high_risk: COLORS.danger,
};

const RISK_LABELS = {
  recommended: 'Рекомендована',
  low_risk: 'Низкий риск',
  medium_risk: 'Средний риск',
  high_risk: 'Высокий риск',
};

const TABS = [
  'Обзор', 'Регионы', 'Модель', 'Рейтинг', 'FIFO vs Merit',
  'Нормативная база', 'Оценить заявку', 'AI-ассистент', 'Загрузить данные',
];

// ── Styles ──
const styles = {
  app: { fontFamily: FONT, background: COLORS.bg, color: COLORS.text, minHeight: '100vh', fontSize: 13 },
  header: { padding: '18px 32px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: COLORS.primary, letterSpacing: 1 },
  tabs: { display: 'flex', gap: 4, padding: '8px 32px', borderBottom: `1px solid ${COLORS.border}`, overflowX: 'auto', flexWrap: 'wrap' },
  tab: (a) => ({ padding: '8px 16px', cursor: 'pointer', borderRadius: 6, fontSize: 12, fontWeight: a ? 600 : 400, background: a ? COLORS.primary : 'transparent', color: a ? '#fff' : COLORS.textMuted, border: 'none', fontFamily: FONT, transition: 'all .15s' }),
  main: { padding: '24px 32px', maxWidth: 1400, margin: '0 auto' },
  card: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 600, marginBottom: 12, color: COLORS.text },
  metric: { textAlign: 'center', padding: 16 },
  metricVal: { fontSize: 28, fontWeight: 700, color: COLORS.primary },
  metricLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  grid: (cols) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 600, fontSize: 11 },
  td: { padding: '8px 12px', borderBottom: `1px solid ${COLORS.border}22` },
  badge: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}44` }),
  input: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '8px 12px', color: COLORS.text, fontFamily: FONT, fontSize: 12, width: '100%', boxSizing: 'border-box' },
  select: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '8px 12px', color: COLORS.text, fontFamily: FONT, fontSize: 12, width: '100%', boxSizing: 'border-box' },
  btn: (color = COLORS.primary) => ({ background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600 }),
  btnOutline: { background: 'transparent', color: COLORS.primary, border: `1px solid ${COLORS.primary}`, borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: FONT, fontSize: 12 },
  hil: { background: `${COLORS.warning}11`, border: `1px solid ${COLORS.warning}33`, borderRadius: 8, padding: 16, marginTop: 16, fontSize: 12, color: COLORS.warning },
};

const fmt = (n) => n != null ? Number(n).toLocaleString('ru-RU') : '—';
const fmtScore = (n) => n != null ? Number(n).toFixed(1) : '—';

function App() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    fetch(API + '/api/stats')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  if (loading) return (
    <div style={{ ...styles.app, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16, animation: 'spin 1s linear infinite' }}>&#9881;</div>
        <div style={{ color: COLORS.textMuted }}>Загрузка данных...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...styles.app, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ ...styles.card, maxWidth: 500, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12, color: COLORS.danger }}>Ошибка загрузки</div>
        <div style={{ color: COLORS.textMuted, marginBottom: 16 }}>{error}</div>
        <button style={styles.btn()} onClick={loadData}>Повторить</button>
      </div>
    </div>
  );

  const pages = [
    <Overview data={data} />,
    <Regions data={data} />,
    <Model data={data} />,
    <Ranking data={data} />,
    <FifoVsMerit data={data} />,
    <Regulatory />,
    <ScoreForm data={data} />,
    <AiChat />,
    <Upload onDone={loadData} />,
  ];

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.title}>SubsidyScore AI</span>
        <span style={{ color: COLORS.textDim, fontSize: 11 }}>Merit-Based Scoring System | Kazakhstan</span>
      </div>
      <div style={styles.tabs}>
        {TABS.map((t, i) => <button key={i} style={styles.tab(i === tab)} onClick={() => setTab(i)}>{t}</button>)}
      </div>
      <div style={styles.main}>{pages[tab]}</div>
    </div>
  );
}

// ════════════════════════════════════════════════
// Tab 0: Обзор
// ════════════════════════════════════════════════
function Overview({ data }) {
  const ov = data.overview || {};
  const mf = data.merit_formula || {};
  const directionStatsSorted = [...(data.direction_stats || [])].sort((a, b) => b.count - a.count);
  return (
    <>
      <div style={styles.grid(5)}>
        {[
          { v: fmt(ov.total_applications), l: 'Всего заявок' },
          { v: fmtScore(ov.avg_score), l: 'Средний Merit Score' },
          { v: fmt(ov.recommended), l: 'Рекомендовано' },
          { v: `${ov.pct_recommended || 0}%`, l: '% рекомендованных' },
          { v: `${(ov.total_amount / 1e9).toFixed(1)} млрд`, l: 'Общая сумма (тг)' },
        ].map((m, i) => (
          <div key={i} style={styles.card}>
            <div style={styles.metric}><div style={styles.metricVal}>{m.v}</div><div style={styles.metricLabel}>{m.l}</div></div>
          </div>
        ))}
      </div>

      {mf.formula && (
        <div style={{ ...styles.card, textAlign: 'center', fontSize: 14, fontWeight: 600, color: COLORS.info }}>
          {mf.formula}
        </div>
      )}

      <div style={styles.grid(2)}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Распределение скоров</div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.score_distribution || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="range" tick={{ fill: COLORS.textDim, fontSize: 10 }} />
              <YAxis tick={{ fill: COLORS.textDim, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
              <Area type="monotone" dataKey="count" stroke={COLORS.primary} fill={`${COLORS.primary}33`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Распределение рисков</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={(data.risk_distribution || []).map(r => ({ ...r, name: RISK_LABELS[r.level] || r.level }))} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {(data.risk_distribution || []).map((r, i) => <Cell key={i} fill={RISK_COLORS[r.level] || COLORS.textDim} />)}
              </Pie>
              <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Статистика по направлениям</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={directionStatsSorted} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis type="number" tick={{ fill: COLORS.textDim, fontSize: 10 }} />
            <YAxis dataKey="direction" type="category" width={200} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
            <Bar dataKey="count" fill={COLORS.primary} name="Заявок" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.hil}>
        Human-in-the-Loop: Система предоставляет рекомендации на основе данных и НПА РК. Финальное решение по каждой заявке принимает комиссия.
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 1: Регионы
// ════════════════════════════════════════════════
function Regions({ data }) {
  const rs = [...(data.region_stats || [])].sort((a, b) => b.avg_score - a.avg_score);
  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Средний Merit Score по регионам</div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={rs} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: COLORS.textDim, fontSize: 10 }} />
            <YAxis dataKey="region" type="category" width={220} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
            <Bar dataKey="avg_score" fill={COLORS.success} name="Ср. Merit Score" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Детали по регионам</div>
        <table style={styles.table}>
          <thead>
            <tr>{['Регион', 'Заявок', 'Ср. скор', 'Рекомендовано', '% рекоменд.'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rs.map((r, i) => (
              <tr key={i}>
                <td style={styles.td}>{r.region}</td>
                <td style={styles.td}>{fmt(r.count)}</td>
                <td style={styles.td}>{fmtScore(r.avg_score)}</td>
                <td style={styles.td}>{fmt(r.recommended)}</td>
                <td style={styles.td}><span style={styles.badge(r.pct_recommended >= 50 ? COLORS.success : COLORS.warning)}>{r.pct_recommended}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 2: Модель
// ════════════════════════════════════════════════
function Model({ data }) {
  const mr = data.model_results || {};
  const tv = data.temporal_validation || {};
  const fi = data.feature_importance || [];
  const fa = data.fairness_audit || {};
  const mf = data.merit_formula || {};

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Кросс-валидация (5-fold CV)</div>
        <table style={styles.table}>
          <thead><tr>{['Модель', 'AUC', 'Accuracy', 'F1', 'Precision', 'Recall'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
          <tbody>
            {Object.entries(mr).map(([name, m]) => (
              <tr key={name}>
                <td style={{ ...styles.td, fontWeight: 600 }}>{name}</td>
                <td style={styles.td}>{m.auc}</td><td style={styles.td}>{m.acc}</td>
                <td style={styles.td}>{m.f1}</td><td style={styles.td}>{m.prec}</td><td style={styles.td}>{m.rec}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(tv).length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Temporal Validation (80/20 по дате)</div>
          <table style={styles.table}>
            <thead><tr>{['Модель', 'AUC', 'Accuracy', 'F1', 'Train', 'Test'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
            <tbody>
              {Object.entries(tv).map(([name, m]) => (
                <tr key={name}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{name}</td>
                  <td style={styles.td}>{m.auc}</td><td style={styles.td}>{m.acc}</td><td style={styles.td}>{m.f1}</td>
                  <td style={styles.td}>{fmt(m.train_size)}</td><td style={styles.td}>{fmt(m.test_size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.cardTitle}>Feature Importance (Top-15)</div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={fi.slice(0, 15)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis type="number" tick={{ fill: COLORS.textDim, fontSize: 10 }} />
            <YAxis dataKey="feature" type="category" width={220} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
            <Bar dataKey="importance" fill={COLORS.accent1} name="Importance" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {fa.cv != null && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Fairness Audit</div>
          <div style={styles.grid(3)}>
            <div style={styles.metric}><div style={{ ...styles.metricVal, color: fa.is_fair ? COLORS.success : COLORS.warning }}>{fa.cv}%</div><div style={styles.metricLabel}>CV между регионами</div></div>
            <div style={styles.metric}><div style={styles.metricVal}>{fa.min_pct}%</div><div style={styles.metricLabel}>Мин. % рекомендованных</div></div>
            <div style={styles.metric}><div style={styles.metricVal}>{fa.max_pct}%</div><div style={styles.metricLabel}>Макс. % рекомендованных</div></div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: fa.is_fair ? COLORS.success : COLORS.warning }}>
            {fa.is_fair ? 'Система справедлива: разброс между регионами < 10%' : 'Внимание: значительный разброс между регионами'}
          </div>
        </div>
      )}

      {mf.components && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Методология Merit Score</div>
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: COLORS.info, marginBottom: 16 }}>{mf.formula}</div>
          <div style={styles.grid(5)}>
            {mf.components.map((c, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 12, background: `${COLORS.primary}11`, borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.primary }}>{(c.weight * 100).toFixed(0)}%</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 3: Рейтинг
// ════════════════════════════════════════════════
function Ranking({ data }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ region: '', direction: '', min_score: 0, max_score: 100, risk_level: '', search: '', anomaly_only: false });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const limit = 20;

  const fetchRanking = () => {
    const p = new URLSearchParams();
    if (filters.region) p.set('region', filters.region);
    if (filters.direction) p.set('direction', filters.direction);
    if (filters.min_score > 0) p.set('min_score', filters.min_score);
    if (filters.max_score < 100) p.set('max_score', filters.max_score);
    if (filters.risk_level) p.set('risk_level', filters.risk_level);
    if (filters.search) p.set('search', filters.search);
    if (filters.anomaly_only) p.set('anomaly_only', 'true');
    p.set('limit', limit);
    p.set('offset', page * limit);
    fetch(API + '/api/ranking?' + p.toString())
      .then(r => r.json())
      .then(d => { setRows(d.data || []); setTotal(d.total || 0); })
      .catch(() => {});
  };

  useEffect(fetchRanking, [page, filters]);

  const showDetail = (reqNum) => {
    const rn = String(reqNum).replace('.0', '');
    setSelected(rn);
    fetch(API + '/api/explain/' + rn).then(r => r.json()).then(setDetail).catch(() => setDetail(null));
  };

  const regions = (data.region_stats || []).map(r => r.region);
  const directions = (data.direction_stats || []).map(d => d.direction);

  const exportUrl = () => {
    const p = new URLSearchParams();
    p.set('format', 'xlsx');
    if (filters.region) p.set('region', filters.region);
    if (filters.min_score > 0) p.set('min_score', filters.min_score);
    return API + '/api/export/ranking?' + p.toString();
  };

  return (
    <>
      <div style={{ ...styles.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Регион</div>
          <select style={styles.select} value={filters.region} onChange={e => { setFilters({ ...filters, region: e.target.value }); setPage(0); }}>
            <option value="">Все</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Направление</div>
          <select style={styles.select} value={filters.direction} onChange={e => { setFilters({ ...filters, direction: e.target.value }); setPage(0); }}>
            <option value="">Все</option>
            {directions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 80px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Мин. скор</div>
          <input type="number" style={styles.input} value={filters.min_score} onChange={e => { setFilters({ ...filters, min_score: +e.target.value }); setPage(0); }} />
        </div>
        <div style={{ flex: '0 0 80px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Макс. скор</div>
          <input type="number" style={styles.input} value={filters.max_score} onChange={e => { setFilters({ ...filters, max_score: +e.target.value }); setPage(0); }} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Уровень риска</div>
          <select style={styles.select} value={filters.risk_level} onChange={e => { setFilters({ ...filters, risk_level: e.target.value }); setPage(0); }}>
            <option value="">Все</option>
            {Object.entries(RISK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Поиск (номер заявки)</div>
          <input style={styles.input} value={filters.search} placeholder="1200100..." onChange={e => { setFilters({ ...filters, search: e.target.value }); setPage(0); }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: COLORS.textMuted, cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.anomaly_only} onChange={e => { setFilters({ ...filters, anomaly_only: e.target.checked }); setPage(0); }} />
          Только аномалии
        </label>
        <a href={exportUrl()} download style={{ ...styles.btn(COLORS.success), textDecoration: 'none', fontSize: 11, padding: '8px 14px' }}>Скачать Excel</a>
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Найдено: {fmt(total)}</span>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Стр. {page + 1} / {Math.max(1, Math.ceil(total / limit))}</span>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>{['Заявка', 'Регион', 'Направление', 'Сумма', 'Merit Score', 'Статус', ''].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rn = String(r.request_num || '').replace('.0', '');
              return (
                <tr key={i} style={{ cursor: 'pointer', background: selected === rn ? `${COLORS.primary}11` : 'transparent' }} onClick={() => showDetail(r.request_num)}>
                  <td style={styles.td}>{rn} {r.is_anomaly && <span style={styles.badge(COLORS.danger)}>Аномалия</span>}</td>
                  <td style={styles.td}>{r.region}</td>
                  <td style={styles.td}>{r.direction}</td>
                  <td style={styles.td}>{fmt(r.amount)}</td>
                  <td style={styles.td}><span style={{ fontWeight: 700, color: (r.merit_score || 0) >= 70 ? COLORS.success : COLORS.warning }}>{fmtScore(r.merit_score)}</span></td>
                  <td style={styles.td}><span style={styles.badge(RISK_COLORS[r.merit_risk_level] || COLORS.textDim)}>{RISK_LABELS[r.merit_risk_level] || r.merit_risk_level}</span></td>
                  <td style={styles.td}><span style={{ color: COLORS.primary, fontSize: 11 }}>Детали</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
          <button style={styles.btnOutline} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Назад</button>
          <button style={styles.btnOutline} disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Далее</button>
        </div>
      </div>

      {detail && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Детали заявки #{detail.request_num}</div>
          <div style={styles.grid(3)}>
            <div><span style={{ color: COLORS.textMuted }}>Регион:</span> {detail.region}</div>
            <div><span style={{ color: COLORS.textMuted }}>Направление:</span> {detail.direction}</div>
            <div><span style={{ color: COLORS.textMuted }}>Сумма:</span> {fmt(detail.amount)} тг</div>
          </div>

          <div style={{ ...styles.grid(5), marginTop: 16 }}>
            {[
              { l: 'Efficiency', v: detail.efficiency_score, c: COLORS.primary },
              { l: 'Reliability', v: detail.reliability_score, c: COLORS.info },
              { l: 'Need', v: detail.need_score, c: COLORS.accent1 },
              { l: 'Regulatory', v: detail.regulatory_score, c: COLORS.warning },
              { l: 'ML Score', v: detail.ml_score, c: COLORS.accent2 },
            ].map((c, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 12, background: `${c.c}11`, borderRadius: 8, border: `1px solid ${c.c}33` }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c.c }}>{fmtScore(c.v)}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>{c.l}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: (detail.merit_score || detail.score || 0) >= 70 ? COLORS.success : COLORS.warning }}>
              {fmtScore(detail.merit_score || detail.score)}
            </span>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Merit Score</div>
            <span style={styles.badge(RISK_COLORS[detail.risk_level] || COLORS.textDim)}>{RISK_LABELS[detail.risk_level] || detail.risk_level}</span>
          </div>

          {detail.regulatory_explanation && (
            <div style={{ marginTop: 12, padding: 12, background: `${COLORS.info}11`, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: COLORS.info }}>Нормативная оценка</div>
              {(detail.regulatory_explanation.factors || []).map((f, i) => <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>{f}</div>)}
              {(detail.regulatory_explanation.npa_references || []).map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginRight: 8, fontSize: 10, color: COLORS.primary }}>{r.id}</a>
              ))}
            </div>
          )}

          {detail.improvement_tips && detail.improvement_tips.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: `${COLORS.success}11`, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: COLORS.success }}>Рекомендации по улучшению</div>
              {detail.improvement_tips.map((t, i) => (
                <div key={i} style={{ fontSize: 11, marginBottom: 8, display: 'flex', gap: 8 }}>
                  <span style={styles.badge(COLORS.success)}>+{t.gain}</span>
                  <span>{t.tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 4: FIFO vs Merit
// ════════════════════════════════════════════════
function FifoVsMerit({ data }) {
  const fm = data.fifo_vs_merit || {};
  const [budget, setBudget] = useState(1000000000);
  const [sim, setSim] = useState(null);

  const runSim = () => {
    fetch(API + '/api/budget-simulation?budget=' + budget)
      .then(r => r.json()).then(setSim).catch(() => {});
  };

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>FIFO vs Merit-Based (топ-1000)</div>
        <div style={styles.grid(4)}>
          <div style={styles.metric}><div style={styles.metricVal}>{fm.fifo_top1000_avg_score}</div><div style={styles.metricLabel}>FIFO ср. скор</div></div>
          <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.success }}>{fm.merit_top1000_avg_score}</div><div style={styles.metricLabel}>Merit ср. скор</div></div>
          <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.success }}>+{fm.score_improvement_pct}%</div><div style={styles.metricLabel}>Улучшение</div></div>
          <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.danger }}>{fm.fifo_top1000_high_risk_count} &rarr; {fm.merit_top1000_high_risk_count}</div><div style={styles.metricLabel}>High risk в топ-1000</div></div>
        </div>
        {fm.risk_comparison && (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={fm.risk_comparison}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="level" tick={{ fill: COLORS.textDim, fontSize: 10 }} />
              <YAxis tick={{ fill: COLORS.textDim, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fifo" fill={COLORS.warning} name="FIFO" />
              <Bar dataKey="merit" fill={COLORS.success} name="Merit" />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>{fm.budget_efficiency_gain}</div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Бюджетный симулятор</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Бюджет (тенге)</div>
            <input type="number" style={styles.input} value={budget} onChange={e => setBudget(+e.target.value)} />
          </div>
          <button style={styles.btn()} onClick={runSim}>Рассчитать</button>
        </div>
        {sim && (
          <div style={{ ...styles.grid(3), marginTop: 16 }}>
            <div style={styles.metric}>
              <div style={styles.metricVal}>{fmt(sim.fifo?.funded)}</div>
              <div style={styles.metricLabel}>FIFO: профинансировано (ср. {fmtScore(sim.fifo?.avg_score)})</div>
            </div>
            <div style={styles.metric}>
              <div style={{ ...styles.metricVal, color: COLORS.success }}>{fmt(sim.merit?.funded)}</div>
              <div style={styles.metricLabel}>Merit: профинансировано (ср. {fmtScore(sim.merit?.avg_score)})</div>
            </div>
            <div style={styles.metric}>
              <div style={{ ...styles.metricVal, color: COLORS.success }}>+{sim.improvement_pct}%</div>
              <div style={styles.metricLabel}>Улучшение качества</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 5: Нормативная база
// ════════════════════════════════════════════════
function Regulatory() {
  const [info, setInfo] = useState(null);
  useEffect(() => { fetch(API + '/api/regulatory/info').then(r => r.json()).then(setInfo).catch(() => {}); }, []);
  if (!info) return <div style={styles.card}>Загрузка...</div>;

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Нормативно-правовые акты РК</div>
        <div style={styles.grid(3)}>
          {(info.documents || []).map((d, i) => (
            <div key={i} style={{ padding: 16, background: `${COLORS.info}11`, borderRadius: 8, border: `1px solid ${COLORS.info}33` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{d.authority}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>{d.usage}</div>
              <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: COLORS.primary }}>{d.id} &rarr; adilet.zan.kz</a>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Направления субсидирования и приоритеты</div>
        <table style={styles.table}>
          <thead><tr>{['Направление', 'Приоритет', 'Диапазон норматива (тг)', 'Описание'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
          <tbody>
            {Object.entries(info.livestock_norms || {}).map(([name, n]) => (
              <tr key={name}>
                <td style={styles.td}>{name}</td>
                <td style={styles.td}><span style={styles.badge(n.priority === 'high' ? COLORS.success : n.priority === 'medium' ? COLORS.warning : COLORS.textDim)}>{n.priority}</span></td>
                <td style={styles.td}>{fmt(n.normative_range?.[0])} — {fmt(n.normative_range?.[1])}</td>
                <td style={{ ...styles.td, color: COLORS.textMuted }}>{n.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Пастбищные зоны (V1500011064)</div>
        <div style={styles.grid(2)}>
          <div>
            <table style={styles.table}>
              <thead><tr>{['Зона', 'Норма (усл.гол/га)', 'Описание'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(info.pasture_zones || {}).map(([z, v]) => (
                  <tr key={z}><td style={styles.td}>{z}</td><td style={styles.td}>{v.norm}</td><td style={{ ...styles.td, color: COLORS.textMuted }}>{v.desc}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <table style={styles.table}>
              <thead><tr>{['Регион', 'Зона'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(info.region_zones || {}).map(([r, z]) => (
                  <tr key={r}><td style={styles.td}>{r}</td><td style={styles.td}>{z}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 6: Оценить заявку
// ════════════════════════════════════════════════
function ScoreForm({ data }) {
  const regions = (data.region_stats || []).map(r => r.region);
  const directions = (data.direction_stats || []).map(d => d.direction);
  const [form, setForm] = useState({ region: '', direction: '', district: '', subsidy_name: '', normative: 0, amount: 0, hour: 12, month: 1, day_of_week: 0 });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const submit = () => {
    setErr('');
    fetch(API + '/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      .then(r => { if (!r.ok) throw new Error('Ошибка скоринга'); return r.json(); })
      .then(setResult).catch(e => setErr(e.message));
  };

  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Оценить новую заявку</div>
        <div style={styles.grid(3)}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Регион</div>
            <select style={styles.select} value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}>
              <option value="">Выберите</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Направление</div>
            <select style={styles.select} value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
              <option value="">Выберите</option>
              {directions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Район</div>
            <input style={styles.input} value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Название субсидии</div>
            <input style={styles.input} value={form.subsidy_name} onChange={e => setForm({ ...form, subsidy_name: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Норматив (тг)</div>
            <input type="number" style={styles.input} value={form.normative} onChange={e => setForm({ ...form, normative: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Сумма (тг)</div>
            <input type="number" style={styles.input} value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Час подачи</div>
            <input type="number" min="0" max="23" style={styles.input} value={form.hour} onChange={e => setForm({ ...form, hour: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Месяц</div>
            <input type="number" min="1" max="12" style={styles.input} value={form.month} onChange={e => setForm({ ...form, month: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>День недели</div>
            <select style={styles.select} value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: +e.target.value })}>
              {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button style={styles.btn()} onClick={submit}>Оценить</button>
        </div>
        {err && <div style={{ marginTop: 8, color: COLORS.danger, fontSize: 12 }}>{err}</div>}
      </div>

      {result && (
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: result.merit_score >= 70 ? COLORS.success : result.merit_score >= 50 ? COLORS.warning : COLORS.danger }}>
              {fmtScore(result.merit_score)}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>Merit Score</div>
            <span style={styles.badge(RISK_COLORS[result.risk_level] || COLORS.textDim)}>{RISK_LABELS[result.risk_level] || result.risk_level}</span>
          </div>

          <div style={styles.grid(5)}>
            {result.components && Object.entries(result.components).map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center', padding: 12, background: `${COLORS.primary}11`, borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.primary }}>{fmtScore(v)}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>{k}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: 12, background: `${COLORS.success}11`, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {result.recommendation}
          </div>

          {result.regulatory_explanation && (
            <div style={{ marginTop: 12, padding: 12, background: `${COLORS.info}11`, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: COLORS.info }}>Нормативная оценка</div>
              {(result.regulatory_explanation.factors || []).map((f, i) => <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>{f}</div>)}
            </div>
          )}
        </div>
      )}

      <div style={styles.hil}>
        Human-in-the-Loop: Оценка носит рекомендательный характер. Окончательное решение принимается комиссией на основе полного пакета документов.
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 7: AI-ассистент
// ════════════════════════════════════════════════
function AiChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const hints = [
    'Какой регион самый эффективный?',
    'Объясни Merit Score',
    'Сравни скотоводство и птицеводство',
    'Какие заявки аномальные?',
    'Как улучшить заявку из Атырау?',
  ];

  const send = (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    const newMsgs = [...messages, { role: 'user', content: msg }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    const history = newMsgs.map(m => ({ role: m.role, content: m.content }));
    fetch(API + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, history: history.slice(-10) }) })
      .then(r => { if (!r.ok) throw new Error('Ошибка AI'); return r.json(); })
      .then(d => setMessages(prev => [...prev, { role: 'assistant', content: d.answer }]))
      .catch(e => setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${e.message}. Убедитесь что GROQ_API_KEY настроен.` }]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {hints.map((h, i) => <button key={i} style={styles.btnOutline} onClick={() => send(h)}>{h}</button>)}
      </div>

      <div style={{ ...styles.card, height: 450, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textDim }}>Задайте вопрос о субсидиях, скоринге или данных</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? COLORS.success : `${COLORS.textDim}22`,
              color: m.role === 'user' ? '#fff' : COLORS.text,
            }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ color: COLORS.textMuted, fontSize: 12, padding: 8 }}>Думаю...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input style={{ ...styles.input, flex: 1 }} placeholder="Введите вопрос..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button style={styles.btn()} onClick={() => send()} disabled={loading}>Отправить</button>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 8: Загрузить данные
// ════════════════════════════════════════════════
function Upload({ onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState(null);
  const [polling, setPolling] = useState(false);

  const doPreview = (f) => {
    setFile(f);
    const fd = new FormData(); fd.append('file', f);
    fetch(API + '/api/upload/preview', { method: 'POST', body: fd })
      .then(r => r.json()).then(setPreview).catch(() => setPreview(null));
  };

  const doUpload = () => {
    const fd = new FormData(); fd.append('file', file);
    fetch(API + '/api/upload', { method: 'POST', body: fd })
      .then(r => r.json()).then(() => { setPolling(true); pollStatus(); })
      .catch(e => setStatus({ error: e.message }));
  };

  const pollStatus = () => {
    const iv = setInterval(() => {
      fetch(API + '/api/pipeline/status').then(r => r.json()).then(s => {
        setStatus(s);
        if (!s.running) { clearInterval(iv); setPolling(false); if (!s.error) onDone(); }
      });
    }, 3000);
  };

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Загрузить новый файл данных</div>
        <div style={{ padding: 32, border: `2px dashed ${COLORS.border}`, borderRadius: 8, textAlign: 'center' }}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files[0] && doPreview(e.target.files[0])} style={{ fontSize: 12, fontFamily: FONT }} />
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>Поддерживаемые форматы: .xlsx, .xls, .csv</div>
        </div>
      </div>

      {preview && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Предпросмотр: {preview.filename}</div>
          <div style={styles.grid(3)}>
            <div style={styles.metric}><div style={styles.metricVal}>{fmt(preview.rows)}</div><div style={styles.metricLabel}>Строк</div></div>
            <div style={styles.metric}><div style={styles.metricVal}>{preview.columns?.length}</div><div style={styles.metricLabel}>Колонок</div></div>
            <div style={styles.metric}>
              <div style={{ ...styles.metricVal, color: preview.mapping?.ready ? COLORS.success : COLORS.danger }}>
                {preview.mapping?.ready ? 'Готов' : 'Не готов'}
              </div>
              <div style={styles.metricLabel}>Маппинг ({(preview.mapping?.confidence * 100).toFixed(0)}%)</div>
            </div>
          </div>

          {preview.mapping && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Маппинг колонок:</div>
              <div style={styles.grid(4)}>
                {Object.entries(preview.mapping.mapping || {}).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 11, padding: '4px 8px', background: `${COLORS.success}11`, borderRadius: 4 }}>
                    <span style={{ color: COLORS.success }}>{k}</span> &larr; {v}
                  </div>
                ))}
              </div>
              {preview.mapping.unmatched_required?.length > 0 && (
                <div style={{ marginTop: 8, color: COLORS.danger, fontSize: 11 }}>
                  Не найдены: {preview.mapping.unmatched_required.join(', ')}
                </div>
              )}
            </div>
          )}

          {preview.sample && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Пример данных:</div>
              <div style={{ overflow: 'auto', maxHeight: 200 }}>
                <table style={styles.table}>
                  <thead><tr>{(preview.columns || []).map((c, i) => <th key={i} style={{ ...styles.th, fontSize: 9 }}>{c}</th>)}</tr></thead>
                  <tbody>
                    {preview.sample.map((r, i) => (
                      <tr key={i}>{(preview.columns || []).map((c, j) => <td key={j} style={{ ...styles.td, fontSize: 10 }}>{String(r[c] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.mapping?.ready && (
            <div style={{ marginTop: 16 }}>
              <button style={styles.btn(COLORS.success)} onClick={doUpload} disabled={polling}>
                {polling ? 'Обработка...' : 'Запустить обработку'}
              </button>
            </div>
          )}
        </div>
      )}

      {status && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Статус pipeline</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {status.running && <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS.warning, animation: 'pulse 1s infinite' }} />}
            <span style={{ fontSize: 13, color: status.error ? COLORS.danger : status.running ? COLORS.warning : COLORS.success }}>
              {status.error || status.progress}
            </span>
          </div>
          {status.running && (
            <div style={{ marginTop: 12, height: 4, background: COLORS.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: COLORS.warning, width: '60%', animation: 'progress 2s ease-in-out infinite' }} />
            </div>
          )}
          {status.summary && (
            <div style={{ ...styles.grid(3), marginTop: 12 }}>
              <div style={styles.metric}><div style={styles.metricVal}>{fmt(status.summary.total)}</div><div style={styles.metricLabel}>Обработано</div></div>
              <div style={styles.metric}><div style={styles.metricVal}>{fmtScore(status.summary.avg_merit)}</div><div style={styles.metricLabel}>Ср. Merit</div></div>
              <div style={styles.metric}><div style={styles.metricVal}>{status.summary.best_auc?.toFixed(4)}</div><div style={styles.metricLabel}>Лучший AUC</div></div>
            </div>
          )}
          <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } } @keyframes progress { 0% { width:10% } 50% { width:80% } 100% { width:10% } }`}</style>
        </div>
      )}
    </>
  );
}

export default App;
