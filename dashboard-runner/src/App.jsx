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

// ── i18n ──
const LANGS = { ru: 'RU', kz: 'KZ', en: 'EN' };
const RISK_LABELS_I18N = {
  ru: { recommended: 'Рекомендована', low_risk: 'Низкий риск', medium_risk: 'Средний риск', high_risk: 'Высокий риск' },
  kz: { recommended: 'Ұсынылған', low_risk: 'Төмен тәуекел', medium_risk: 'Орта тәуекел', high_risk: 'Жоғары тәуекел' },
  en: { recommended: 'Recommended', low_risk: 'Low risk', medium_risk: 'Medium risk', high_risk: 'High risk' },
};
const T = {
  ru: {
    tabs: ['Обзор', 'Регионы', 'Модель', 'Рейтинг', 'FIFO vs Merit', 'Нормативная база', 'Оценить заявку', 'AI-ассистент', 'Загрузить данные'],
    subtitle: 'Merit-Based Scoring System | Казахстан',
    totalApps: 'Всего заявок', avgScore: 'Средний Merit Score', recommended: 'Рекомендовано',
    pctRecommended: '% рекомендованных', totalAmount: 'Общая сумма (тг)', billion: 'млрд',
    loading: 'Загрузка данных...', errorLoad: 'Ошибка загрузки', retry: 'Повторить',
    formula: 'Формула Merit Score', scoreDistrib: 'Распределение скоров', riskDistrib: 'Распределение рисков',
    details: 'Детали', region: 'Регион', direction: 'Направление', amount: 'Сумма',
    found: 'Найдено', page: 'Стр.', back: 'Назад', next: 'Далее', search: 'Поиск (номер заявки)',
    riskLevel: 'Уровень риска', onlyAnomalies: 'Только аномалии', downloadExcel: 'Скачать Excel',
    budgetSim: 'Бюджетный симулятор', budget: 'Бюджет (тенге)', calculate: 'Рассчитать',
    fifoFunded: 'FIFO: профинансировано', meritFunded: 'Merit: профинансировано', qualityImprovement: 'Улучшение качества',
    fifoAvgScore: 'FIFO ср. скор', meritAvgScore: 'Merit ср. скор', highRiskTop: 'High risk в топ-1000',
    fifoVsMeritTitle: 'FIFO vs Merit-Based (топ-1000)',
    uploadTitle: 'Загрузить новый файл данных', dragDrop: 'Перетащите файл сюда или нажмите для выбора', supportedFmt: 'Поддерживаемые форматы: .xlsx, .xls, .csv',
    runProcessing: '🚀 Запустить обработку', processing: '⏳ Обработка...', statusTitle: 'Статус обработки',
    processedApps: 'Обработано заявок', avgMerit: 'Ср. Merit Score', bestAuc: 'Лучший AUC',
    successProcessed: '✓ Данные успешно обработаны!', updatedTabs: 'Все вкладки обновлены с новыми данными',
    errorProcessing: 'Ошибка обработки', detailError: 'Ошибка загрузки деталей',
    scoreForm: 'Оценить новую заявку', submit: 'Оценить',
    hiLabel: '⚖️ Human-in-the-Loop', hiDesc: 'Система рекомендует, но НЕ принимает решение. Финальное одобрение — за комиссией.',
    explainTitle: '🔍 Explainability — почему такой score?',
    preview: 'Предпросмотр', rows: 'Строк', cols: 'Колонок', mapping: 'Маппинг',
    ready: '✓ Готов', notReady: '✕ Не готов', colMapping: 'Маппинг колонок', sampleData: 'Пример данных', notFound: 'Не найдены',
    minScore: 'Мин. скор', maxScore: 'Макс. скор', anomaly: 'Аномалия',
    ask: 'Спросить', askPlaceholder: 'Задайте вопрос о системе скоринга...',
    send: 'Отправить', thinking: 'Думаю...', chatEmpty: 'Задайте вопрос о субсидиях, скоринге или данных',
    directionStats: 'Статистика по направлениям', avgScoreByRegion: 'Средний Merit Score по регионам',
    regionDetails: 'Детали по регионам', apps: 'Заявок', avgScoreShort: 'Ср. скор', pctRecommendedShort: '% рекоменд.',
    crossVal: 'Кросс-валидация (5-fold CV)', temporalVal: 'Temporal Validation (80/20 по дате)',
    featureImportance: 'Feature Importance (Top-15)', fairnessAudit: 'Fairness Audit',
    cvBetweenRegions: 'CV между регионами', minPctRecommended: 'Мин. % рекомендованных', maxPctRecommended: 'Макс. % рекомендованных',
    fairSystem: 'Система справедлива: разброс между регионами < 10%', unfairWarning: 'Внимание: значительный разброс между регионами',
    methodology: 'Методология Merit Score',
    requestCol: 'Заявка', statusCol: 'Статус',
    npaTitle: 'Нормативно-правовые акты РК', directionsTitle: 'Направления субсидирования и приоритеты',
    pastureZones: 'Пастбищные зоны (V1500011064)',
    dirCol: 'Направление', priorityCol: 'Приоритет', normRangeCol: 'Диапазон норматива (тг)', descCol: 'Описание',
    zoneCol: 'Зона', normCol: 'Норма (усл.гол/га)',
    regionLabel: 'Регион', dirLabel: 'Направление', districtLabel: 'Район', subsidyNameLabel: 'Название субсидии',
    normativeLabel: 'Норматив (тг)', amountLabel: 'Сумма (тг)', hourLabel: 'Час подачи', monthLabel: 'Месяц', dayLabel: 'День недели',
    days: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
    selectOption: 'Выберите', allOption: 'Все',
    regulatoryAssessment: 'Нормативная оценка', improvementTips: 'Рекомендации по улучшению',
    stageOf: 'Этап {0} из {1}',
    hiScoreDesc: 'Оценка носит рекомендательный характер. Окончательное решение принимается комиссией на основе полного пакета документов.',
  },
  kz: {
    tabs: ['Шолу', 'Аймақтар', 'Модель', 'Рейтинг', 'FIFO vs Merit', 'Нормативтік база', 'Өтінімді бағалау', 'AI-көмекші', 'Деректерді жүктеу'],
    subtitle: 'Merit-Based Scoring System | Қазақстан',
    totalApps: 'Барлық өтінімдер', avgScore: 'Орташа Merit Score', recommended: 'Ұсынылған',
    pctRecommended: '% ұсынылған', totalAmount: 'Жалпы сома (тг)', billion: 'млрд',
    loading: 'Деректер жүктелуде...', errorLoad: 'Жүктеу қатесі', retry: 'Қайталау',
    formula: 'Merit Score формуласы', scoreDistrib: 'Скор таралуы', riskDistrib: 'Тәуекел таралуы',
    details: 'Толығырақ', region: 'Аймақ', direction: 'Бағыт', amount: 'Сома',
    found: 'Табылды', page: 'Бет', back: 'Артқа', next: 'Алға', search: 'Іздеу (өтінім нөмірі)',
    riskLevel: 'Тәуекел деңгейі', onlyAnomalies: 'Тек аномалиялар', downloadExcel: 'Excel жүктеу',
    budgetSim: 'Бюджет симуляторы', budget: 'Бюджет (теңге)', calculate: 'Есептеу',
    fifoFunded: 'FIFO: қаржыландырылды', meritFunded: 'Merit: қаржыландырылды', qualityImprovement: 'Сапа жақсаруы',
    fifoAvgScore: 'FIFO орт. скор', meritAvgScore: 'Merit орт. скор', highRiskTop: 'High risk топ-1000',
    fifoVsMeritTitle: 'FIFO vs Merit-Based (топ-1000)',
    uploadTitle: 'Жаңа дерек файлын жүктеу', dragDrop: 'Файлды осында сүйреңіз немесе таңдау үшін басыңыз', supportedFmt: 'Форматтар: .xlsx, .xls, .csv',
    runProcessing: '🚀 Өңдеуді бастау', processing: '⏳ Өңделуде...', statusTitle: 'Өңдеу күйі',
    processedApps: 'Өңделген өтінімдер', avgMerit: 'Орт. Merit Score', bestAuc: 'Ең жақсы AUC',
    successProcessed: '✓ Деректер сәтті өңделді!', updatedTabs: 'Барлық бөлімдер жаңартылды',
    errorProcessing: 'Өңдеу қатесі', detailError: 'Мәліметтерді жүктеу қатесі',
    scoreForm: 'Жаңа өтінімді бағалау', submit: 'Бағалау',
    hiLabel: '⚖️ Human-in-the-Loop', hiDesc: 'Жүйе ұсынады, бірақ шешім қабылдамайды. Соңғы бекіту — комиссияда.',
    explainTitle: '🔍 Explainability — неге бұл score?',
    preview: 'Алдын ала қарау', rows: 'Жолдар', cols: 'Бағандар', mapping: 'Маппинг',
    ready: '✓ Дайын', notReady: '✕ Дайын емес', colMapping: 'Баған маппингі', sampleData: 'Деректер үлгісі', notFound: 'Табылмады',
    minScore: 'Мин. скор', maxScore: 'Макс. скор', anomaly: 'Аномалия',
    ask: 'Сұрау', askPlaceholder: 'Скоринг жүйесі туралы сұрақ қойыңыз...',
    send: 'Жіберу', thinking: 'Ойлануда...', chatEmpty: 'Субсидиялар, скоринг немесе деректер туралы сұрақ қойыңыз',
    directionStats: 'Бағыттар бойынша статистика', avgScoreByRegion: 'Аймақтар бойынша орташа Merit Score',
    regionDetails: 'Аймақтар бойынша мәліметтер', apps: 'Өтінімдер', avgScoreShort: 'Орт. скор', pctRecommendedShort: '% ұсын.',
    crossVal: 'Кросс-валидация (5-fold CV)', temporalVal: 'Temporal Validation (80/20 күні бойынша)',
    featureImportance: 'Feature Importance (Топ-15)', fairnessAudit: 'Fairness Audit',
    cvBetweenRegions: 'Аймақтар арасындағы CV', minPctRecommended: 'Мін. % ұсынылған', maxPctRecommended: 'Макс. % ұсынылған',
    fairSystem: 'Жүйе әділ: аймақтар арасындағы ауытқу < 10%', unfairWarning: 'Назар аударыңыз: аймақтар арасында айтарлықтай ауытқу',
    methodology: 'Merit Score әдістемесі',
    requestCol: 'Өтінім', statusCol: 'Күйі',
    npaTitle: 'ҚР нормативтік-құқықтық актілері', directionsTitle: 'Субсидиялау бағыттары мен басымдықтары',
    pastureZones: 'Жайылым аймақтары (V1500011064)',
    dirCol: 'Бағыт', priorityCol: 'Басымдық', normRangeCol: 'Норматив диапазоны (тг)', descCol: 'Сипаттама',
    zoneCol: 'Аймақ', normCol: 'Норма (шартты бас/га)',
    regionLabel: 'Аймақ', dirLabel: 'Бағыт', districtLabel: 'Аудан', subsidyNameLabel: 'Субсидия атауы',
    normativeLabel: 'Норматив (тг)', amountLabel: 'Сома (тг)', hourLabel: 'Беру сағаты', monthLabel: 'Ай', dayLabel: 'Апта күні',
    days: ['Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі', 'Жексенбі'],
    selectOption: 'Таңдаңыз', allOption: 'Барлығы',
    regulatoryAssessment: 'Нормативтік бағалау', improvementTips: 'Жақсарту ұсыныстары',
    stageOf: '{0}-кезең, барлығы {1}',
    hiScoreDesc: 'Бағалау ұсыныс сипатында. Түпкілікті шешімді комиссия құжаттар негізінде қабылдайды.',
  },
  en: {
    tabs: ['Overview', 'Regions', 'Model', 'Ranking', 'FIFO vs Merit', 'Regulatory', 'Score Form', 'AI Assistant', 'Upload Data'],
    subtitle: 'Merit-Based Scoring System | Kazakhstan',
    totalApps: 'Total Applications', avgScore: 'Avg Merit Score', recommended: 'Recommended',
    pctRecommended: '% Recommended', totalAmount: 'Total Amount (KZT)', billion: 'B',
    loading: 'Loading data...', errorLoad: 'Loading error', retry: 'Retry',
    formula: 'Merit Score Formula', scoreDistrib: 'Score Distribution', riskDistrib: 'Risk Distribution',
    details: 'Details', region: 'Region', direction: 'Direction', amount: 'Amount',
    found: 'Found', page: 'Page', back: 'Back', next: 'Next', search: 'Search (request #)',
    riskLevel: 'Risk Level', onlyAnomalies: 'Anomalies only', downloadExcel: 'Download Excel',
    budgetSim: 'Budget Simulator', budget: 'Budget (KZT)', calculate: 'Calculate',
    fifoFunded: 'FIFO: funded', meritFunded: 'Merit: funded', qualityImprovement: 'Quality improvement',
    fifoAvgScore: 'FIFO avg score', meritAvgScore: 'Merit avg score', highRiskTop: 'High risk in top-1000',
    fifoVsMeritTitle: 'FIFO vs Merit-Based (top-1000)',
    uploadTitle: 'Upload new data file', dragDrop: 'Drag file here or click to select', supportedFmt: 'Supported formats: .xlsx, .xls, .csv',
    runProcessing: '🚀 Run Processing', processing: '⏳ Processing...', statusTitle: 'Processing Status',
    processedApps: 'Processed', avgMerit: 'Avg Merit Score', bestAuc: 'Best AUC',
    successProcessed: '✓ Data processed successfully!', updatedTabs: 'All tabs updated with new data',
    errorProcessing: 'Processing error', detailError: 'Error loading details',
    scoreForm: 'Score new application', submit: 'Evaluate',
    hiLabel: '⚖️ Human-in-the-Loop', hiDesc: 'The system recommends but does NOT decide. Final approval is by the commission.',
    explainTitle: '🔍 Explainability — why this score?',
    preview: 'Preview', rows: 'Rows', cols: 'Columns', mapping: 'Mapping',
    ready: '✓ Ready', notReady: '✕ Not ready', colMapping: 'Column Mapping', sampleData: 'Sample Data', notFound: 'Not found',
    minScore: 'Min score', maxScore: 'Max score', anomaly: 'Anomaly',
    ask: 'Ask', askPlaceholder: 'Ask about the scoring system...',
    send: 'Send', thinking: 'Thinking...', chatEmpty: 'Ask about subsidies, scoring, or data',
    directionStats: 'Statistics by direction', avgScoreByRegion: 'Avg Merit Score by region',
    regionDetails: 'Region details', apps: 'Applications', avgScoreShort: 'Avg score', pctRecommendedShort: '% recomm.',
    crossVal: 'Cross-validation (5-fold CV)', temporalVal: 'Temporal Validation (80/20 by date)',
    featureImportance: 'Feature Importance (Top-15)', fairnessAudit: 'Fairness Audit',
    cvBetweenRegions: 'CV between regions', minPctRecommended: 'Min % recommended', maxPctRecommended: 'Max % recommended',
    fairSystem: 'System is fair: spread between regions < 10%', unfairWarning: 'Warning: significant spread between regions',
    methodology: 'Merit Score Methodology',
    requestCol: 'Request', statusCol: 'Status',
    npaTitle: 'Regulatory Acts of Kazakhstan', directionsTitle: 'Subsidy directions and priorities',
    pastureZones: 'Pasture zones (V1500011064)',
    dirCol: 'Direction', priorityCol: 'Priority', normRangeCol: 'Normative range (KZT)', descCol: 'Description',
    zoneCol: 'Zone', normCol: 'Norm (conv.heads/ha)',
    regionLabel: 'Region', dirLabel: 'Direction', districtLabel: 'District', subsidyNameLabel: 'Subsidy name',
    normativeLabel: 'Normative (KZT)', amountLabel: 'Amount (KZT)', hourLabel: 'Submission hour', monthLabel: 'Month', dayLabel: 'Day of week',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    selectOption: 'Select', allOption: 'All',
    regulatoryAssessment: 'Regulatory assessment', improvementTips: 'Improvement recommendations',
    stageOf: 'Stage {0} of {1}',
    hiScoreDesc: 'The score is advisory. The final decision is made by the commission based on the full document package.',
  },
};

const LangContext = React.createContext({ t: T.ru, lang: 'ru', setLang: () => {} });

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
  const [lang, setLang] = useState('ru');
  const t = T[lang];

  // Upload state persisted across tab switches
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

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
        <div style={{ color: COLORS.textMuted }}>{t.loading}</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...styles.app, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ ...styles.card, maxWidth: 500, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12, color: COLORS.danger }}>{t.errorLoad}</div>
        <div style={{ color: COLORS.textMuted, marginBottom: 16 }}>{error}</div>
        <button style={styles.btn()} onClick={loadData}>{t.retry}</button>
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
    <Upload onDone={loadData} file={uploadFile} setFile={setUploadFile} preview={uploadPreview} setPreview={setUploadPreview} status={uploadStatus} setStatus={setUploadStatus} />,
  ];

  return (
    <LangContext.Provider value={{ t, lang, setLang }}>
      <div style={styles.app}>
        <div style={styles.header}>
          <span style={styles.title}>SubsidyScore AI</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: COLORS.textDim, fontSize: 11 }}>{t.subtitle}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {Object.entries(LANGS).map(([k, v]) => (
                <button key={k} onClick={() => setLang(k)} style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, fontFamily: FONT,
                  cursor: 'pointer', border: 'none',
                  background: lang === k ? COLORS.primary : 'transparent',
                  color: lang === k ? '#fff' : COLORS.textDim,
                  transition: 'all 0.2s',
                }}>{v}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={styles.tabs}>
          {t.tabs.map((tabName, i) => <button key={i} style={styles.tab(i === tab)} onClick={() => setTab(i)}>{tabName}</button>)}
        </div>
        <div style={styles.main}>{pages[tab]}</div>
      </div>
    </LangContext.Provider>
  );
}

// ════════════════════════════════════════════════
// Tab 0: Обзор
// ════════════════════════════════════════════════
function Overview({ data }) {
  const { t, lang } = React.useContext(LangContext);
  const rl = RISK_LABELS_I18N[lang] || RISK_LABELS_I18N.ru;
  const ov = data.overview || {};
  const mf = data.merit_formula || {};
  const directionStatsSorted = [...(data.direction_stats || [])].sort((a, b) => b.count - a.count);
  return (
    <>
      <div style={styles.grid(5)}>
        {[
          { v: fmt(ov.total_applications), l: t.totalApps },
          { v: fmtScore(ov.avg_score), l: t.avgScore },
          { v: fmt(ov.recommended), l: t.recommended },
          { v: `${ov.pct_recommended || 0}%`, l: t.pctRecommended },
          { v: `${(ov.total_amount / 1e9).toFixed(1)} ${t.billion}`, l: t.totalAmount },
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
          <div style={styles.cardTitle}>{t.scoreDistrib}</div>
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
          <div style={styles.cardTitle}>{t.riskDistrib}</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={(data.risk_distribution || []).map(r => ({ ...r, name: rl[r.level] || r.level }))} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {(data.risk_distribution || []).map((r, i) => <Cell key={i} fill={RISK_COLORS[r.level] || COLORS.textDim} />)}
              </Pie>
              <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.directionStats}</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={directionStatsSorted} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis type="number" tick={{ fill: COLORS.textDim, fontSize: 10 }} />
            <YAxis dataKey="direction" type="category" width={200} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
            <Bar dataKey="count" fill={COLORS.primary} name={t.apps} radius={[0, 4, 4, 0]} />
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
  const { t } = React.useContext(LangContext);
  const rs = [...(data.region_stats || [])].sort((a, b) => b.avg_score - a.avg_score);
  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.avgScoreByRegion}</div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={rs} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: COLORS.textDim, fontSize: 10 }} />
            <YAxis dataKey="region" type="category" width={220} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT, fontSize: 11 }} />
            <Bar dataKey="avg_score" fill={COLORS.success} name={t.avgScoreShort} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.regionDetails}</div>
        <table style={styles.table}>
          <thead>
            <tr>{[t.region, t.apps, t.avgScoreShort, t.recommended, t.pctRecommendedShort].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr>
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
  const { t } = React.useContext(LangContext);
  const mr = data.model_results || {};
  const tv = data.temporal_validation || {};
  const fi = data.feature_importance || [];
  const fa = data.fairness_audit || {};
  const mf = data.merit_formula || {};

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.crossVal}</div>
        <table style={styles.table}>
          <thead><tr>{['Model', 'AUC', 'Accuracy', 'F1', 'Precision', 'Recall'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
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
          <div style={styles.cardTitle}>{t.temporalVal}</div>
          <table style={styles.table}>
            <thead><tr>{['Model', 'AUC', 'Accuracy', 'F1', 'Train', 'Test'].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
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
        <div style={styles.cardTitle}>{t.featureImportance}</div>
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
          <div style={styles.cardTitle}>{t.fairnessAudit}</div>
          <div style={styles.grid(3)}>
            <div style={styles.metric}><div style={{ ...styles.metricVal, color: fa.is_fair ? COLORS.success : COLORS.warning }}>{fa.cv}%</div><div style={styles.metricLabel}>{t.cvBetweenRegions}</div></div>
            <div style={styles.metric}><div style={styles.metricVal}>{fa.min_pct}%</div><div style={styles.metricLabel}>{t.minPctRecommended}</div></div>
            <div style={styles.metric}><div style={styles.metricVal}>{fa.max_pct}%</div><div style={styles.metricLabel}>{t.maxPctRecommended}</div></div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: fa.is_fair ? COLORS.success : COLORS.warning }}>
            {fa.is_fair ? t.fairSystem : t.unfairWarning}
          </div>
        </div>
      )}

      {mf.components && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{t.methodology}</div>
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
  const { t } = React.useContext(LangContext);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ region: '', min_score: 0, search: '', risk_level: '', anomaly_only: false });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const limit = 20;

  const fetchRanking = () => {
    const p = new URLSearchParams();
    if (filters.region) p.set('region', filters.region);
    if (filters.min_score > 0) p.set('min_score', filters.min_score);
    if (filters.search) p.set('search', filters.search);
    if (filters.risk_level) p.set('risk_level', filters.risk_level);
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
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    fetch(API + '/api/explain/' + rn)
      .then(r => {
        if (!r.ok) throw new Error("API Error");
        return r.json();
      })
      .then(setDetail)
      .catch(() => setDetailError(t.detailError))
      .finally(() => setDetailLoading(false));
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
        <div style={{ flex: '1 1 120px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.region}</div>
          <select style={styles.select} value={filters.region} onChange={e => { setFilters({ ...filters, region: e.target.value }); setPage(0); }}>
            <option value="">Все</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.minScore}</div>
          <input type="number" style={styles.input} value={filters.min_score} onChange={e => { setFilters({ ...filters, min_score: +e.target.value }); setPage(0); }} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.riskLevel}</div>
          <select style={styles.select} value={filters.risk_level} onChange={e => { setFilters({ ...filters, risk_level: e.target.value }); setPage(0); }}>
            <option value="">Все</option>
            {Object.entries(RISK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.search}</div>
          <input style={styles.input} value={filters.search} placeholder="1200100..." onChange={e => { setFilters({ ...filters, search: e.target.value }); setPage(0); }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: COLORS.textMuted, cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.anomaly_only} onChange={e => { setFilters({ ...filters, anomaly_only: e.target.checked }); setPage(0); }} />
          {t.onlyAnomalies}
        </label>
        <a href={exportUrl()} download style={{ ...styles.btn(COLORS.success), textDecoration: 'none', fontSize: 11, padding: '8px 14px' }}>{t.downloadExcel}</a>
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t.found}: {fmt(total)}</span>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t.page} {page + 1} / {Math.max(1, Math.ceil(total / limit))}</span>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>{[t.requestCol, t.region, t.direction, t.amount, 'Merit Score', t.statusCol, ''].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rn = String(r.request_num || '').replace('.0', '');
              const rl = RISK_LABELS_I18N[lang] || RISK_LABELS_I18N.ru;
              return (
                <tr key={i} style={{ cursor: 'pointer', background: selected === rn ? `${COLORS.primary}11` : 'transparent' }} onClick={() => showDetail(r.request_num)}>
                  <td style={styles.td}>{rn} {r.is_anomaly && <span style={styles.badge(COLORS.danger)}>{t.anomaly}</span>}</td>
                  <td style={styles.td}>{r.region}</td>
                  <td style={styles.td}>{r.direction}</td>
                  <td style={styles.td}>{fmt(r.amount)}</td>
                  <td style={styles.td}><span style={{ fontWeight: 700, color: (r.merit_score || 0) >= 70 ? COLORS.success : COLORS.warning }}>{fmtScore(r.merit_score)}</span></td>
                  <td style={styles.td}><span style={styles.badge(RISK_COLORS[r.merit_risk_level] || COLORS.textDim)}>{rl[r.merit_risk_level] || r.merit_risk_level}</span></td>
                  <td style={styles.td}><span style={{ color: COLORS.primary, fontSize: 11 }}>{t.details}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
          <button style={styles.btnOutline} disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t.back}</button>
          <button style={styles.btnOutline} disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>{t.next}</button>
        </div>
      </div>

      {detailLoading && (
        <div style={{ ...styles.card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 24, marginBottom: 12, animation: 'spin 1s linear infinite' }}>&#9881;</div>
          <div style={{ color: COLORS.textMuted, fontSize: 12 }}>{t.loading}</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {detailError && !detailLoading && (
        <div style={{ ...styles.card, textAlign: 'center', padding: 24 }}>
          <div style={{ color: COLORS.danger, fontSize: 14, marginBottom: 8 }}>{detailError}</div>
          <button style={styles.btn()} onClick={() => showDetail(selected)}>{t.retry}</button>
        </div>
      )}

      {detail && !detailLoading && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{t.details} #{detail.request_num}</div>
          <div style={styles.grid(3)}>
            <div><span style={{ color: COLORS.textMuted }}>{t.regionLabel}:</span> {detail.region}</div>
            <div><span style={{ color: COLORS.textMuted }}>{t.dirLabel}:</span> {detail.direction}</div>
            <div><span style={{ color: COLORS.textMuted }}>{t.amountLabel}:</span> {fmt(detail.amount)}</div>
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
            <span style={styles.badge(RISK_COLORS[detail.risk_level] || COLORS.textDim)}>{(RISK_LABELS_I18N[lang] || RISK_LABELS_I18N.ru)[detail.risk_level] || detail.risk_level}</span>
          </div>

          {detail.regulatory_explanation && (
            <div style={{ marginTop: 12, padding: 12, background: `${COLORS.info}11`, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: COLORS.info }}>{t.regulatoryAssessment}</div>
              {(detail.regulatory_explanation.factors || []).map((f, i) => <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>{f}</div>)}
              {(detail.regulatory_explanation.npa_references || []).map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginRight: 8, fontSize: 10, color: COLORS.primary }}>{r.id}</a>
              ))}
            </div>
          )}

          {detail.improvement_tips && detail.improvement_tips.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: `${COLORS.success}11`, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: COLORS.success }}>{t.improvementTips}</div>
              {detail.improvement_tips.map((tip, i) => (
                <div key={i} style={{ fontSize: 11, marginBottom: 8, display: 'flex', gap: 8 }}>
                  <span style={styles.badge(COLORS.success)}>+{tip.gain}</span>
                  <span>{tip.tip}</span>
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
  const { t } = React.useContext(LangContext);
  const fm = data.fifo_vs_merit || {};
  const [budget, setBudget] = useState(1000000000);
  const [sim, setSim] = useState(null);
  const [simError, setSimError] = useState(null);
  const [loadingSim, setLoadingSim] = useState(false);

  const runSim = () => {
    setLoadingSim(true);
    setSimError(null);
    fetch(API + '/api/budget-simulation?budget=' + budget)
      .then(r => {
        if (!r.ok) throw new Error("API Error");
        return r.json();
      })
      .then(d => setSim(d))
      .catch(e => setSimError("Ошибка: невозможно завершить расчет"))
      .finally(() => setLoadingSim(false));
  };

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.fifoVsMeritTitle}</div>
        <div style={styles.grid(4)}>
          <div style={styles.metric}><div style={styles.metricVal}>{fm.fifo_top1000_avg_score}</div><div style={styles.metricLabel}>{t.fifoAvgScore}</div></div>
          <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.success }}>{fm.merit_top1000_avg_score}</div><div style={styles.metricLabel}>{t.meritAvgScore}</div></div>
          <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.success }}>+{fm.score_improvement_pct}%</div><div style={styles.metricLabel}>{t.qualityImprovement}</div></div>
          <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.danger }}>{fm.fifo_top1000_high_risk_count} &rarr; {fm.merit_top1000_high_risk_count}</div><div style={styles.metricLabel}>{t.highRiskTop}</div></div>
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
        <div style={styles.cardTitle}>{t.budgetSim}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.budget}</div>
            <input type="number" style={styles.input} value={budget} onChange={e => setBudget(+e.target.value)} />
          </div>
          <button style={styles.btn()} onClick={runSim} disabled={loadingSim}>{loadingSim ? '...' : t.calculate}</button>
        </div>
        
        {simError && (
          <div style={{ marginTop: 12, color: COLORS.danger, fontSize: 12 }}>{simError}</div>
        )}

        {sim && !simError && (
          <div style={{ ...styles.grid(3), marginTop: 16 }}>
            <div style={styles.metric}>
              <div style={styles.metricVal}>{fmt(sim.fifo?.funded)}</div>
              <div style={styles.metricLabel}>{t.fifoFunded} (ср. {fmtScore(sim.fifo?.avg_score)})</div>
            </div>
            <div style={styles.metric}>
              <div style={{ ...styles.metricVal, color: COLORS.success }}>{fmt(sim.merit?.funded)}</div>
              <div style={styles.metricLabel}>{t.meritFunded} (ср. {fmtScore(sim.merit?.avg_score)})</div>
            </div>
            <div style={styles.metric}>
              <div style={{ ...styles.metricVal, color: COLORS.success }}>+{sim.improvement_pct}%</div>
              <div style={styles.metricLabel}>{t.qualityImprovement}</div>
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
  const { t } = React.useContext(LangContext);
  const [info, setInfo] = useState(null);
  useEffect(() => { fetch(API + '/api/regulatory/info').then(r => r.json()).then(setInfo).catch(() => {}); }, []);
  if (!info) return <div style={styles.card}>{t.loading}</div>;

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.npaTitle}</div>
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
        <div style={styles.cardTitle}>{t.directionsTitle}</div>
        <table style={styles.table}>
          <thead><tr>{[t.dirCol, t.priorityCol, t.normRangeCol, t.descCol].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
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
        <div style={styles.cardTitle}>{t.pastureZones}</div>
        <div style={styles.grid(2)}>
          <div>
            <table style={styles.table}>
              <thead><tr>{[t.zoneCol, t.normCol, t.descCol].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(info.pasture_zones || {}).map(([z, v]) => (
                  <tr key={z}><td style={styles.td}>{z}</td><td style={styles.td}>{v.norm}</td><td style={{ ...styles.td, color: COLORS.textMuted }}>{v.desc}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <table style={styles.table}>
              <thead><tr>{[t.regionLabel, t.zoneCol].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr></thead>
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
  const { t, lang } = React.useContext(LangContext);
  const regions = (data.region_stats || []).map(r => r.region);
  const directions = (data.direction_stats || []).map(d => d.direction);
  const [form, setForm] = useState({ region: '', direction: '', district: '', subsidy_name: '', normative: 0, amount: 0, hour: 12, month: 1, day_of_week: 0 });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const submit = () => {
    setErr('');
    fetch(API + '/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      .then(r => { if (!r.ok) throw new Error('API Error'); return r.json(); })
      .then(setResult).catch(e => setErr(e.message));
  };

  const days = t.days;

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.scoreForm}</div>
        <div style={styles.grid(3)}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.regionLabel}</div>
            <select style={styles.select} value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}>
              <option value="">{t.selectOption}</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.dirLabel}</div>
            <select style={styles.select} value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
              <option value="">{t.selectOption}</option>
              {directions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.districtLabel}</div>
            <input style={styles.input} value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.subsidyNameLabel}</div>
            <input style={styles.input} value={form.subsidy_name} onChange={e => setForm({ ...form, subsidy_name: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.normativeLabel}</div>
            <input type="number" style={styles.input} value={form.normative} onChange={e => setForm({ ...form, normative: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.amountLabel}</div>
            <input type="number" style={styles.input} value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.hourLabel}</div>
            <input type="number" min="0" max="23" style={styles.input} value={form.hour} onChange={e => setForm({ ...form, hour: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.monthLabel}</div>
            <input type="number" min="1" max="12" style={styles.input} value={form.month} onChange={e => setForm({ ...form, month: +e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{t.dayLabel}</div>
            <select style={styles.select} value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: +e.target.value })}>
              {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button style={styles.btn()} onClick={submit}>{t.submit}</button>
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
            <span style={styles.badge(RISK_COLORS[result.risk_level] || COLORS.textDim)}>{(RISK_LABELS_I18N[lang] || RISK_LABELS_I18N.ru)[result.risk_level] || result.risk_level}</span>
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
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: COLORS.info }}>{t.regulatoryAssessment}</div>
              {(result.regulatory_explanation.factors || []).map((f, i) => <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>{f}</div>)}
            </div>
          )}
        </div>
      )}

      <div style={styles.hil}>
        {t.hiLabel}: {t.hiScoreDesc}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 7: AI-ассистент
// ════════════════════════════════════════════════
function AiChat() {
  const { t } = React.useContext(LangContext);
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
        {messages.length === 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textDim }}>{t.chatEmpty}</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? COLORS.success : `${COLORS.textDim}22`,
              color: m.role === 'user' ? '#fff' : COLORS.text,
            }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ color: COLORS.textMuted, fontSize: 12, padding: 8 }}>{t.thinking}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input style={{ ...styles.input, flex: 1 }} placeholder={t.askPlaceholder} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button style={styles.btn()} onClick={() => send()} disabled={loading}>{t.send}</button>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// Tab 8: Загрузить данные
// ════════════════════════════════════════════════

const PIPELINE_STAGES_I18N = {
  ru: [
    { icon: '📥', label: 'Загрузка файла...' },
    { icon: '🔍', label: 'Анализ структуры данных...' },
    { icon: '⚙️', label: 'Извлечение признаков (26 features)...' },
    { icon: '🧠', label: 'Обучение ML-моделей...' },
    { icon: '📊', label: 'Расчёт Merit Score...' },
    { icon: '💾', label: 'Сохранение результатов...' },
  ],
  kz: [
    { icon: '📥', label: 'Файлды жүктеу...' },
    { icon: '🔍', label: 'Деректер құрылымын талдау...' },
    { icon: '⚙️', label: 'Белгілерді шығару (26 features)...' },
    { icon: '🧠', label: 'ML-модельдерін оқыту...' },
    { icon: '📊', label: 'Merit Score есептеу...' },
    { icon: '💾', label: 'Нәтижелерді сақтау...' },
  ],
  en: [
    { icon: '📥', label: 'Uploading file...' },
    { icon: '🔍', label: 'Analyzing data structure...' },
    { icon: '⚙️', label: 'Extracting features (26 features)...' },
    { icon: '🧠', label: 'Training ML models...' },
    { icon: '📊', label: 'Calculating Merit Score...' },
    { icon: '💾', label: 'Saving results...' },
  ]
};

function CircularProgress({ stage, totalStages, running, stages }) {
  const radius = 70;
  const stroke = 6;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = running ? (stage / totalStages) : (stage > 0 ? 1 : 0);
  const offset = circumference - progress * circumference;

  return (
    <div style={{ position: 'relative', width: radius * 2, height: radius * 2, margin: '0 auto' }}>
      <svg width={radius * 2} height={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={COLORS.primary} />
            <stop offset="50%" stopColor={COLORS.accent1} />
            <stop offset="100%" stopColor={COLORS.info} />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none" stroke={COLORS.border} strokeWidth={stroke}
        />
        {/* Progress circle */}
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none" stroke="url(#progressGrad)" strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      {/* Center content */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {running ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 4, animation: 'pulse 1.5s ease-in-out infinite' }}>
              {stages[Math.max(0, stage - 1)]?.icon || '⏳'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.primary }}>
              {Math.round(progress * 100)}%
            </div>
          </>
        ) : stage > 0 ? (
          <div style={{ fontSize: 36, color: COLORS.success }}>✓</div>
        ) : (
          <div style={{ fontSize: 36, color: COLORS.danger }}>✕</div>
        )}
      </div>
    </div>
  );
}

function Upload({ onDone, file, setFile, preview, setPreview, status, setStatus }) {
  const { t, lang } = React.useContext(LangContext);
  const stages = PIPELINE_STAGES_I18N[lang] || PIPELINE_STAGES_I18N.ru;
  const [polling, setPolling] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const doPreview = (f) => {
    setFile(f);
    const fd = new FormData(); fd.append('file', f);
    fetch(API + '/api/upload/preview', { method: 'POST', body: fd })
      .then(r => r.json()).then(setPreview).catch(() => setPreview(null));
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && /\.(xlsx|xls|csv)$/i.test(f.name)) doPreview(f);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };

  const doUpload = () => {
    const fd = new FormData(); fd.append('file', file);
    setStatus({ running: true, progress: 'Загрузка файла...', stage: 1, total_stages: 6 });
    setPolling(true);
    fetch(API + '/api/upload', { method: 'POST', body: fd })
      .then(r => r.json()).then(() => { pollStatus(); })
      .catch(e => { setStatus({ running: false, error: e.message, stage: 0, total_stages: 6 }); setPolling(false); });
  };

  const pollStatus = () => {
    const iv = setInterval(() => {
      fetch(API + '/api/pipeline/status').then(r => r.json()).then(s => {
        setStatus(s);
        if (!s.running) { clearInterval(iv); setPolling(false); if (!s.error) onDone(); }
      });
    }, 2000);
  };

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardTitle}>{t.uploadTitle}</div>
        <div
          onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: 48, border: `2px dashed ${dragging ? COLORS.primary : COLORS.border}`,
            borderRadius: 12, textAlign: 'center', cursor: 'pointer',
            background: dragging ? `${COLORS.primary}0a` : 'transparent',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ pointerEvents: 'none' }}>
            <div style={{
              fontSize: 48, marginBottom: 12, opacity: 0.6,
              transform: dragging ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s ease',
            }}>
              {file ? '📄' : '☁️'}
            </div>
            {file ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{file.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                  {t.dragDrop}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                  {t.supportedFmt}
                </div>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx,.xls,.csv" onChange={e => { if (e.target.files?.[0]) doPreview(e.target.files[0]); }} />
        </div>
      </div>

      {preview && (
        <div style={styles.card}>
          <div style={{ ...styles.cardTitle, textAlign: 'center', marginBottom: 24, fontSize: 13 }}>{t.preview}: {file?.name}</div>
          <div style={styles.grid(3)}>
            <div style={styles.metric}>
              <div style={styles.metricVal}>{fmt(preview.rows)}</div>
              <div style={styles.metricLabel}>{t.rows}</div>
            </div>
            <div style={styles.metric}>
              <div style={styles.metricVal}>{preview.columns?.length}</div>
              <div style={styles.metricLabel}>{t.cols}</div>
            </div>
            <div style={styles.metric}>
              <div style={{ ...styles.metricVal, color: preview.mapping?.ready ? COLORS.success : COLORS.danger }}>
                {preview.mapping?.ready ? t.ready : t.notReady}
              </div>
              <div style={styles.metricLabel}>{t.mapping} ({(preview.mapping?.confidence * 100).toFixed(0)}%)</div>
            </div>
          </div>

          {preview.mapping && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t.colMapping}:</div>
              <div style={styles.grid(4)}>
                {Object.entries(preview.mapping.mapping || {}).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 11, padding: '6px 10px', background: `${COLORS.success}11`, borderRadius: 6, border: `1px solid ${COLORS.success}22` }}>
                    <span style={{ color: COLORS.success, fontWeight: 600 }}>{k}</span> ← {v}
                  </div>
                ))}
              </div>
              {preview.mapping.unmatched_required?.length > 0 && (
                <div style={{ marginTop: 8, color: COLORS.danger, fontSize: 11 }}>
                  ⚠ {t.notFound}: {preview.mapping.unmatched_required.join(', ')}
                </div>
              )}
            </div>
          )}

          {preview.sample && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t.sampleData}:</div>
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
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                style={{
                  ...styles.btn(COLORS.success),
                  padding: '12px 32px', fontSize: 13,
                  opacity: polling ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={doUpload} disabled={polling}
              >
                {polling ? t.processing : t.runProcessing}
              </button>
            </div>
          )}
        </div>
      )}

      {status && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{t.statusTitle}</div>

          {status.running ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CircularProgress
                stage={status.stage || 1}
                totalStages={status.total_stages || 6}
                running={true}
                stages={stages}
              />
              <div style={{
                fontSize: 14, fontWeight: 600, marginTop: 20,
                color: COLORS.primary,
                animation: 'fadeInUp 0.5s ease',
              }}>
                {status.progress || t.processing}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
                {t.stageOf.replace('{0}', status.stage || 1).replace('{1}', status.total_stages || 6)}
              </div>

              {/* Stage indicators */}
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20,
                flexWrap: 'wrap', maxWidth: 500, margin: '20px auto 0',
              }}>
                {stages.map((s, i) => {
                  const stageNum = i + 1;
                  const isActive = stageNum === (status.stage || 1);
                  const isDone = stageNum < (status.stage || 1);
                  return (
                    <div key={i} style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 11,
                      background: isActive ? `${COLORS.primary}22` : isDone ? `${COLORS.success}15` : `${COLORS.border}44`,
                      color: isActive ? COLORS.primary : isDone ? COLORS.success : COLORS.textDim,
                      border: `1px solid ${isActive ? COLORS.primary + '44' : isDone ? COLORS.success + '33' : 'transparent'}`,
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.4s ease',
                    }}>
                      {isDone ? '✓' : s.icon} {s.label.replace('...', '')}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : status.error ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CircularProgress stage={0} totalStages={6} running={false} stages={stages} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 16, color: COLORS.danger }}>
                {t.errorProcessing}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8, maxWidth: 500, margin: '8px auto 0' }}>
                {status.error}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CircularProgress stage={6} totalStages={6} running={false} stages={stages} />
              <div style={{
                fontSize: 16, fontWeight: 700, marginTop: 16,
                color: COLORS.success,
              }}>
                {t.successProcessed}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>
                {t.updatedTabs}
              </div>
            </div>
          )}

          {status.summary && !status.running && (
            <div style={{ ...styles.grid(3), marginTop: 20 }}>
              <div style={styles.metric}><div style={styles.metricVal}>{fmt(status.summary.total)}</div><div style={styles.metricLabel}>{t.processedApps}</div></div>
              <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.success }}>{fmtScore(status.summary.avg_merit)}</div><div style={styles.metricLabel}>{t.avgMerit}</div></div>
              <div style={styles.metric}><div style={{ ...styles.metricVal, color: COLORS.accent1 }}>{status.summary.best_auc?.toFixed(4)}</div><div style={styles.metricLabel}>{t.bestAuc}</div></div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.5; transform: scale(0.95); } }
        @keyframes fadeInUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
      `}</style>
    </>
  );
}

export default App;
