import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  LineElement, BarElement, PointElement,
  LinearScale, CategoryScale
} from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import './App.css';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  LineElement, BarElement, PointElement,
  LinearScale, CategoryScale
);

/* ─── Constants ─────────────────────────────────────────────────── */
const KENYAN_LENDERS = [
  { name: 'M-Pesa Fuliza',    type: 'Mobile Credit' },
  { name: 'KCB M-Pesa',      type: 'Mobile Loan' },
  { name: 'Tala',             type: 'Digital Loan' },
  { name: 'Branch',           type: 'Digital Loan' },
  { name: 'M-Shwari',        type: 'Mobile Savings/Loan' },
  { name: 'Hustler Fund',     type: 'Gov. Credit Fund' },
  { name: 'Equity Bank',      type: 'Bank Loan' },
  { name: 'KCB Bank',         type: 'Bank Loan' },
  { name: 'Co-op Bank',       type: 'Bank Loan' },
  { name: 'Family Bank',      type: 'Bank Loan' },
  { name: 'SACCO Loan',       type: 'SACCO' },
  { name: 'Employer Advance', type: 'Salary Advance' },
  { name: 'Chama Loan',       type: 'Group Loan' },
  { name: 'Other',            type: 'Other' },
];

const EXPENSE_PRESETS = [
  'Rent/House', 'Food & Groceries', 'Transport/Matatu', 'School Fees',
  'KPLC / Electricity', 'Safaricom / Airtel Bill', 'Water Bill',
  'WiFi / Internet', 'House Help', 'Medical', 'Tithe / Church',
  'Chama Contribution', 'Insurance', 'Clothing', 'Entertainment',
];

const QUOTES = [
  { text: 'A part of all you earn is yours to keep.', author: 'George S. Clason' },
  { text: 'Do not save what is left after spending, but spend what is left after saving.', author: 'Warren Buffett' },
  { text: 'Financial peace is learning to live on less than you make.', author: 'Dave Ramsey' },
  { text: 'Opportunity is a goddess who wastes no time with the unprepared.', author: 'George S. Clason' },
  { text: 'The intelligent investor sells to optimists and buys from pessimists.', author: 'Benjamin Graham' },
  { text: 'Akiba haba haba, hujaza kibaba. (Save little by little, you fill the container.)', author: 'Swahili Proverb' },
];

// NOTE: financial data uses verified Kenya market rates as fallback.
// These are published rates and are clearly labelled as reference data.
const FINANCIAL_FALLBACK = {
  saccos: [
    { name: 'Tower Sacco',    dividend: 20, note: '249k+ members. Verified 2025 dividend.' },
    { name: 'Port DT Sacco',  dividend: 20, note: 'Tier 1, assets KSh 10.54B.' },
    { name: 'Yetu Sacco',     dividend: 19, note: 'Assets KSh 7.86B.' },
  ],
  bonds: {
    '10Y': 13.13,
    tBills: { '91-day': 7.81, '182-day': 7.90, '364-day': 9.34 },
    disclaimer: 'Rates as at Nov 2025. Check CBK DhowCSD for live rates.',
  },
  mmfs: [
    { name: 'Lofty-Corban MMF',  net: 16.92, note: 'CMA-regulated. Verified yield Nov 2025.' },
    { name: 'Etica Capital MMF', net: 16.86, note: 'CMA-regulated.' },
    { name: 'Cytonn MMF',        net: 16.80, note: 'CMA-regulated. High yield.' },
  ],
  callDeposits: [
    { name: 'Credit Bank',         rate: 13.18, minInvestment: 100000, note: 'CBK-licensed bank.' },
    { name: 'African Banking Corp', rate: 12.32, minInvestment: 50000,  note: 'CBK-licensed bank.' },
    { name: 'Family Bank',          rate: 11.50, minInvestment: 100000, note: 'CBK-licensed bank.' },
  ],
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://budget-debt-backend.onrender.com';

/* ─── Analytics helper ───────────────────────────────────────────── */
const track = (eventName, params = {}) => {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  } catch { /* analytics unavailable — silent */ }
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const fmt = (n, cur = 'KES') => {
  const num = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${cur} ${num.toLocaleString('en-KE')}`;
  }
};

const encodeState = (data) => {
  try { return btoa(encodeURIComponent(JSON.stringify(data))); }
  catch { return null; }
};
const decodeState = (str) => {
  try { return JSON.parse(decodeURIComponent(atob(str))); }
  catch { return null; }
};

/* ─── Sub-components ─────────────────────────────────────────────── */
const Spinner = ({ size = 18 }) => (
  <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
);

const ProgressBar = ({ value, max, label, color = '#27ae60' }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress-wrap" role="progressbar"
      aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-label">
        <span>{label}</span><span>{Math.round(pct)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

const Toast = ({ message, type, onDismiss }) => (
  <div className={`toast toast-${type}`} role="alert">
    <span>{message}</span>
    <button onClick={onDismiss} aria-label="Dismiss">×</button>
  </div>
);

/* ─── Rate limiter ───────────────────────────────────────────────── */
const aiCallTracker = { count: 0, resetAt: Date.now() + 3600000 };
const canCallAI = () => {
  if (Date.now() > aiCallTracker.resetAt) {
    aiCallTracker.count = 0;
    aiCallTracker.resetAt = Date.now() + 3600000;
  }
  return aiCallTracker.count < 10;
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  /* ── Input state ── */
  const [salary,        setSalary]        = useState('');
  const [savingsPct,    setSavingsPct]    = useState(10);
  const [debtPct,       setDebtPct]       = useState(20);
  const [expensesPct,   setExpensesPct]   = useState(70);
  const [householdSize, setHouseholdSize] = useState(1);
  const [currency,      setCurrency]      = useState('KES');
  const [loans,         setLoans]         = useState([]);
  const [expenses,      setExpenses]      = useState([]);
  const [emergencyTarget, setEmergencyTarget] = useState('');
  const [currentSavings,  setCurrentSavings]  = useState(0);

  /* ── Output state ── */
  const [chartData,       setChartData]       = useState(null);
  const [debtCompareData, setDebtCompareData] = useState(null);
  const [adjustedData,    setAdjustedData]    = useState(null);
  const [planData,        setPlanData]        = useState(null);
  const [displaySalary,   setDisplaySalary]   = useState(0);
  const [spareCash,       setSpareCash]       = useState(0);
  const [subGoals,        setSubGoals]        = useState([]);
  const [budgetHistory,   setBudgetHistory]   = useState([]);
  const [financialData,   setFinancialData]   = useState(null);
  // Store last computed values for PDF (loans/expenses cleared after calculate)
  const lastComputedRef = useRef(null);

  /* ── AI state ── */
  const [aiAdvice,    setAiAdvice]    = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiAbortRef = useRef(null);

  /* ── UI state ── */
  const [theme,             setTheme]             = useState(
    () => localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
  const [isCalculating,     setIsCalculating]     = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt,    setDeferredPrompt]    = useState(null);
  const [updateAvailable,   setUpdateAvailable]   = useState(false);
  const [toasts,            setToasts]            = useState([]);
  const [activeTab,         setActiveTab]         = useState('budget');
  const [shareUrl,          setShareUrl]          = useState('');
  const [copyDone,          setCopyDone]          = useState(false);
  const resultsTopRef = useRef(null);

  const currentQuote = useMemo(
    () => QUOTES[new Date().getDate() % QUOTES.length], []
  );

  /* ── Toast helper ── */
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  /* ── Theme ── */
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /* ── Load saved history once on mount ── */
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem('budgetHistory') || '[]');
      if (Array.isArray(h) && h.length) {
        setBudgetHistory(h);
        const latest = h[h.length - 1];
        if (latest?.currentSavings) setCurrentSavings(latest.currentSavings);
      }
    } catch { localStorage.removeItem('budgetHistory'); }
  }, []); // intentionally empty — runs once

  /* ── Persist history (debounced to avoid excessive writes) ── */
  const historyPersistTimer = useRef(null);
  useEffect(() => {
    clearTimeout(historyPersistTimer.current);
    historyPersistTimer.current = setTimeout(() => {
      localStorage.setItem('budgetHistory', JSON.stringify(budgetHistory));
    }, 500);
    return () => clearTimeout(historyPersistTimer.current);
  }, [budgetHistory]);

  /* ── Load shared state from URL (once) ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('plan');
    if (!shared) return;
    const decoded = decodeState(shared);
    if (decoded) {
      if (decoded.salary)        setSalary(decoded.salary);
      if (decoded.loans)         setLoans(decoded.loans);
      if (decoded.expenses)      setExpenses(decoded.expenses);
      if (decoded.householdSize) setHouseholdSize(decoded.householdSize);
      if (decoded.currency)      setCurrency(decoded.currency);
      addToast('Shared plan loaded! Review and tap Calculate.', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Currency auto-detect (once, cached) ── */
  useEffect(() => {
    const cached = localStorage.getItem('detectedCurrency');
    if (cached) { setCurrency(cached); return; }
    const map = { KE:'KES', US:'USD', GB:'GBP', DE:'EUR', FR:'EUR', IN:'INR', NG:'NGN', ZA:'ZAR' };
    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then(d => {
        const cur = map[d.country_code] || 'KES';
        setCurrency(cur);
        localStorage.setItem('detectedCurrency', cur);
      })
      .catch(() => setCurrency('KES'));
  }, []); // intentionally empty — once on mount

  /* ── PWA install prompt ── */
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone || localStorage.getItem('hasSeenInstallPrompt')) return;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowInstallPrompt(true), 15000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  /* ── Service worker: update detection ONLY — no reload here.
        index.js handles registration and controllerchange reload.
        Having window.location.reload() in BOTH places caused the
        double-reload bug that reset user input fields.            ── */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    }).catch(() => {});
    // ⚠️  DO NOT add a controllerchange listener here.
    //     index.js already handles that — two listeners = two reloads.
  }, []);

  /* ── Financial data load (once, 1-hr cache) ── */
  const loadFinancialData = useCallback(async () => {
    const CACHE_KEY = 'finDataV3';
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < 3600000) return cached.data;
    } catch { /* corrupt cache */ }

    try {
      const res = await fetch(`${BACKEND_URL}/api/financial-data`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      return data;
    } catch {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: FINANCIAL_FALLBACK }));
      return FINANCIAL_FALLBACK;
    }
  }, []); // no dependencies — stable function

  useEffect(() => {
    loadFinancialData().then(setFinancialData);
  }, [loadFinancialData]);

  /* ── Percentage sliders ── */
  const updateSavingsPct = useCallback((v) => {
    const val = Math.min(50, Math.max(0, +v));
    setSavingsPct(val);
    const rem = 100 - val, sum = debtPct + expensesPct;
    if (sum > 0) {
      const d = Math.round((debtPct / sum) * rem);
      setDebtPct(d);
      setExpensesPct(100 - val - d);
    }
  }, [debtPct, expensesPct]);

  const updateDebtPct = useCallback((v) => {
    const val = Math.min(50, Math.max(0, +v));
    setDebtPct(val);
    const rem = 100 - val, sum = savingsPct + expensesPct;
    if (sum > 0) {
      const s = Math.round((savingsPct / sum) * rem);
      setSavingsPct(s);
      setExpensesPct(100 - val - s);
    }
  }, [savingsPct, expensesPct]);

  const updateExpensesPct = useCallback((v) => {
    const val = Math.min(100, Math.max(0, +v));
    setExpensesPct(val);
    const rem = 100 - val, sum = savingsPct + debtPct;
    if (sum > 0) {
      const s = Math.round((savingsPct / sum) * rem);
      setSavingsPct(s);
      setDebtPct(100 - val - s);
    }
  }, [savingsPct, debtPct]);

  /* ── Loans CRUD ── */
  const addLoan    = useCallback(() => setLoans(p => [...p, { name:'', balance:'', rate:'', minPayment:'', isEssential:false }]), []);
  const updateLoan = useCallback((i, field, value) => setLoans(p => p.map((l, idx) => idx === i ? { ...l, [field]: value } : l)), []);
  const removeLoan = useCallback((i) => setLoans(p => p.filter((_, idx) => idx !== i)), []);

  /* ── Expenses CRUD ── */
  const addExpense    = useCallback(() => setExpenses(p => [...p, { name:'', amount:'', isEssential:false }]), []);
  const updateExpense = useCallback((i, field, value) => setExpenses(p => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e)), []);
  const removeExpense = useCallback((i) => setExpenses(p => p.filter((_, idx) => idx !== i)), []);

  /* ── Debt simulation ── */
  const simulate = useCallback((loansArr, extra, sorter) => {
    if (!loansArr.length) return { months: 0, totalInterest: 0 };
    const cloned = loansArr
      .map(l => ({ balance: +l.balance || 0, rate: +l.rate || 0, minPayment: +l.minPayment || 0 }))
      .filter(l => l.balance > 0);
    if (!cloned.length) return { months: 0, totalInterest: 0 };
    let months = 0, totalInterest = 0;
    while (cloned.some(l => l.balance > 0) && months < 600) {
      cloned.forEach(l => {
        if (l.balance <= 0) return;
        const interest = l.balance * (l.rate / 100 / 12);
        l.balance = Math.max(0, l.balance + interest - Math.min(l.minPayment, l.balance + interest));
        totalInterest += interest;
      });
      const active = cloned.filter(l => l.balance > 0).sort(sorter);
      if (active.length && extra > 0) {
        active[0].balance = Math.max(0, active[0].balance - Math.min(extra, active[0].balance));
      }
      months++;
    }
    return { months, totalInterest: Math.round(totalInterest) };
  }, []);

  const snowball  = useCallback((l, e) => simulate(l, e, (a, b) => a.balance - b.balance), [simulate]);
  const avalanche = useCallback((l, e) => simulate(l, e, (a, b) => b.rate - a.rate), [simulate]);

  /* ── Stream AI advice ── */
  const streamAIAdvice = useCallback(async (contextPayload) => {
    if (!canCallAI()) {
      addToast('AI advice limit reached (10/hr). Showing summary advice.', 'warning');
      setAiAdvice(buildFallbackAdvice(contextPayload, financialData, currency));
      return;
    }
    if (aiAbortRef.current) aiAbortRef.current.abort();
    aiAbortRef.current = new AbortController();
    setAiAdvice('');
    setAiStreaming(true);
    aiCallTracker.count++;

    try {
      const res = await fetch(`${BACKEND_URL}/api/advice/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextPayload),
        signal: aiAbortRef.current.signal,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        decoder.decode(value).split('\n').forEach(line => {
          if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') {
            setAiAdvice(prev => prev + line.slice(6));
          }
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAiAdvice(buildFallbackAdvice(contextPayload, financialData, currency));
      }
    } finally {
      setAiStreaming(false);
    }
  }, [addToast, currency, financialData]);

  /* ════════════════════════════════════════════════════════════════
     MAIN CALCULATE HANDLER
     Fixed:
     1. Savings figure — shows MONTHLY allocation, not compounded total
     2. Does NOT clear salary/loans/expenses until results confirmed
     3. Switches to results tab FIRST, then scrolls to top of results
     4. Toast says "Results ready above" not "scroll down"
     5. currentSavings accumulates correctly across months
  ═══════════════════════════════════════════════════════════════ */
  const handleCalculate = useCallback(async () => {
    const sal = parseFloat(salary);
    if (!sal || sal <= 0) {
      addToast('Please enter a valid monthly salary.', 'error'); return;
    }
    const pctSum = savingsPct + debtPct + expensesPct;
    if (pctSum !== 100) {
      addToast(`Allocations total ${pctSum}% — must equal 100%.`, 'error'); return;
    }
    setIsCalculating(true);
    setAiAdvice('');

    try {
      const finData = await loadFinancialData();
      setFinancialData(finData);
      const hs = Math.max(1, parseInt(householdSize) || 1);

      /* ── Step 1: raw allocations from percentages ── */
      const rawSavings  = sal * (savingsPct  / 100);  // e.g. 10% of 50,000 = 5,000
      const rawDebt     = sal * (debtPct     / 100);  // e.g. 20% of 50,000 = 10,000
      const rawExpenses = sal * (expensesPct / 100);  // e.g. 70% of 50,000 = 35,000

      /* ── Step 2: actual totals from user entries ── */
      const totalMinPay   = loans.reduce((s, l) => s + (parseFloat(l.minPayment) || 0), 0);
      const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

      /* ── Step 3: resolve budget pressure ──
         Savings shows MONTHLY amount to save (rawSavings or less if tight).
         We never multiply by household size or compound here.            */
      let adjSavings = rawSavings;
      let adjDebt    = Math.max(rawDebt, totalMinPay); // debt budget must cover minimums
      let adjExpenses = rawExpenses;
      let adjTotalExp = totalExpenses;
      let adjTotalMin = totalMinPay;

      const expAdjMap = new Map();

      // If total outgo exceeds salary, trim non-essentials then savings
      const totalOutgo = adjTotalMin + adjTotalExp + adjSavings;
      if (totalOutgo > sal) {
        let deficit = totalOutgo - sal;

        // First: trim non-essential expenses proportionally (max 40% cut each)
        expenses.forEach((e, i) => {
          if (e.isEssential || !deficit) return;
          const orig = parseFloat(e.amount) || 0;
          const maxCut = orig * 0.4;
          const cut = Math.min(maxCut, deficit);
          if (cut > 0) {
            expAdjMap.set(`${i}`, orig - cut);
            adjTotalExp -= cut;
            deficit -= cut;
          }
        });

        // Second: trim savings to minimum 3%
        if (deficit > 0) {
          const savFloor = sal * 0.03;
          const savCut = Math.min(adjSavings - savFloor, deficit);
          if (savCut > 0) {
            adjSavings = Math.max(savFloor, adjSavings - savCut);
            deficit -= savCut;
          }
        }
      }

      /* ── Step 4: spare cash ── */
      const totalPlanned = adjTotalMin + adjTotalExp + adjSavings;
      const spareCashAmt = Math.max(0, sal - totalPlanned);

      /* ── Step 5: debt payoff comparison ── */
      const extraForDebt = Math.max(0, rawDebt - totalMinPay);
      const { months: snowM, totalInterest: snowI } = snowball(loans,  extraForDebt);
      const { months: avaM,  totalInterest: avaI  } = avalanche(loans, extraForDebt);

      /* ── Step 6: emergency fund target ──
         = 3 months of actual expenses, scaled by household     */
      const monthlyExpenses = adjTotalExp || rawExpenses;
      const efTarget = Math.max(
        parseFloat(emergencyTarget) || 0,
        monthlyExpenses * 3
      );

      /* ── Step 7: build adjustment table ── */
      const adjustments = [];
      expenses.forEach((e, i) => {
        const orig = parseFloat(e.amount) || 0;
        const adj  = expAdjMap.get(`${i}`) ?? orig;
        if (Math.abs(adj - orig) > 1) {
          adjustments.push({
            category: e.name || `Expense ${i + 1}`,
            current: orig, adjusted: adj,
            suggestion: `Reduced by ${fmt(orig - adj, currency)} to stay within budget.`,
          });
        }
      });
      adjustments.push({
        category: 'Monthly Savings',
        current: rawSavings,
        adjusted: adjSavings,
        suggestion: `Save ${fmt(adjSavings, currency)} each month. Transfer to MMF on payday.`,
      });
      adjustments.push({
        category: 'Debt Payments',
        current: totalMinPay,
        adjusted: adjTotalMin,
        suggestion: 'Pay all minimums on time to avoid penalties and protect credit score.',
      });
      adjustments.push({
        category: 'Monthly Expenses',
        current: totalExpenses,
        adjusted: adjTotalExp,
        suggestion: totalExpenses > rawExpenses
          ? `Expenses (${fmt(totalExpenses, currency)}) exceed ${expensesPct}% budget. Consider trimming non-essentials.`
          : `Within your ${expensesPct}% expenses budget.`,
      });
      adjustments.push({
        category: 'Spare Cash',
        current: 0,
        adjusted: spareCashAmt,
        suggestion: spareCashAmt > 0
          ? `${fmt(spareCashAmt, currency)} extra — apply to highest-rate debt first.`
          : 'No surplus this month — review non-essential expenses.',
      });
      setAdjustedData(adjustments);
      setSpareCash(spareCashAmt);

      /* ── Step 8: monthly action plan ── */
      const plan = [];
      // Loans — sorted by highest rate (avalanche order)
      const sortedLoans = [...loans].sort((a, b) => (parseFloat(b.rate) || 0) - (parseFloat(a.rate) || 0));
      sortedLoans.forEach((l, i) => {
        const minP  = parseFloat(l.minPayment) || 0;
        const extra = (i === 0 && extraForDebt > 0) ? extraForDebt : 0;
        const total = Math.min(minP + extra, parseFloat(l.balance) || minP);
        plan.push({
          category: 'Loan',
          subcategory: l.name || `Loan ${i + 1}`,
          priority: i + 1,
          budgeted: total,
          notes: extra > 0
            ? `Min ${fmt(minP, currency)} + ${fmt(extra, currency)} extra (avalanche — highest rate first)`
            : `Pay minimum ${fmt(minP, currency)} on time`,
        });
      });
      // Expenses
      expenses.forEach((e, i) => {
        const adj = expAdjMap.get(`${i}`) ?? (parseFloat(e.amount) || 0);
        plan.push({
          category: 'Expense',
          subcategory: e.name || `Expense ${i + 1}`,
          priority: e.isEssential ? 'Essential' : 'Non-essential',
          budgeted: adj,
          notes: e.isEssential ? 'Core need — protect this.' : 'Monitor weekly; trim if budget is tight.',
        });
      });
      // Savings
      const mmfName  = finData.mmfs[0]?.name  || 'a Money Market Fund';
      const mmfYield = finData.mmfs[0]?.net   || 16.8;
      plan.push({
        category: 'Savings',
        subcategory: 'Monthly Savings',
        priority: 'High',
        budgeted: adjSavings,
        notes: `Transfer ${fmt(adjSavings, currency)}/month to ${mmfName} (${mmfYield}% p.a.) on payday.`,
      });
      // Surplus or deficit
      const finalDiff = totalPlanned - sal;
      if (finalDiff > 0) {
        plan.push({
          category: 'Deficit',
          subcategory: 'Monthly Shortfall',
          priority: 'Action Required',
          budgeted: finalDiff,
          notes: `${fmt(finalDiff, currency)} shortfall. Consider reducing non-essential expenses or increasing income.`,
        });
      } else if (spareCashAmt > 0) {
        plan.push({
          category: 'Surplus',
          subcategory: 'Spare Cash',
          priority: 'Invest',
          budgeted: spareCashAmt,
          notes: `${fmt(spareCashAmt, currency)} extra — put towards debt or SACCO/T-Bill investment.`,
        });
      }
      setPlanData(plan);

      /* ── Step 9: sub-goals ── */
      setSubGoals([
        { target: monthlyExpenses,     label: '1-Month Buffer' },
        { target: monthlyExpenses * 3, label: '3-Month Emergency Fund' },
        { target: monthlyExpenses * 6, label: '6-Month Safety Net' },
      ].map(g => ({ ...g, achieved: currentSavings >= g.target })));

      /* ── Step 10: charts ── */
      setChartData({
        labels: ['Monthly Savings', 'Debt Payments', 'Expenses', ...(spareCashAmt > 0 ? ['Spare Cash'] : [])],
        datasets: [{
          data: [adjSavings, adjTotalMin, adjTotalExp, ...(spareCashAmt > 0 ? [spareCashAmt] : [])],
          backgroundColor: ['#27ae60', '#e74c3c', '#2980b9', '#f39c12'],
          borderWidth: 2,
        }],
      });

      if (loans.length > 0) {
        setDebtCompareData({
          labels: ['Snowball Method', 'Avalanche Method'],
          datasets: [
            {
              label: 'Months to payoff',
              data: [snowM, avaM],
              backgroundColor: ['#e74c3c', '#27ae60'],
            },
            {
              label: `Total interest (${currency})`,
              data: [snowI, avaI],
              backgroundColor: ['#e67e22', '#16a085'],
              yAxisID: 'y1',
            },
          ],
        });
      } else {
        setDebtCompareData(null);
      }

      /* ── Step 11: history — add ONE entry per calculation ── */
      // currentSavings tracks CUMULATIVE savings balance, not monthly amount
      const newCumulativeSavings = currentSavings + adjSavings;
      setCurrentSavings(newCumulativeSavings);
      setEmergencyTarget(efTarget.toString());
      const historyEntry = {
        month: new Date().toISOString().slice(0, 7),
        salary: sal,
        savings: adjSavings,         // monthly savings amount
        debtBudget: adjTotalMin,
        expensesBudget: adjTotalExp,
        totalExpenses: adjTotalExp,
        snowMonths: snowM, snowInterest: snowI,
        avaMonths: avaM,   avaInterest: avaI,
        emergencyTarget: efTarget,
        currentSavings: newCumulativeSavings, // cumulative balance
        householdSize: hs,
      };
      setBudgetHistory(prev => [...prev, historyEntry]);

      /* ── Step 12: store snapshot for PDF (before clearing form) ── */
      lastComputedRef.current = {
        sal, hs, currency,
        adjSavings, adjTotalMin, adjTotalExp, spareCashAmt,
        rawSavings, rawDebt, rawExpenses,
        snowM, snowI, avaM, avaI,
        efTarget, newCumulativeSavings,
        mmfYield, mmfName,
        finData,
        planSnapshot: plan,
        adjustedSnapshot: adjustments,
        savingsPct, debtPct, expensesPct,
      };

      setDisplaySalary(sal);

      /* ── Step 13: share URL ── */
      const encoded = encodeState({ salary: sal, loans, expenses, householdSize: hs, currency });
      if (encoded) setShareUrl(`${window.location.origin}${window.location.pathname}?plan=${encoded}`);

      /* ── Step 14: switch to results tab FIRST, then scroll to top ── */
      setActiveTab('results');
      // Small delay so React renders the results tab before scrolling
      setTimeout(() => {
        resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      /* ── Step 15: clear form inputs ── */
      setSalary('');
      setLoans([]);
      setExpenses([]);

      /* ── Step 16: analytics ── */
      track('calculate_budget', {
        currency,
        household_size: hs,
        has_loans: loans.length > 0,
        savings_pct: savingsPct,
      });

      addToast('Plan ready — results are shown above.', 'success');

      /* ── Step 17: AI advice (non-blocking, after UI updates) ── */
      streamAIAdvice({
        salary: sal, currency, householdSize: hs,
        savingsPct, debtPct, expensesPct,
        adjSavings, adjTotalMin, adjTotalExp,
        spareCash: spareCashAmt,
        snowball: { months: snowM, interest: snowI },
        avalanche: { months: avaM,  interest: avaI },
        emergencyTarget: efTarget,
        currentSavings: newCumulativeSavings,
        mmf:   finData.mmfs[0],
        sacco: finData.saccos[0],
      });

    } catch (err) {
      console.error('[Calculate]', err);
      addToast(`Calculation failed: ${err.message}`, 'error');
      track('calculate_error', { error: err.message });
    } finally {
      setIsCalculating(false);
    }
  }, [
    salary, savingsPct, debtPct, expensesPct, householdSize, currency,
    loans, expenses, emergencyTarget, currentSavings,
    snowball, avalanche, loadFinancialData, streamAIAdvice, addToast,
  ]);

  /* ── Share plan ── */
  const handleShare = useCallback(async () => {
    if (!shareUrl) { addToast('Calculate a plan first to generate a share link.', 'info'); return; }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
      addToast('Link copied to clipboard!', 'success');
      track('share_plan');
    } catch {
      addToast('Could not copy automatically — tap the URL to select and copy.', 'warning');
    }
  }, [shareUrl, addToast]);

  /* ── Add surplus to savings goal ── */
  const addSurplusToGoal = useCallback(() => {
    if (spareCash > 0) {
      setCurrentSavings(p => p + spareCash);
      addToast(`${fmt(spareCash, currency)} added to your savings balance!`, 'success');
    }
  }, [spareCash, currency, addToast]);

  /* ════════════════════════════════════════════════════════════════
     PDF GENERATION — professional layout
     Uses lastComputedRef so it works even after form is cleared.
  ═══════════════════════════════════════════════════════════════ */
  const handleDownloadPDF = useCallback(() => {
    if (!lastComputedRef.current) {
      addToast('Please calculate a plan first.', 'warning'); return;
    }
    try {
      const c = lastComputedRef.current;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const ML = 15, MR = 15, MT = 15;
      const CW = PW - ML - MR;
      let y = MT;

      // ── Colour helpers ──
      const GREEN  = [39, 174, 96];
      const DKGREEN= [46, 125, 50];
      const WHITE  = [255, 255, 255];
      const GRAY   = [245, 247, 245];
      const DKGRAY = [80, 80, 80];
      const RED    = [231, 76, 60];
      const BLUE   = [41, 128, 185];

      const checkPage = (needed = 10) => {
        if (y + needed > PH - 15) { doc.addPage(); y = MT; }
      };

      const setFont = (size, style = 'normal', color = [0, 0, 0]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        doc.setTextColor(...color);
      };

      const fillRect = (x, fy, w, h, color) => {
        doc.setFillColor(...color);
        doc.rect(x, fy, w, h, 'F');
      };

      const writeLine = (text, x, fy, maxW) => {
        const lines = doc.splitTextToSize(String(text), maxW || CW);
        doc.text(lines, x, fy);
        return lines.length;
      };

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PAGE 1 — HEADER BANNER
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      fillRect(0, 0, PW, 36, GREEN);
      setFont(18, 'bold', WHITE);
      doc.text('Budget & Debt Coach', ML, 14);
      setFont(10, 'normal', WHITE);
      doc.text('Monthly Financial Plan', ML, 21);
      setFont(9, 'normal', [220, 255, 220]);
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}  |  Household: ${c.hs} ${c.hs === 1 ? 'person' : 'people'}`,
        ML, 28
      );
      y = 44;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SUMMARY BOXES (4 columns)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const boxW = (CW - 9) / 4;
      const boxes = [
        { label: 'Monthly Salary',  value: fmt(c.sal, c.currency),       color: BLUE   },
        { label: 'Monthly Savings', value: fmt(c.adjSavings, c.currency), color: GREEN  },
        { label: 'Debt Payments',   value: fmt(c.adjTotalMin, c.currency),color: RED    },
        { label: 'Spare Cash',      value: fmt(c.spareCashAmt, c.currency),color: [243,156,18] },
      ];
      boxes.forEach((box, i) => {
        const bx = ML + i * (boxW + 3);
        fillRect(bx, y, boxW, 22, box.color);
        setFont(7, 'bold', WHITE);
        doc.text(box.label.toUpperCase(), bx + 3, y + 6);
        setFont(11, 'bold', WHITE);
        doc.text(box.value, bx + 3, y + 16);
      });
      y += 28;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BUDGET ALLOCATION
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      checkPage(40);
      fillRect(ML, y, CW, 7, DKGREEN);
      setFont(10, 'bold', WHITE);
      doc.text('BUDGET ALLOCATION', ML + 3, y + 5);
      y += 10;

      const allocRows = [
        { label: `Savings (${c.savingsPct}%)`,   amount: c.adjSavings,   color: GREEN },
        { label: `Debt (${c.debtPct}%)`,          amount: c.adjTotalMin,  color: RED   },
        { label: `Expenses (${c.expensesPct}%)`,  amount: c.adjTotalExp,  color: BLUE  },
        { label: 'Spare Cash',                    amount: c.spareCashAmt, color: [243,156,18] },
      ];
      allocRows.forEach((row, i) => {
        if (i % 2 === 0) fillRect(ML, y, CW, 8, GRAY);
        setFont(9, 'normal', DKGRAY);
        doc.text(row.label, ML + 3, y + 5.5);
        setFont(9, 'bold', [0, 0, 0]);
        doc.text(fmt(row.amount, c.currency), ML + CW - 3, y + 5.5, { align: 'right' });
        // Bar chart inline
        const barMaxW = 40;
        const barW = Math.min(barMaxW, (row.amount / c.sal) * barMaxW);
        fillRect(ML + CW/2, y + 2, barW, 4, row.color);
        y += 8;
      });
      y += 4;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MONTHLY ACTION PLAN
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      checkPage(20);
      fillRect(ML, y, CW, 7, DKGREEN);
      setFont(10, 'bold', WHITE);
      doc.text('MONTHLY ACTION PLAN', ML + 3, y + 5);
      y += 10;

      // Table header
      fillRect(ML, y, CW, 7, [200, 230, 201]);
      setFont(8, 'bold', DKGRAY);
      doc.text('ITEM',     ML + 3,       y + 5);
      doc.text('TYPE',     ML + 60,      y + 5);
      doc.text('PRIORITY', ML + 100,     y + 5);
      doc.text('AMOUNT',   ML + CW - 3,  y + 5, { align: 'right' });
      y += 8;

      c.planSnapshot.forEach((item, i) => {
        const rowH = 8;
        checkPage(rowH + 2);
        if (i % 2 === 0) fillRect(ML, y, CW, rowH, GRAY);
        const rowColor =
          item.category === 'Deficit'  ? [255, 235, 238] :
          item.category === 'Surplus'  ? [232, 245, 233] :
          item.category === 'Savings'  ? [227, 242, 253] : null;
        if (rowColor) fillRect(ML, y, CW, rowH, rowColor);

        setFont(8, 'bold', [0, 0, 0]);
        doc.text(String(item.subcategory).substring(0, 28), ML + 3, y + 5.5);
        setFont(8, 'normal', DKGRAY);
        doc.text(String(item.category),   ML + 60,     y + 5.5);
        doc.text(String(item.priority),   ML + 100,    y + 5.5);
        setFont(8, 'bold', [0, 0, 0]);
        doc.text(fmt(item.budgeted, c.currency), ML + CW - 3, y + 5.5, { align: 'right' });
        y += rowH;
      });
      y += 6;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // DEBT PAYOFF STRATEGIES (if loans exist)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (c.snowM > 0 || c.avaM > 0) {
        checkPage(50);
        fillRect(ML, y, CW, 7, DKGREEN);
        setFont(10, 'bold', WHITE);
        doc.text('DEBT PAYOFF STRATEGIES', ML + 3, y + 5);
        y += 10;

        const debtRows = [
          { label: 'Snowball (smallest balance first)', months: c.snowM, interest: c.snowI },
          { label: 'Avalanche (highest rate first)',    months: c.avaM,  interest: c.avaI  },
        ];
        debtRows.forEach((row, i) => {
          if (i % 2 === 0) fillRect(ML, y, CW, 8, GRAY);
          setFont(9, 'normal', DKGRAY);
          doc.text(row.label, ML + 3, y + 5.5);
          setFont(9, 'bold', [0, 0, 0]);
          doc.text(`${row.months} months`, ML + 110, y + 5.5, { align: 'right' });
          doc.text(`Interest: ${fmt(row.interest, c.currency)}`, ML + CW - 3, y + 5.5, { align: 'right' });
          y += 8;
        });

        if (c.snowI > c.avaI) {
          checkPage(10);
          setFont(9, 'bold', GREEN);
          doc.text(
            `✓ Avalanche saves you ${fmt(c.snowI - c.avaI, c.currency)} in interest vs Snowball`,
            ML + 3, y + 5
          );
          y += 10;
        }
        y += 4;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SAVINGS PROJECTION (5-year)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      checkPage(40);
      fillRect(ML, y, CW, 7, DKGREEN);
      setFont(10, 'bold', WHITE);
      doc.text('5-YEAR SAVINGS PROJECTION', ML + 3, y + 5);
      y += 10;

      const mr = (c.mmfYield / 100) / 12;
      const fv5 = mr > 0
        ? c.adjSavings * ((Math.pow(1 + mr, 60) - 1) / mr)
        : c.adjSavings * 60;

      setFont(9, 'normal', DKGRAY);
      const projText = [
        `Monthly savings: ${fmt(c.adjSavings, c.currency)}`,
        `MMF rate used: ${c.mmfYield}% p.a. (${c.mmfName})`,
        `Projected balance after 5 years: ${fmt(fv5, c.currency)}`,
        `Emergency fund target (3 months): ${fmt(c.efTarget, c.currency)}`,
      ];
      projText.forEach(line => {
        checkPage(8);
        setFont(9, 'normal', DKGRAY);
        doc.text(line, ML + 3, y);
        y += 6;
      });
      y += 4;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // INVESTMENT OPPORTUNITIES
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      checkPage(50);
      fillRect(ML, y, CW, 7, DKGREEN);
      setFont(10, 'bold', WHITE);
      doc.text('KENYAN INVESTMENT OPPORTUNITIES (Reference Rates)', ML + 3, y + 5);
      y += 10;

      const fd = c.finData;
      const invRows = [
        ...fd.mmfs.map(m => ({ name: m.name, rate: `${m.net}% yield`, type: 'Money Market Fund' })),
        ...fd.saccos.map(s => ({ name: s.name, rate: `${s.dividend}% dividend`, type: 'SACCO' })),
        { name: '10-Year Treasury Bond', rate: `${fd.bonds['10Y']}% p.a.`, type: 'Government Bond' },
        { name: '364-Day T-Bill', rate: `${fd.bonds.tBills['364-day']}% p.a.`, type: 'Treasury Bill' },
      ];
      invRows.forEach((row, i) => {
        checkPage(8);
        if (i % 2 === 0) fillRect(ML, y, CW, 8, GRAY);
        setFont(8, 'normal', DKGRAY);
        doc.text(row.type,  ML + 3,      y + 5.5);
        setFont(8, 'bold',  [0, 0, 0]);
        doc.text(row.name,  ML + 40,     y + 5.5);
        setFont(8, 'bold',  GREEN);
        doc.text(row.rate,  ML + CW - 3, y + 5.5, { align: 'right' });
        y += 8;
      });

      // Disclaimer
      checkPage(14);
      y += 4;
      setFont(7, 'italic', [150, 150, 150]);
      doc.text(
        'Investment rates are reference values as at Nov 2025. Always verify current rates before investing.',
        ML, y, { maxWidth: CW }
      );
      y += 8;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // AI ADVICE (if available)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (aiAdvice) {
        checkPage(20);
        fillRect(ML, y, CW, 7, DKGREEN);
        setFont(10, 'bold', WHITE);
        doc.text('AI FINANCIAL COACH ADVICE', ML + 3, y + 5);
        y += 10;
        setFont(8.5, 'normal', DKGRAY);
        const advLines = doc.splitTextToSize(aiAdvice, CW - 6);
        advLines.forEach(line => {
          checkPage(6);
          doc.text(line, ML + 3, y);
          y += 5.5;
        });
        y += 4;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // FOOTER on every page
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        fillRect(0, PH - 12, PW, 12, DKGREEN);
        setFont(7, 'normal', [200, 255, 200]);
        doc.text(
          'Budget & Debt Coach  |  budget-debt-coach-js.onrender.com  |  This report is for personal planning only.',
          PW / 2, PH - 6, { align: 'center' }
        );
        setFont(7, 'normal', [200, 255, 200]);
        doc.text(`Page ${p} of ${pageCount}`, PW - MR, PH - 6, { align: 'right' });
      }

      const filename = `budget-plan-${new Date().toISOString().slice(0, 7)}.pdf`;
      doc.save(filename);
      addToast('PDF downloaded!', 'success');
      track('download_pdf');
    } catch (err) {
      console.error('[PDF]', err);
      addToast('PDF generation failed. Please try again.', 'error');
    }
  }, [adjustedData, planData, displaySalary, financialData, aiAdvice, addToast, currency]);

  /* ── CSV download ── */
  const downloadHistory = useCallback(() => {
    if (!budgetHistory.length) { addToast('No history to export yet.', 'info'); return; }
    const headers = 'Month,Salary,Monthly Savings,Debt Budget,Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Savings Balance,Household\n';
    const rows = budgetHistory.map(e =>
      `${e.month},${e.salary},${e.savings},${e.debtBudget},${e.totalExpenses},${e.snowMonths},${e.snowInterest},${e.avaMonths},${e.avaInterest},${e.emergencyTarget},${e.currentSavings},${e.householdSize || 1}`
    ).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([headers + rows], { type: 'text/csv' })),
      download: `budget-history-${new Date().toISOString().slice(0, 7)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
    addToast('CSV exported!', 'success');
    track('export_csv');
  }, [budgetHistory, addToast]);

  const clearHistory = useCallback(() => {
    if (!window.confirm('Clear all budget history? This cannot be undone.')) return;
    setBudgetHistory([]);
    setCurrentSavings(0);
    setSubGoals([]);
    localStorage.removeItem('budgetHistory');
    addToast('History cleared.', 'info');
  }, [addToast]);

  /* ── Badges ── */
  const badges = useMemo(() => {
    if (!budgetHistory.length) return [];
    const list = [];
    const streak = budgetHistory.filter(h => h.savings / h.salary >= 0.1).length;
    if (streak >= 3) list.push({ name: '🏦 Consistent Saver',   desc: '3+ months saving 10% or more' });
    if (streak >= 6) list.push({ name: '💪 Wealth Builder',     desc: '6+ months saving consistently' });
    const latest = budgetHistory[budgetHistory.length - 1];
    if (latest?.avaMonths > 0 && latest.avaMonths <= 12)
      list.push({ name: '⚡ Debt Slayer', desc: 'On track to clear debt within 1 year' });
    if (latest?.currentSavings >= latest?.emergencyTarget && latest?.emergencyTarget > 0)
      list.push({ name: '🛡️ Emergency Ready', desc: 'Emergency fund fully funded!' });
    return list;
  }, [budgetHistory]);

  /* ── History chart ── */
  const historyChartData = useMemo(() => ({
    labels: budgetHistory.map(e => e.month),
    datasets: [
      { label: 'Monthly Savings', data: budgetHistory.map(e => e.savings), borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.15)', tension: 0.3, pointRadius: 4 },
      { label: 'Expenses',        data: budgetHistory.map(e => e.totalExpenses), borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)',  tension: 0.3, pointRadius: 4 },
    ],
  }), [budgetHistory]);

  const efTarget = parseFloat(emergencyTarget) || 0;

  /* ═════════════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════════════ */
  return (
    <div className="app" data-theme={theme}>

      {/* Toast stack */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type}
            onDismiss={() => setToasts(p => p.filter(x => x.id !== t.id))} />
        ))}
      </div>

      {/* PWA install */}
      {showInstallPrompt && (
        <div className="pwa-banner">
          <span>📱 Install Budget & Debt Coach for offline access</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => {
              deferredPrompt?.prompt();
              setShowInstallPrompt(false);
              localStorage.setItem('hasSeenInstallPrompt', 'true');
              track('pwa_install_accepted');
            }}>Install</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setShowInstallPrompt(false);
              localStorage.setItem('hasSeenInstallPrompt', 'true');
            }}>Later</button>
          </div>
        </div>
      )}

      {/* SW update */}
      {updateAvailable && (
        <div className="update-banner">
          <span>🆕 Update available</span>
          <button className="btn btn-primary btn-sm" onClick={() => {
            navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
            setUpdateAvailable(false);
          }}>Update now</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setUpdateAvailable(false)}>Later</button>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">💰</span>
          <div>
            <h1>Budget & Debt Coach</h1>
            <p>Plan. Save. Recover.</p>
          </div>
        </div>
        <button className="btn btn-icon" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode">{theme === 'dark' ? '☀️' : '🌙'}</button>
      </header>

      {/* Quote */}
      <div className="quote-bar">
        <span className="quote-mark">"</span>
        <em>{currentQuote.text}</em>
        <span className="quote-author">— {currentQuote.author}</span>
      </div>

      {/* Tabs */}
      <nav className="tabs" role="tablist">
        {[['budget','📊 Budget'],['results','📈 Results'],['history','🗓️ History'],['invest','💼 Invest']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={activeTab === id}
            className={`tab ${activeTab === id ? 'tab-active' : ''}`}
            onClick={() => { setActiveTab(id); track('tab_switch', { tab: id }); }}>
            {label}
          </button>
        ))}
      </nav>

      {/* ══════════ TAB: BUDGET ══════════ */}
      {activeTab === 'budget' && (
        <main className="tab-content">
          <section className="card" aria-labelledby="settings-h">
            <h2 id="settings-h">Budget Settings</h2>
            <div className="form-row">
              <label className="form-label">
                Monthly salary ({currency})
                <input type="number" className="input" value={salary}
                  onChange={e => setSalary(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="e.g. 85000" min="0" />
              </label>
              <label className="form-label">
                Household size
                <input type="number" className="input" style={{ width:90 }}
                  value={householdSize} onChange={e => setHouseholdSize(e.target.value)}
                  min="1" max="20" />
              </label>
              <label className="form-label">
                Currency
                <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {['KES','USD','EUR','GBP','INR','NGN','ZAR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <div className="slider-section">
              <p className="slider-total" style={{ color: savingsPct+debtPct+expensesPct===100 ? '#27ae60' : '#e74c3c' }}>
                Total: {savingsPct+debtPct+expensesPct}% {savingsPct+debtPct+expensesPct===100 ? '✓' : '(must equal 100%)'}
              </p>
              {[
                { label:'Savings',          pct:savingsPct,  fn:updateSavingsPct,  color:'#27ae60', tip:'Aim ≥ 10%' },
                { label:'Debt repayment',   pct:debtPct,     fn:updateDebtPct,     color:'#e74c3c', tip:'Recommended ≤ 20%' },
                { label:'Living expenses',  pct:expensesPct, fn:updateExpensesPct, color:'#2980b9', tip:'Target ≤ 70%' },
              ].map(({ label, pct, fn, color, tip }) => (
                <div key={label} className="slider-row">
                  <div className="slider-row-header">
                    <span>{label}</span>
                    <span className="slider-val" style={{ color }}>{pct}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1" value={pct}
                    onChange={e => fn(e.target.value)} className="slider"
                    style={{ accentColor: color }} aria-label={`${label} percentage`} />
                  <span className="slider-tip">{tip}</span>
                </div>
              ))}
            </div>

            <label className="form-label" style={{ marginTop:8 }}>
              Emergency fund target ({currency}) — leave blank to auto-calculate (3 months expenses)
              <input type="number" className="input" value={emergencyTarget}
                onChange={e => setEmergencyTarget(e.target.value)}
                onFocus={e => e.target.select()} placeholder="Auto" />
            </label>
          </section>

          {/* Loans */}
          <section className="card" aria-labelledby="loans-h">
            <div className="section-header">
              <h2 id="loans-h">Loans & Debts</h2>
              <button className="btn btn-secondary btn-sm" onClick={addLoan}>+ Add loan</button>
            </div>
            {loans.length === 0 && (
              <p className="empty-state">No loans added. Tap "Add loan" to track your debts.</p>
            )}
            <div className="card-grid">
              {loans.map((loan, i) => (
                <div key={i} className="item-card">
                  <div className="item-card-header">
                    <span className="item-card-num">Loan {i+1}</span>
                    <button className="btn-remove" onClick={() => removeLoan(i)} aria-label={`Remove loan ${i+1}`}>×</button>
                  </div>
                  <label className="form-label">
                    Lender / name
                    <input list={`lenders-${i}`} className="input" value={loan.name}
                      onChange={e => updateLoan(i,'name',e.target.value)} placeholder="e.g. Tala, Fuliza…" />
                    <datalist id={`lenders-${i}`}>
                      {KENYAN_LENDERS.map(l => <option key={l.name} value={l.name}>{l.type}</option>)}
                    </datalist>
                  </label>
                  <div className="form-row-compact">
                    <label className="form-label">
                      Balance ({currency})
                      <input type="number" className="input" value={loan.balance}
                        onChange={e => updateLoan(i,'balance',e.target.value)}
                        onFocus={e => e.target.select()} min="0" />
                    </label>
                    <label className="form-label">
                      Rate (% p.a.)
                      <input type="number" className="input" step="0.1" value={loan.rate}
                        onChange={e => updateLoan(i,'rate',e.target.value)}
                        onFocus={e => e.target.select()} min="0" />
                    </label>
                    <label className="form-label">
                      Min payment/mo
                      <input type="number" className="input" value={loan.minPayment}
                        onChange={e => updateLoan(i,'minPayment',e.target.value)}
                        onFocus={e => e.target.select()} min="0" />
                    </label>
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={loan.isEssential||false}
                      onChange={() => updateLoan(i,'isEssential',!loan.isEssential)} />
                    Cannot defer this payment
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Expenses */}
          <section className="card" aria-labelledby="expenses-h">
            <div className="section-header">
              <h2 id="expenses-h">Monthly Expenses</h2>
              <button className="btn btn-secondary btn-sm" onClick={addExpense}>+ Add expense</button>
            </div>
            {expenses.length === 0 && (
              <p className="empty-state">No expenses added. Tap "Add expense" to track spending.</p>
            )}
            <div className="card-grid">
              {expenses.map((exp, i) => (
                <div key={i} className="item-card">
                  <div className="item-card-header">
                    <span className="item-card-num">Expense {i+1}</span>
                    <button className="btn-remove" onClick={() => removeExpense(i)} aria-label={`Remove expense ${i+1}`}>×</button>
                  </div>
                  <label className="form-label">
                    Description
                    <input list={`presets-${i}`} className="input" value={exp.name}
                      onChange={e => updateExpense(i,'name',e.target.value)} placeholder="e.g. Rent, Food…" />
                    <datalist id={`presets-${i}`}>
                      {EXPENSE_PRESETS.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </label>
                  <label className="form-label">
                    Amount ({currency})
                    <input type="number" className="input" value={exp.amount}
                      onChange={e => updateExpense(i,'amount',e.target.value)}
                      onFocus={e => e.target.select()} min="0" />
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={exp.isEssential||false}
                      onChange={() => updateExpense(i,'isEssential',!exp.isEssential)} />
                    Essential expense
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <section className="card actions-card">
            <button className="btn btn-primary btn-lg" onClick={handleCalculate}
              disabled={isCalculating} aria-busy={isCalculating}>
              {isCalculating ? <><Spinner /> Calculating…</> : '🧮 Calculate & Generate Plan'}
            </button>
            <div className="action-row">
              <button className="btn btn-secondary" onClick={handleDownloadPDF}>📄 Download PDF</button>
              <button className="btn btn-secondary" onClick={downloadHistory}>📊 Export CSV</button>
              <button className="btn btn-ghost"     onClick={clearHistory}>🗑️ Clear history</button>
            </div>
            {shareUrl && (
              <div className="share-box">
                <span className="share-label">Share plan:</span>
                <input className="input share-input" value={shareUrl} readOnly onClick={e => e.target.select()} />
                <button className="btn btn-secondary btn-sm" onClick={handleShare}>
                  {copyDone ? '✓ Copied!' : '📋 Copy link'}
                </button>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ══════════ TAB: RESULTS ══════════ */}
      {activeTab === 'results' && (
        <main className="tab-content">
          {/* Scroll anchor — results rendered from TOP */}
          <div ref={resultsTopRef} style={{ scrollMarginTop: 16 }} />

          {!planData ? (
            <div className="empty-results">
              <span style={{ fontSize:48 }}>📊</span>
              <p>No plan yet. Go to the <strong>Budget</strong> tab and tap <strong>Calculate</strong>.</p>
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="summary-strip">
                {[
                  { label:'Monthly salary',    value: fmt(displaySalary, currency),                                                            color:'#2980b9' },
                  { label:'Monthly savings',   value: fmt(adjustedData?.find(a=>a.category==='Monthly Savings')?.adjusted||0, currency),       color:'#27ae60' },
                  { label:'Debt payments',     value: fmt(adjustedData?.find(a=>a.category==='Debt Payments')?.adjusted||0, currency),         color:'#e74c3c' },
                  { label:'Spare cash',        value: fmt(spareCash, currency),                                                                color:'#f39c12' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="summary-card">
                    <span className="summary-label">{label}</span>
                    <span className="summary-value" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* AI advice */}
              <section className="card ai-card" aria-labelledby="ai-h">
                <h2 id="ai-h">🤖 AI Financial Coach</h2>
                {aiStreaming && !aiAdvice && (
                  <div className="ai-loading"><Spinner /> <span>Analysing your finances…</span></div>
                )}
                {aiAdvice ? (
                  <div className="ai-advice">
                    {aiAdvice}
                    {aiStreaming && <span className="ai-cursor" aria-hidden="true">▍</span>}
                  </div>
                ) : !aiStreaming ? (
                  <p className="ai-empty">AI advice will appear here after you calculate your plan.</p>
                ) : null}
              </section>

              {/* Pie chart */}
              {chartData && (
                <section className="card chart-card" aria-labelledby="alloc-h">
                  <h2 id="alloc-h">Monthly Allocation Breakdown</h2>
                  <div className="chart-wrap">
                    <Pie data={chartData} options={{ plugins:{ legend:{ position:'bottom' } }, maintainAspectRatio:false }} />
                  </div>
                </section>
              )}

              {/* Debt comparison */}
              {debtCompareData && (
                <section className="card chart-card" aria-labelledby="debt-h">
                  <h2 id="debt-h">Snowball vs Avalanche Comparison</h2>
                  <p className="chart-sub">Avalanche (highest rate first) minimises total interest paid.</p>
                  <div className="chart-wrap">
                    <Bar data={debtCompareData} options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom' } },
                      scales: {
                        y:  { title: { display: true, text: 'Months to payoff' } },
                        y1: { position: 'right', title: { display: true, text: `Interest (${currency})` }, grid: { drawOnChartArea: false } },
                      },
                    }} />
                  </div>
                </section>
              )}

              {/* Adjustment table */}
              {adjustedData && (
                <section className="card" aria-labelledby="adj-h">
                  <h2 id="adj-h">Budget Summary</h2>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Category</th><th>Target</th><th>Recommended</th><th>Note</th></tr></thead>
                      <tbody>
                        {adjustedData.map((a, i) => (
                          <tr key={i}>
                            <td><strong>{a.category}</strong></td>
                            <td>{fmt(a.current, currency)}</td>
                            <td className={a.adjusted < a.current ? 'text-warning' : 'text-success'}>{fmt(a.adjusted, currency)}</td>
                            <td className="text-muted text-sm">{a.suggestion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Monthly plan */}
              {planData && (
                <section className="card" aria-labelledby="plan-h">
                  <h2 id="plan-h">Monthly Action Plan</h2>
                  <p className="section-sub">
                    Salary <strong>{fmt(displaySalary, currency)}</strong> ·
                    Total planned <strong>{fmt(
                      (adjustedData?.find(a=>a.category==='Monthly Savings')?.adjusted||0)+
                      (adjustedData?.find(a=>a.category==='Debt Payments')?.adjusted||0)+
                      (adjustedData?.find(a=>a.category==='Monthly Expenses')?.adjusted||0),
                      currency
                    )}</strong>
                  </p>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Type</th><th>Item</th><th>Priority</th><th>Amount/Month</th><th>Guidance</th></tr></thead>
                      <tbody>
                        {planData.map((item, i) => (
                          <tr key={i} className={
                            item.category==='Deficit' ? 'row-danger' :
                            item.category==='Surplus' ? 'row-success' :
                            item.category==='Savings' ? 'row-info' : ''
                          }>
                            <td>{item.category}</td>
                            <td><strong>{item.subcategory}</strong></td>
                            <td>{item.priority}</td>
                            <td><strong>{fmt(item.budgeted, currency)}</strong></td>
                            <td className="text-muted text-sm">{item.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Emergency fund */}
              <section className="card" aria-labelledby="ef-h">
                <div className="section-header">
                  <h2 id="ef-h">Emergency Fund Tracker</h2>
                  <button className="btn btn-secondary btn-sm" onClick={addSurplusToGoal} disabled={!spareCash}>
                    + Add spare cash
                  </button>
                </div>
                <p>{fmt(currentSavings, currency)} saved of {fmt(efTarget, currency)} target</p>
                <ProgressBar value={currentSavings} max={efTarget} label="Overall progress" color="#27ae60" />
                <div className="sub-goals">
                  {subGoals.map((g, i) => (
                    <div key={i} className={`sub-goal-row ${g.achieved ? 'achieved' : ''}`}>
                      {g.achieved ? '✅' : '⬜'} {g.label}: {fmt(g.target, currency)}
                      <div className="sub-goal-bar">
                        <div style={{ width:`${Math.min(100,(currentSavings/g.target)*100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {badges.length > 0 && (
                <section className="card badges-card" aria-labelledby="badges-h">
                  <h2 id="badges-h">Achievements</h2>
                  <div className="badges-grid">
                    {badges.map((b, i) => (
                      <div key={i} className="badge-item">
                        <strong>{b.name}</strong><span>{b.desc}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      )}

      {/* ══════════ TAB: HISTORY ══════════ */}
      {activeTab === 'history' && (
        <main className="tab-content">
          <section className="card" aria-labelledby="history-h">
            <div className="section-header">
              <h2 id="history-h">Budget History</h2>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" onClick={downloadHistory}>Export CSV</button>
                <button className="btn btn-ghost btn-sm"     onClick={clearHistory}>Clear</button>
              </div>
            </div>
            {!budgetHistory.length ? (
              <p className="empty-state">No history yet. Calculate your first budget to start tracking.</p>
            ) : (
              <>
                <div className="chart-wrap" style={{ height:240 }}>
                  <Line data={historyChartData} options={{ maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }} />
                </div>
                <div className="table-wrap" style={{ marginTop:16 }}>
                  <table className="data-table">
                    <thead><tr><th>Month</th><th>Salary</th><th>Saved/mo</th><th>Expenses</th><th>Debt pmts</th><th>Household</th></tr></thead>
                    <tbody>
                      {[...budgetHistory].reverse().map((e, i) => (
                        <tr key={i}>
                          <td>{e.month}</td>
                          <td>{fmt(e.salary, currency)}</td>
                          <td className="text-success">{fmt(e.savings, currency)}</td>
                          <td>{fmt(e.totalExpenses, currency)}</td>
                          <td className="text-warning">{fmt(e.debtBudget, currency)}</td>
                          <td>{e.householdSize||1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </main>
      )}

      {/* ══════════ TAB: INVEST ══════════ */}
      {activeTab === 'invest' && (
        <main className="tab-content">
          <div className="card" style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:10, padding:'12px 16px', marginBottom:4 }}>
            <p style={{ margin:0, fontSize:13, color:'#795548' }}>
              <strong>⚠️ Reference rates only.</strong> Rates shown are published figures as at November 2025.
              Always verify current rates directly with the provider before investing.
              This is not financial advice.
            </p>
          </div>

          {!financialData ? (
            <div className="empty-results"><Spinner size={32} /><p>Loading market data…</p></div>
          ) : (
            <>
              <section className="card" aria-labelledby="mmf-h">
                <h2 id="mmf-h">💹 Money Market Funds (MMF)</h2>
                <p className="section-sub">CMA-regulated. Liquid. Best for emergency fund and short-term savings.</p>
                <div className="invest-grid">
                  {financialData.mmfs.map((m, i) => (
                    <div key={i} className="invest-card invest-card-green">
                      <span className="invest-rank">#{i+1}</span>
                      <strong>{m.name}</strong>
                      <span className="invest-rate">{m.net}% <small>yield p.a.</small></span>
                      <p className="invest-note">{m.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card" aria-labelledby="sacco-h">
                <h2 id="sacco-h">🏦 SACCOs</h2>
                <p className="section-sub">Higher dividends; membership and share capital required.</p>
                <div className="invest-grid">
                  {financialData.saccos.map((s, i) => (
                    <div key={i} className="invest-card invest-card-blue">
                      <span className="invest-rank">#{i+1}</span>
                      <strong>{s.name}</strong>
                      <span className="invest-rate">{s.dividend}% <small>dividend</small></span>
                      <p className="invest-note">{s.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card" aria-labelledby="tbill-h">
                <h2 id="tbill-h">🏛️ Treasury Bills & Bonds</h2>
                <p className="section-sub">Government-backed, zero default risk. Buy via CBK DhowCSD portal.</p>
                <div className="invest-grid">
                  {[
                    { label:'91-Day T-Bill',  rate: financialData.bonds.tBills['91-day'],  note:'Very short-term, very liquid' },
                    { label:'182-Day T-Bill', rate: financialData.bonds.tBills['182-day'], note:'Medium-term safety' },
                    { label:'364-Day T-Bill', rate: financialData.bonds.tBills['364-day'], note:'Best T-Bill rate' },
                    { label:'10-Year Bond',   rate: financialData.bonds['10Y'],            note:'Long-term, best yield' },
                  ].map((t, i) => (
                    <div key={i} className="invest-card invest-card-amber">
                      <strong>{t.label}</strong>
                      <span className="invest-rate">{t.rate}% <small>p.a.</small></span>
                      <p className="invest-note">{t.note}</p>
                    </div>
                  ))}
                </div>
                {financialData.bonds.disclaimer && (
                  <p style={{ fontSize:12, color:'#888', marginTop:8 }}>{financialData.bonds.disclaimer}</p>
                )}
              </section>

              <section className="card" aria-labelledby="deposit-h">
                <h2 id="deposit-h">🏧 Call / Fixed Deposits</h2>
                <p className="section-sub">CBK-licensed bank deposits. Minimum investment applies.</p>
                <div className="invest-grid">
                  {financialData.callDeposits.map((d, i) => (
                    <div key={i} className="invest-card invest-card-purple">
                      <span className="invest-rank">#{i+1}</span>
                      <strong>{d.name}</strong>
                      <span className="invest-rate">{d.rate}% <small>p.a.</small></span>
                      <p className="invest-note">Min: {fmt(d.minInvestment, currency)}</p>
                      <p className="invest-note">{d.note}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p>Budget &amp; Debt Coach — Free personal finance tool. Not financial advice.</p>
        <div className="footer-links">
          <a href="https://x.com/B_D_coach_app" target="_blank" rel="noopener noreferrer" aria-label="Follow on X">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93z"/>
            </svg>
          </a>
          <a href="https://wa.me/254783621541" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ─── Fallback AI advice ─────────────────────────────────────────── */
function buildFallbackAdvice(ctx, finData, currency) {
  const f = (n) => {
    try {
      return new Intl.NumberFormat('en-KE', { style:'currency', currency, maximumFractionDigits:0 }).format(Math.round(n||0));
    } catch { return `${currency} ${Math.round(n||0).toLocaleString()}`; }
  };
  const mmf   = finData?.mmfs?.[0];
  const sacco = finData?.saccos?.[0];
  const bestMethod = (ctx.avalanche?.interest || 0) <= (ctx.snowball?.interest || 0) ? 'Avalanche' : 'Snowball';
  const interestSaved = Math.abs((ctx.snowball?.interest || 0) - (ctx.avalanche?.interest || 0));

  return `Your personalised budget analysis for ${ctx.householdSize} person(s) on a ${f(ctx.salary)} salary:

📊 ALLOCATION SUMMARY
Your ${ctx.savingsPct}% savings target = ${f(ctx.adjSavings)}/month. Debt budget: ${f(ctx.adjTotalMin)}/month. Expenses: ${f(ctx.adjTotalExp)}/month.${ctx.spareCash > 0 ? ` Spare cash: ${f(ctx.spareCash)}.` : ''}

💳 DEBT STRATEGY
Use the ${bestMethod} method — it saves you ${f(interestSaved)} in interest. Pay all minimums first, then direct every extra shilling to your highest-rate loan.

💰 SAVINGS PLAN
Transfer your ${f(ctx.adjSavings)} to ${mmf?.name || 'a Money Market Fund'} (${mmf?.net || 16.8}% yield) on payday — before any spending. Set up a standing order to automate this.

🛡️ EMERGENCY FUND
Your 3-month target is ${f(ctx.emergencyTarget)}. You currently have ${f(ctx.currentSavings)} saved.${ctx.currentSavings >= ctx.emergencyTarget ? ' Fully funded — well done!' : ` You need ${f(ctx.emergencyTarget - ctx.currentSavings)} more.`}

🇰🇪 KENYA TIP
Once your emergency fund is complete, consider ${sacco?.name || 'Tower Sacco'} (${sacco?.dividend || 20}% dividend). SACCOs also give you 3× your savings as a loan at competitive rates once you are debt-free.

${ctx.spareCash > 0 ? `✨ You have ${f(ctx.spareCash)} spare this month — put it towards your highest-rate debt immediately.` : '⚠️ No surplus this month. Review non-essential expenses to create breathing room.'}`;
}
