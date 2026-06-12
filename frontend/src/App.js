// src/App.js
import React, {
  useState, useEffect, useCallback, useMemo, useRef
} from 'react';
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

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS  (defined outside component — never re-created)
═══════════════════════════════════════════════════════════════ */
const KENYAN_LENDERS = [
  { name: 'M-Pesa Fuliza',    type: 'Mobile Credit' },
  { name: 'KCB M-Pesa',       type: 'Mobile Loan' },
  { name: 'Tala',              type: 'Digital Loan' },
  { name: 'Branch',            type: 'Digital Loan' },
  { name: 'M-Shwari',         type: 'Mobile Savings/Loan' },
  { name: 'Hustler Fund',      type: 'Gov. Credit Fund' },
  { name: 'Equity Bank Loan',  type: 'Bank Loan' },
  { name: 'KCB Bank Loan',     type: 'Bank Loan' },
  { name: 'Co-op Bank Loan',   type: 'Bank Loan' },
  { name: 'Family Bank Loan',  type: 'Bank Loan' },
  { name: 'SACCO Loan',        type: 'SACCO' },
  { name: 'Employer Advance',  type: 'Salary Advance' },
  { name: 'Chama Loan',        type: 'Group Loan' },
  { name: 'Other',             type: 'Other' },
];

const EXPENSE_PRESETS = [
  'Rent/House', 'Food & Groceries', 'Transport/Matatu', 'School Fees',
  'KPLC / Electricity', 'Safaricom / Airtel Bill', 'Water Bill',
  'WiFi / Internet', 'House Help', 'Medical / Hospital', 'Tithe / Church',
  'Chama Contribution', 'Insurance', 'Clothing', 'Entertainment',
];

const QUOTES = [
  { text: 'A part of all you earn is yours to keep.', author: 'George S. Clason' },
  { text: 'Do not save what is left after spending — spend what is left after saving.', author: 'Warren Buffett' },
  { text: 'Financial peace is learning to live on less than you make.', author: 'Dave Ramsey' },
  { text: 'Opportunity is a goddess who wastes no time with the unprepared.', author: 'George S. Clason' },
  { text: 'The intelligent investor sells to optimists and buys from pessimists.', author: 'Benjamin Graham' },
  { text: 'Akiba haba haba, hujaza kibaba. (Little savings fill the container.)', author: 'Swahili Proverb' },
  { text: 'Do not wish to be rich overnight — that road often leads backward.', author: 'Kenyan Saying' },
];

// Stable financial fallback — verified Kenyan data (2025)
const FINANCIAL_FALLBACK = {
  saccos: [
    { name: 'Tower Sacco',    dividend: 20, note: '249k+ members, Tier-1, consistent top dividends' },
    { name: 'Port DT Sacco',  dividend: 20, note: 'Assets KSh 10.54B, top-tier dividend history' },
    { name: 'Yetu Sacco',     dividend: 19, note: 'Assets KSh 7.86B, strong dividend track record' },
  ],
  bonds: {
    '10Y': 13.13,
    tBills: { '91-day': 7.81, '182-day': 7.90, '364-day': 9.34 },
  },
  mmfs: [
    { name: 'Lofty-Corban MMF', net: 16.92, note: 'Leading daily yield (Vasili Africa, 2025)' },
    { name: 'Etica Capital MMF', net: 16.86, note: 'Consistent top-3 performer' },
    { name: 'Cytonn MMF',        net: 16.80, note: 'High yield, accessible, online registration' },
  ],
  callDeposits: [
    { name: 'Credit Bank',         rate: 13.18, minInvestment: 100000, note: 'Highest bank savings rate (CBK survey 2025)' },
    { name: 'African Banking Corp', rate: 12.32, minInvestment:  50000, note: 'Competitive fixed-call deposit rate' },
    { name: 'Family Bank',          rate: 11.50, minInvestment: 100000, note: 'Accessible minimum investment' },
  ],
};

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || 'https://budget-debt-backend.onrender.com';

/* ── Rate limiter (module-level — survives re-renders) ── */
const _aiTracker = { count: 0, resetAt: Date.now() + 3_600_000 };
function canCallAI() {
  const now = Date.now();
  if (now > _aiTracker.resetAt) {
    _aiTracker.count = 0;
    _aiTracker.resetAt = now + 3_600_000;
  }
  return _aiTracker.count < 10;
}

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS  (outside component — zero dependency on state)
═══════════════════════════════════════════════════════════════ */
function fmtCurrency(n, cur = 'KES') {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: cur, maximumFractionDigits: 0,
  }).format(Math.round(isFinite(n) ? n : 0));
}

function encodeShareState(data) {
  try { return btoa(encodeURIComponent(JSON.stringify(data))); }
  catch { return null; }
}
function decodeShareState(str) {
  try { return JSON.parse(decodeURIComponent(atob(str))); }
  catch { return null; }
}

/* Debt payoff simulation — pure, no side effects */
function simulateDebt(loansArr, extraPerMonth, sorter) {
  if (!loansArr.length) return { months: 0, totalInterest: 0 };
  const cloned = loansArr.map(l => ({
    balance:    Math.max(0, parseFloat(l.balance)    || 0),
    rate:       Math.max(0, parseFloat(l.rate)       || 0),
    minPayment: Math.max(0, parseFloat(l.minPayment) || 0),
  }));
  let months = 0;
  let totalInterest = 0;
  while (cloned.some(l => l.balance > 0.01) && months < 600) {
    // Apply interest & minimum payments first
    let totalMinPaid = 0;
    cloned.forEach(l => {
      if (l.balance <= 0) return;
      const interest = l.balance * (l.rate / 100 / 12);
      l.balance += interest;
      totalInterest += interest;
      const pay = Math.min(l.minPayment, l.balance);
      l.balance -= pay;
      l.balance = Math.max(0, l.balance);
      totalMinPaid += pay;
    });
    // Apply extra to priority target
    const extra = Math.max(0, extraPerMonth - totalMinPaid);
    if (extra > 0) {
      const active = cloned.filter(l => l.balance > 0).sort(sorter);
      if (active.length > 0) {
        const pay = Math.min(extra, active[0].balance);
        active[0].balance = Math.max(0, active[0].balance - pay);
      }
    }
    months++;
  }
  return { months, totalInterest: Math.round(totalInterest) };
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS  (memoised to prevent unnecessary re-renders)
═══════════════════════════════════════════════════════════════ */
const Spinner = React.memo(({ size = 18 }) => (
  <span
    className="spinner"
    style={{ width: size, height: size, display: 'inline-block' }}
    aria-hidden="true"
  />
));

const Toast = React.memo(({ message, type, onDismiss }) => (
  <div className={`toast toast-${type}`} role="alert">
    <span>{message}</span>
    <button onClick={onDismiss} aria-label="Dismiss">×</button>
  </div>
));

const ProgressBar = React.memo(({ value, max, label, color = '#27ae60' }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="progress-wrap"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-label">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS HELPER  (fires GA4 events when window.gtag exists)
═══════════════════════════════════════════════════════════════ */
function trackEvent(name, params = {}) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch { /* non-fatal */ }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function App() {

  /* ── Input state ─────────────────────────────────────────────── */
  const [salary,         setSalary]         = useState('');
  const [savingsPct,     setSavingsPct]     = useState(10);
  const [debtPct,        setDebtPct]        = useState(20);
  const [expensesPct,    setExpensesPct]    = useState(70);
  const [householdSize,  setHouseholdSize]  = useState(1);
  const [currency,       setCurrency]       = useState('KES');
  const [loans,          setLoans]          = useState([]);
  const [expenses,       setExpenses]       = useState([]);
  const [emergencyInput, setEmergencyInput] = useState(''); // raw user input — not overwritten by calc

  /* ── Calculated / output state ───────────────────────────────── */
  const [results,        setResults]        = useState(null);   // single object — all output
  const [budgetHistory,  setBudgetHistory]  = useState([]);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [financialData,  setFinancialData]  = useState(FINANCIAL_FALLBACK);

  /* ── AI state ────────────────────────────────────────────────── */
  const [aiAdvice,    setAiAdvice]    = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiAbortRef = useRef(null);

  /* ── UI state ────────────────────────────────────────────────── */
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
  const [isCalculating,    setIsCalculating]    = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt,   setDeferredPrompt]   = useState(null);
  const [updateAvailable,  setUpdateAvailable]  = useState(false);
  const [toasts,           setToasts]           = useState([]);
  const [activeTab,        setActiveTab]        = useState('budget');
  const [shareUrl,         setShareUrl]         = useState('');
  const [copyDone,         setCopyDone]         = useState(false);

  // Stable quote — computed once, never changes during session
  const currentQuote = useMemo(
    () => QUOTES[new Date().getDate() % QUOTES.length],
    []
  );

  // Ref to results section — scroll-to after calculate
  const resultsRef = useRef(null);

  /* ── Toast helper ────────────────────────────────────────────── */
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  /* ── Theme ───────────────────────────────────────────────────── */
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /* ── Load history from localStorage (once on mount) ─────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('budgetHistory');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setBudgetHistory(parsed);
      const latest = parsed[parsed.length - 1];
      if (latest?.cumulativeSavings) setCurrentSavings(latest.cumulativeSavings);
    } catch {
      localStorage.removeItem('budgetHistory');
    }
  }, []); // ← EMPTY array: runs exactly once, no reload loop

  /* ── Persist history to localStorage ────────────────────────── */
  // NOTE: use a ref flag to avoid saving the initial empty array
  // that would overwrite valid stored data during the first render.
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    localStorage.setItem('budgetHistory', JSON.stringify(budgetHistory));
  }, [budgetHistory]);

  /* ── Decode shared plan from URL (once on mount) ────────────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('plan');
    if (!shared) return;
    const decoded = decodeShareState(shared);
    if (decoded) {
      if (decoded.salary)        setSalary(String(decoded.salary));
      if (decoded.loans)         setLoans(decoded.loans);
      if (decoded.expenses)      setExpenses(decoded.expenses);
      if (decoded.householdSize) setHouseholdSize(decoded.householdSize);
      if (decoded.currency)      setCurrency(decoded.currency);
      addToast('Shared plan loaded. Review details then tap Calculate.', 'success');
    }
    // Clean the URL so refresh doesn't re-load
    window.history.replaceState({}, '', window.location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Currency auto-detect (once, no retry loop) ─────────────── */
  useEffect(() => {
    const CC_MAP = {
      KE: 'KES', US: 'USD', GB: 'GBP',
      DE: 'EUR', FR: 'EUR', IN: 'INR', NG: 'NGN', ZA: 'ZAR',
    };
    let cancelled = false;
    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then(d => { if (!cancelled) setCurrency(CC_MAP[d.country_code] || 'KES'); })
      .catch(() => { /* keep default KES */ });
    return () => { cancelled = true; };
  }, []);

  /* ── PWA install prompt (once on mount) ─────────────────────── */
  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      localStorage.getItem('hasSeenInstallPrompt')
    ) return;
    const handler = e => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowInstallBanner(true), 15000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  /* ── SW update detection ─────────────────────────────────────── */
  // SW is registered in index.js only — this just listens for the
  // updateAvailable flag that index.js posts via message.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = e => {
      if (e.data?.type === 'UPDATE_AVAILABLE') setUpdateAvailable(true);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  /* ── Load financial data (once, cached 1 hour) ───────────────── */
  useEffect(() => {
    const CACHE_KEY = 'finDataV3';
    let cancelled = false;
    const load = async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.ts < 3_600_000) {
          if (!cancelled) setFinancialData(cached.data);
          return;
        }
        const res = await fetch(`${BACKEND_URL}/api/financial-data`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        if (!cancelled) {
          setFinancialData(data);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        }
      } catch {
        // Keep FINANCIAL_FALLBACK as-is — already set as default state
        if (!cancelled) setFinancialData(FINANCIAL_FALLBACK);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // ← ONE load on mount, never loops

  /* ═══════════════════════════════════════════════════════════════
     SLIDER HANDLERS  (proportional rebalance — stable callbacks)
  ═══════════════════════════════════════════════════════════════ */
  const updateSavingsPct = useCallback(v => {
    const val = Math.min(50, Math.max(0, +v));
    setSavingsPct(val);
    setDebtPct(d => {
      const rem = 100 - val;
      const e = 100 - val - d;
      if (e < 0) { setExpensesPct(0); return rem; }
      setExpensesPct(e);
      return d;
    });
  }, []);

  const updateDebtPct = useCallback(v => {
    const val = Math.min(50, Math.max(0, +v));
    setDebtPct(val);
    setSavingsPct(s => {
      const rem = 100 - val;
      const e = 100 - val - s;
      if (e < 0) { setExpensesPct(0); return rem; }
      setExpensesPct(e);
      return s;
    });
  }, []);

  const updateExpensesPct = useCallback(v => {
    const val = Math.min(100, Math.max(0, +v));
    setExpensesPct(val);
    setSavingsPct(s => {
      const rem = 100 - val;
      if (s > rem) { setDebtPct(0); return rem; }
      setDebtPct(rem - s);
      return s;
    });
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     CRUD HANDLERS — stable, no array deps
  ═══════════════════════════════════════════════════════════════ */
  const addLoan     = useCallback(() =>
    setLoans(p => [...p, { id: Date.now(), name: '', balance: '', rate: '', minPayment: '', isEssential: false }]), []);
  const updateLoan  = useCallback((id, field, value) =>
    setLoans(p => p.map(l => l.id === id ? { ...l, [field]: value } : l)), []);
  const removeLoan  = useCallback((id) =>
    setLoans(p => p.filter(l => l.id !== id)), []);

  const addExpense    = useCallback(() =>
    setExpenses(p => [...p, { id: Date.now(), name: '', amount: '', isEssential: false }]), []);
  const updateExpense = useCallback((id, field, value) =>
    setExpenses(p => p.map(e => e.id === id ? { ...e, [field]: value } : e)), []);
  const removeExpense = useCallback((id) =>
    setExpenses(p => p.filter(e => e.id !== id)), []);

  /* ═══════════════════════════════════════════════════════════════
     AI STREAMING
  ═══════════════════════════════════════════════════════════════ */
  const streamAIAdvice = useCallback(async (payload) => {
    if (!canCallAI()) {
      addToast('AI advice limit reached (10/hour). Try again later.', 'warning');
      return;
    }
    if (aiAbortRef.current) aiAbortRef.current.abort();
    aiAbortRef.current = new AbortController();
    setAiAdvice('');
    setAiStreaming(true);
    _aiTracker.count++;

    try {
      const res = await fetch(`${BACKEND_URL}/api/advice/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: aiAbortRef.current.signal,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const txt = line.slice(6);
            if (txt === '[DONE]') break;
            setAiAdvice(prev => prev + txt);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAiAdvice(buildFallbackAdvice(payload, financialData, currency));
      }
    } finally {
      setAiStreaming(false);
    }
  }, [addToast, currency, financialData]);

  /* ═══════════════════════════════════════════════════════════════
     MAIN CALCULATE — fixes:
     • savings = exactly salary × savingsPct% (no inflation loop)
     • does NOT clear loans/expenses after calc (user can re-edit)
     • switches to results tab + scrolls to top of results
     • toast says "Your plan is ready above" not "scroll down"
     • logs to GA4
  ═══════════════════════════════════════════════════════════════ */
  const handleCalculate = useCallback(async () => {
    const sal = parseFloat(salary);
    if (!sal || sal <= 0) {
      addToast('Please enter a valid monthly salary.', 'error');
      return;
    }
    if (savingsPct + debtPct + expensesPct !== 100) {
      addToast('Savings + Debt + Expenses must total 100%.', 'error');
      return;
    }
    setIsCalculating(true);
    setAiAdvice('');

    try {
      const fd   = financialData; // already loaded, no async needed
      const hs   = Math.max(1, parseInt(householdSize) || 1);

      /* ── Step 1: exact allocations from salary ── */
      const rawSavings  = sal * (savingsPct  / 100);  // e.g. KES 8,500 for 10%
      const rawDebtBudget = sal * (debtPct   / 100);
      const rawExpBudget  = sal * (expensesPct / 100);

      /* ── Step 2: actual totals from user inputs ── */
      const totalMinPay  = loans.reduce((s, l) => s + (parseFloat(l.minPayment) || 0), 0);
      const totalExpActual = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

      /* ── Step 3: resolve budget pressure ──────────
         Rule: savings is sacred at savingsPct%; trim expenses first,
         then flag a deficit — never inflate savings above allocation.
      ─────────────────────────────────────────────── */
      let adjSavings = rawSavings;   // FIXED: always exactly the allocation %
      let adjDebt    = rawDebtBudget;
      let adjExp     = totalExpActual;

      // If actual debt payments exceed debt budget, extend debt budget
      // and reduce expense budget proportionally (not savings)
      let debtOverage = Math.max(0, totalMinPay - rawDebtBudget);
      adjDebt = Math.max(rawDebtBudget, totalMinPay); // always pay minimums

      // Expense trimming: trim non-essentials if total > expense budget
      const expAdjMap = new Map(); // id → adjusted amount
      if (totalExpActual > rawExpBudget || debtOverage > 0) {
        const available = sal - adjSavings - adjDebt; // what's truly left
        let budget = Math.max(0, available);
        let remaining = budget;

        // First allocate essentials in full
        expenses.filter(e => e.isEssential).forEach(e => {
          const amt = parseFloat(e.amount) || 0;
          expAdjMap.set(e.id, Math.min(amt, remaining));
          remaining = Math.max(0, remaining - amt);
        });
        // Then non-essentials proportionally
        const nonEss = expenses.filter(e => !e.isEssential);
        const totalNonEss = nonEss.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        nonEss.forEach(e => {
          const amt = parseFloat(e.amount) || 0;
          const share = totalNonEss > 0 ? amt / totalNonEss : 0;
          expAdjMap.set(e.id, Math.round(Math.min(amt, share * remaining)));
        });
        adjExp = [...expAdjMap.values()].reduce((s, v) => s + v, 0);
      } else {
        // Fits within budget — use actual amounts
        expenses.forEach(e => expAdjMap.set(e.id, parseFloat(e.amount) || 0));
      }

      const totalPlanned = adjSavings + adjDebt + adjExp;
      const spareCash    = Math.max(0, sal - totalPlanned);
      const deficit      = Math.max(0, totalPlanned - sal);

      /* ── Step 4: debt payoff simulations ── */
      const snowResult = simulateDebt(
        loans, adjDebt,
        (a, b) => a.balance - b.balance  // snowball: smallest balance first
      );
      const avaResult = simulateDebt(
        loans, adjDebt,
        (a, b) => b.rate - a.rate        // avalanche: highest rate first
      );

      /* ── Step 5: emergency fund target ── */
      const monthlyLivingCost = adjExp || (sal * 0.5);
      const userEfTarget = parseFloat(emergencyInput) || 0;
      const efTarget = userEfTarget > 0
        ? userEfTarget
        : Math.round(monthlyLivingCost * 3 * (1 + (hs - 1) * 0.1));

      /* ── Step 6: adjustment summary ── */
      const adjustments = [];
      expenses.forEach(e => {
        const orig = parseFloat(e.amount) || 0;
        const adj  = expAdjMap.get(e.id) ?? orig;
        adjustments.push({
          category:   e.name || 'Expense',
          original:   orig,
          adjusted:   adj,
          essential:  e.isEssential,
          suggestion: orig === adj
            ? 'Within budget — no change needed.'
            : `Reduced by ${fmtCurrency(orig - adj, currency)} to fit your ${expensesPct}% expense allocation.`,
        });
      });

      /* ── Step 7: monthly action plan ── */
      const plan = [];

      // Savings first
      plan.push({
        type: 'savings', label: 'Monthly Savings',
        amount: adjSavings,
        note: `Transfer ${fmtCurrency(adjSavings, currency)} on payday to ${fd.mmfs[0]?.name || 'a Money Market Fund'} (${fd.mmfs[0]?.net || 16.8}% yield). This is your 3-month emergency fund builder.`,
        color: '#27ae60',
      });

      // Debt payments
      [...loans]
        .sort((a, b) => (parseFloat(b.rate) || 0) - (parseFloat(a.rate) || 0))
        .forEach((l, i) => {
          const minP  = parseFloat(l.minPayment) || 0;
          const bal   = parseFloat(l.balance)    || 0;
          const extra = i === 0 ? Math.max(0, adjDebt - totalMinPay) : 0;
          const pay   = Math.min(minP + extra, bal || minP + extra);
          plan.push({
            type: 'debt', label: l.name || `Loan ${i + 1}`,
            amount: pay,
            note: extra > 0
              ? `Minimum ${fmtCurrency(minP, currency)} + ${fmtCurrency(extra, currency)} extra. Paying extra on your highest-rate loan saves the most interest.`
              : `Pay minimum ${fmtCurrency(minP, currency)}. On-time payments protect your credit score.`,
            color: '#e74c3c',
          });
        });

      // Expenses
      expenses.forEach(e => {
        const adj = expAdjMap.get(e.id) ?? (parseFloat(e.amount) || 0);
        plan.push({
          type: 'expense', label: e.name || 'Expense',
          amount: adj,
          note: e.isEssential
            ? 'Essential need — prioritised in full.'
            : adj < (parseFloat(e.amount) || 0)
              ? `Reduced from ${fmtCurrency(parseFloat(e.amount) || 0, currency)} to fit your budget. Review weekly.`
              : 'Fits within budget.',
          color: '#2980b9',
          essential: e.isEssential,
        });
      });

      // Surplus or deficit
      if (deficit > 0) {
        plan.push({
          type: 'deficit', label: 'Budget Shortfall',
          amount: deficit,
          note: `Your outgoings exceed your salary by ${fmtCurrency(deficit, currency)}. Options: reduce non-essential expenses, seek additional income (freelance, overtime), or temporarily reduce savings to the 3% floor.`,
          color: '#c0392b',
        });
      } else if (spareCash > 0) {
        plan.push({
          type: 'surplus', label: 'Available Surplus',
          amount: spareCash,
          note: `${fmtCurrency(spareCash, currency)} unallocated. Apply first to your highest-rate debt, then to your SACCO or T-Bill for long-term growth.`,
          color: '#f39c12',
        });
      }

      /* ── Step 8: charts ── */
      const pieData = {
        labels: ['Savings', 'Debt Payments', 'Expenses', ...(spareCash > 0 ? ['Surplus'] : [])],
        datasets: [{
          data: [adjSavings, adjDebt, adjExp, ...(spareCash > 0 ? [spareCash] : [])],
          backgroundColor: ['#27ae60', '#e74c3c', '#2980b9', '#f39c12'],
          borderWidth: 2,
          borderColor: '#fff',
        }],
      };

      const debtChartData = loans.length > 0 ? {
        labels: ['Snowball Method', 'Avalanche Method'],
        datasets: [
          {
            label: 'Months to pay off',
            data: [snowResult.months, avaResult.months],
            backgroundColor: ['#e74c3c88', '#27ae6088'],
            borderColor:     ['#e74c3c',   '#27ae60'],
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: `Total interest paid (${currency})`,
            data: [snowResult.totalInterest, avaResult.totalInterest],
            backgroundColor: ['#e67e2288', '#16a08588'],
            borderColor:     ['#e67e22',   '#16a085'],
            borderWidth: 2,
            yAxisID: 'y1',
          },
        ],
      } : null;

      /* ── Step 9: sub-goals ── */
      const subGoals = [
        { label: '1-Month Buffer',    target: monthlyLivingCost },
        { label: '3-Month Emergency', target: monthlyLivingCost * 3 },
        { label: '6-Month Safety Net', target: monthlyLivingCost * 6 },
      ].map(g => ({ ...g, achieved: currentSavings >= g.target }));

      /* ── Step 10: history ── */
      const newCumSavings = currentSavings + adjSavings;
      const histEntry = {
        month:            new Date().toISOString().slice(0, 7),
        salary:           sal,
        savings:          adjSavings,
        debtBudget:       adjDebt,
        totalExpenses:    adjExp,
        snowMonths:       snowResult.months,
        snowInterest:     snowResult.totalInterest,
        avaMonths:        avaResult.months,
        avaInterest:      avaResult.totalInterest,
        emergencyTarget:  efTarget,
        cumulativeSavings: newCumSavings,
        householdSize:    hs,
      };
      setCurrentSavings(newCumSavings);
      setBudgetHistory(prev => {
        const updated = [...prev, histEntry];
        return updated;
      });

      /* ── Step 11: commit all results as ONE state update ── */
      setResults({
        sal, hs, adjSavings, adjDebt, adjExp, spareCash, deficit,
        snowResult, avaResult, efTarget, newCumSavings,
        adjustments, plan, pieData, debtChartData, subGoals,
        mmf: fd.mmfs[0], sacco: fd.saccos[0],
        allLoans: loans.map(l => ({ ...l })),  // snapshot for PDF
      });

      /* ── Step 12: shareable URL ── */
      const encoded = encodeShareState({ salary: sal, loans, expenses, householdSize: hs, currency });
      if (encoded) setShareUrl(`${window.location.origin}/?plan=${encoded}`);

      /* ── Step 13: switch tab → results, scroll to top ── */
      setActiveTab('results');
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      addToast('✅ Your plan is ready!', 'success');
      trackEvent('calculate_budget', { salary: sal, currency, householdSize: hs });

      /* ── Step 14: AI advice (non-blocking) ── */
      streamAIAdvice({
        salary: sal, currency, householdSize: hs,
        savingsPct, debtPct, expensesPct,
        totalLoans: loans.length,
        adjSavings, adjDebt, adjExp, spareCash, deficit,
        snowball:  { months: snowResult.months,  interest: snowResult.totalInterest },
        avalanche: { months: avaResult.months, interest: avaResult.totalInterest },
        emergencyTarget: efTarget, currentSavings: newCumSavings,
        mmf: fd.mmfs[0], sacco: fd.saccos[0],
      });

    } catch (err) {
      console.error('[Calculate]', err);
      addToast(`Calculation error: ${err.message}`, 'error');
      trackEvent('calculate_error', { error: err.message });
    } finally {
      setIsCalculating(false);
    }
  }, [
    salary, savingsPct, debtPct, expensesPct, householdSize, currency,
    loans, expenses, emergencyInput, currentSavings,
    financialData, streamAIAdvice, addToast,
  ]);

  /* ═══════════════════════════════════════════════════════════════
     PDF GENERATION — professional layout with sections & borders
  ═══════════════════════════════════════════════════════════════ */
  const handleDownloadPDF = useCallback(() => {
    if (!results) {
      addToast('Calculate a plan first.', 'warning');
      return;
    }
    try {
      const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
      const PW   = doc.internal.pageSize.getWidth();   // 210
      const PH   = doc.internal.pageSize.getHeight();  // 297
      const ML   = 15;  // left margin
      const MR   = 15;  // right margin
      const CW   = PW - ML - MR;  // content width
      let y = 0;

      /* ── helpers ── */
      const checkPage = (needed = 10) => {
        if (y + needed > PH - 15) { doc.addPage(); y = 20; }
      };
      const text = (str, x, fontSize = 10, style = 'normal', color = [30, 30, 30]) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', style);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(String(str), CW);
        checkPage(lines.length * fontSize * 0.45 + 2);
        doc.text(lines, x, y);
        y += lines.length * (fontSize * 0.45) + 2;
      };
      const gap = (mm = 4) => { y += mm; };
      const rule = (color = [200, 230, 200]) => {
        checkPage(3);
        doc.setDrawColor(...color);
        doc.setLineWidth(0.3);
        doc.line(ML, y, PW - MR, y);
        gap(3);
      };
      const sectionHeader = (title) => {
        checkPage(14);
        gap(3);
        doc.setFillColor(39, 174, 96);
        doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(title, ML + 4, y + 5.5);
        y += 11;
        doc.setTextColor(30, 30, 30);
      };
      const twoCol = (labelL, valL, labelR, valR) => {
        checkPage(7);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(labelL + ':', ML, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(valL, ML + 45, y);
        if (labelR) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.text(labelR + ':', ML + 95, y);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text(valR, ML + 140, y);
        }
        y += 6;
      };

      /* ── PAGE 1: Cover header ── */
      // Green banner
      doc.setFillColor(39, 174, 96);
      doc.rect(0, 0, PW, 32, 'F');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Budget & Debt Coach', ML, 14);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Monthly Financial Plan', ML, 21);
      doc.setFontSize(9);
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-KE', { day:'2-digit', month:'long', year:'numeric' })}   |   Household: ${results.hs} person(s)   |   Currency: ${currency}`,
        ML, 28
      );
      y = 40;

      /* ── SUMMARY ── */
      sectionHeader('1. Budget Summary');
      twoCol('Monthly Salary',  fmtCurrency(results.sal, currency),
             'Household Size',  `${results.hs} person(s)`);
      twoCol('Savings ('+savingsPct+'%)',  fmtCurrency(results.adjSavings, currency),
             'Debt Budget ('+debtPct+'%)', fmtCurrency(results.adjDebt, currency));
      twoCol('Expense Budget ('+expensesPct+'%)', fmtCurrency(results.adjExp, currency),
             results.deficit > 0 ? 'Shortfall' : 'Surplus',
             fmtCurrency(results.deficit > 0 ? results.deficit : results.spareCash, currency));
      gap(2);
      if (results.deficit > 0) {
        doc.setFillColor(255, 235, 230);
        doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 30, 30);
        doc.text(`⚠ Monthly deficit of ${fmtCurrency(results.deficit, currency)}. See action plan below.`, ML + 3, y + 5.5);
        y += 11;
        doc.setTextColor(30, 30, 30);
      }

      /* ── MONTHLY ACTION PLAN ── */
      sectionHeader('2. Monthly Action Plan');
      const typeColors = {
        savings: [39, 174, 96], debt: [192, 57, 43],
        expense: [41, 128, 185], surplus: [243, 156, 18], deficit: [192, 57, 43],
      };
      results.plan.forEach(item => {
        checkPage(18);
        const col = typeColors[item.type] || [80, 80, 80];
        doc.setFillColor(...col, 20); // lighter fill
        doc.setFillColor(col[0], col[1], col[2]);
        doc.circle(ML + 2, y + 1.5, 1.5, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(item.label, ML + 7, y + 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...col);
        doc.text(fmtCurrency(item.amount, currency), PW - MR - 35, y + 3);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90, 90, 90);
        doc.setFontSize(8.5);
        const noteLines = doc.splitTextToSize(item.note, CW - 7);
        doc.text(noteLines, ML + 7, y);
        y += noteLines.length * 4 + 3;
        rule([220, 220, 220]);
      });

      /* ── DEBT STRATEGY ── */
      if (results.allLoans.length > 0) {
        sectionHeader('3. Debt Payoff Strategy');
        twoCol('Snowball payoff',   `${results.snowResult.months} months`,
               'Interest paid',    fmtCurrency(results.snowResult.totalInterest, currency));
        twoCol('Avalanche payoff',  `${results.avaResult.months} months`,
               'Interest paid',    fmtCurrency(results.avaResult.totalInterest, currency));
        const saving = results.snowResult.totalInterest - results.avaResult.totalInterest;
        if (saving > 0) {
          gap(2);
          doc.setFillColor(232, 245, 232);
          doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F');
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(27, 94, 32);
          doc.text(
            `✓ Recommended: Avalanche method saves you ${fmtCurrency(saving, currency)} in interest`,
            ML + 3, y + 5.5
          );
          y += 11;
          doc.setTextColor(30, 30, 30);
        }
        gap(2);
        text('Your loans (highest rate first — focus extra payments here):', ML, 9, 'bold');
        gap(2);
        [...results.allLoans]
          .sort((a, b) => (parseFloat(b.rate)||0) - (parseFloat(a.rate)||0))
          .forEach((l, i) => {
            checkPage(7);
            twoCol(
              `${i+1}. ${l.name || 'Loan'}`,
              fmtCurrency(parseFloat(l.balance)||0, currency),
              `Rate ${parseFloat(l.rate)||0}% p.a.`,
              `Min: ${fmtCurrency(parseFloat(l.minPayment)||0, currency)}`
            );
          });
      }

      /* ── SAVINGS & INVESTMENTS ── */
      sectionHeader('4. Savings & Investment Plan');
      const mmf = results.mmf;
      const sacco = results.sacco;
      const mr = (mmf?.net || 16.8) / 100 / 12;
      const fv60 = results.adjSavings * ((Math.pow(1 + mr, 60) - 1) / mr);
      twoCol('Monthly savings',       fmtCurrency(results.adjSavings, currency),
             '5-Year projection',     fmtCurrency(fv60, currency));
      twoCol('Emergency fund target', fmtCurrency(results.efTarget, currency),
             'Savings to date',       fmtCurrency(results.newCumSavings, currency));
      gap(3);
      text('Recommended investment vehicles:', ML, 9, 'bold');
      gap(2);
      if (mmf) twoCol(`MMF: ${mmf.name}`, `${mmf.net}% yield p.a.`, 'Type', 'Liquid, low-risk');
      if (sacco) twoCol(`SACCO: ${sacco.name}`, `${sacco.dividend}% dividend`, 'Type', 'Long-term wealth');
      twoCol('T-Bill (364-day)', `${financialData.bonds?.tBills?.['364-day'] || 9.34}% p.a.`, 'Type', 'Gov. backed, zero risk');
      gap(2);
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'Investment rates are indicative (2025 Kenyan market data). Verify current rates before investing. This is not financial advice.',
        ML, y
      );
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);

      /* ── AI ADVICE ── */
      if (aiAdvice && aiAdvice.trim().length > 20) {
        sectionHeader('5. AI Financial Coach Advice');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        const adviceLines = doc.splitTextToSize(aiAdvice.trim(), CW);
        adviceLines.forEach(line => {
          checkPage(5);
          doc.text(line, ML, y);
          y += 4.5;
        });
      }

      /* ── Footer on every page ── */
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(245, 245, 245);
        doc.rect(0, PH - 12, PW, 12, 'F');
        doc.setFontSize(7.5);
        doc.setTextColor(140, 140, 140);
        doc.setFont('helvetica', 'normal');
        doc.text('Budget & Debt Coach — budget-debt-coach-js.onrender.com', ML, PH - 5);
        doc.text(`Page ${i} of ${totalPages}`, PW - MR - 18, PH - 5);
      }

      doc.save(`Budget_Plan_${new Date().toISOString().slice(0,7)}.pdf`);
      addToast('PDF downloaded successfully!', 'success');
      trackEvent('download_pdf');
    } catch (err) {
      console.error('[PDF]', err);
      addToast('PDF generation failed. Please try again.', 'error');
    }
  }, [results, currency, savingsPct, debtPct, expensesPct, financialData, aiAdvice, addToast]);

  /* ═══════════════════════════════════════════════════════════════
     OTHER HANDLERS
  ═══════════════════════════════════════════════════════════════ */
  const handleShare = useCallback(async () => {
    if (!shareUrl) { addToast('Calculate a plan first.', 'info'); return; }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
      addToast('Plan link copied!', 'success');
    } catch {
      addToast('Could not copy — tap the URL to copy manually.', 'warning');
    }
  }, [shareUrl, addToast]);

  const addSurplusToGoal = useCallback(() => {
    if (results?.spareCash > 0) {
      setCurrentSavings(p => p + results.spareCash);
      addToast(`${fmtCurrency(results.spareCash, currency)} added to savings balance!`, 'success');
    }
  }, [results, currency, addToast]);

  const downloadHistory = useCallback(() => {
    if (!budgetHistory.length) { addToast('No history to export.', 'info'); return; }
    const header = 'Month,Salary,Savings,Debt Budget,Total Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Cumulative Savings,Household Size\n';
    const rows = budgetHistory.map(e =>
      `${e.month},${e.salary},${e.savings},${e.debtBudget},${e.totalExpenses},${e.snowMonths},${e.snowInterest},${e.avaMonths},${e.avaInterest},${e.emergencyTarget},${e.cumulativeSavings},${e.householdSize || 1}`
    ).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' })),
      download: `budget_history_${new Date().toISOString().slice(0, 7)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
    addToast('CSV exported!', 'success');
    trackEvent('export_csv');
  }, [budgetHistory, addToast]);

  const clearHistory = useCallback(() => {
    if (!window.confirm('Clear all history? This cannot be undone.')) return;
    setBudgetHistory([]);
    setCurrentSavings(0);
    setResults(null);
    localStorage.removeItem('budgetHistory');
    addToast('History cleared.', 'info');
  }, [addToast]);

  /* ── Derived / memoised values ── */
  const badges = useMemo(() => {
    const list = [];
    const streak = budgetHistory.filter(h => h.savings / h.salary >= 0.1).length;
    if (streak >= 3) list.push({ name: '🏦 Purse Fattener',  desc: '3+ months saving 10% or more' });
    if (streak >= 6) list.push({ name: '💪 Wealth Builder',  desc: '6 consecutive months of saving' });
    const latest = budgetHistory.at(-1);
    if (latest?.avaMonths <= 12)                              list.push({ name: '⚡ Debt Slayer',      desc: 'Debt payoff under 1 year (Avalanche)' });
    if (latest?.cumulativeSavings >= latest?.emergencyTarget) list.push({ name: '🛡️ Emergency Ready', desc: 'Emergency fund fully funded!' });
    return list;
  }, [budgetHistory]);

  const historyChartData = useMemo(() => ({
    labels: budgetHistory.map(e => e.month),
    datasets: [
      { label: 'Savings / mo',    data: budgetHistory.map(e => e.savings),       borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)',  tension: 0.3, fill: true },
      { label: 'Expenses / mo',   data: budgetHistory.map(e => e.totalExpenses), borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)',  tension: 0.3, fill: true },
    ],
  }), [budgetHistory]);

  const efTarget = parseFloat(results?.efTarget) || 0;

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="app" data-theme={theme}>

      {/* ── Toasts ── */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onDismiss={() => setToasts(p => p.filter(x => x.id !== t.id))}
          />
        ))}
      </div>

      {/* ── PWA install banner ── */}
      {showInstallBanner && (
        <div className="pwa-banner">
          <span>📱 Install Budget & Debt Coach for offline use</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => {
              deferredPrompt?.prompt();
              setShowInstallBanner(false);
              localStorage.setItem('hasSeenInstallPrompt', 'true');
              trackEvent('pwa_install_accepted');
            }}>Install</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setShowInstallBanner(false);
              localStorage.setItem('hasSeenInstallPrompt', 'true');
            }}>Later</button>
          </div>
        </div>
      )}

      {/* ── SW update banner ── */}
      {updateAvailable && (
        <div className="update-banner">
          <span>🆕 New version available!</span>
          <button className="btn btn-primary btn-sm" onClick={() => {
            navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
            setUpdateAvailable(false);
          }}>Update now</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setUpdateAvailable(false)}>Later</button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">💰</span>
          <div>
            <h1>Budget &amp; Debt Coach</h1>
            <p>Plan · Save · Recover</p>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {/* ── Daily quote ── */}
      <div className="quote-bar">
        <span className="quote-mark">"</span>
        <em>{currentQuote.text}</em>
        <span className="quote-author">— {currentQuote.author}</span>
      </div>

      {/* ── Tab nav ── */}
      <nav className="tabs" role="tablist" aria-label="App sections">
        {[
          ['budget',  '📊 Budget'],
          ['results', '📈 Results'],
          ['history', '🗓️ History'],
          ['invest',  '💼 Invest'],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`tab${activeTab === id ? ' tab-active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
            {id === 'results' && results && <span className="tab-dot" />}
          </button>
        ))}
      </nav>

      {/* ══════════════ TAB: BUDGET ══════════════ */}
      {activeTab === 'budget' && (
        <main className="tab-content">

          {/* Budget Settings */}
          <section className="card" aria-labelledby="settings-hd">
            <h2 id="settings-hd">Budget Settings</h2>
            <div className="form-row">
              <label className="form-label">
                Monthly salary ({currency})
                <input
                  type="number" className="input"
                  value={salary}
                  onChange={e => setSalary(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="e.g. 85000" min="0"
                />
              </label>
              <label className="form-label">
                Household size
                <input
                  type="number" className="input" style={{ width: 90 }}
                  value={householdSize}
                  onChange={e => setHouseholdSize(e.target.value)}
                  min="1" max="20"
                />
              </label>
              <label className="form-label">
                Currency
                <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {['KES','USD','EUR','GBP','INR','NGN','ZAR'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="slider-section">
              <p className="slider-total" style={{
                color: savingsPct + debtPct + expensesPct === 100 ? '#27ae60' : '#e74c3c'
              }}>
                Total: {savingsPct + debtPct + expensesPct}%
                {savingsPct + debtPct + expensesPct === 100 ? ' ✓ Ready' : ' — must equal 100%'}
              </p>
              {[
                { label: 'Savings',          pct: savingsPct,  fn: updateSavingsPct,  color: '#27ae60', tip: 'Aim ≥ 10%' },
                { label: 'Debt repayment',   pct: debtPct,     fn: updateDebtPct,     color: '#e74c3c', tip: 'Recommended ≤ 20%' },
                { label: 'Living expenses',  pct: expensesPct, fn: updateExpensesPct, color: '#2980b9', tip: 'Target ≤ 70%' },
              ].map(({ label, pct, fn, color, tip }) => (
                <div key={label} className="slider-row">
                  <div className="slider-row-header">
                    <span>{label}</span>
                    <span className="slider-val" style={{ color }}>
                      {pct}% = {fmtCurrency((parseFloat(salary) || 0) * pct / 100, currency)}
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="1"
                    value={pct}
                    onChange={e => fn(e.target.value)}
                    className="slider"
                    style={{ accentColor: color }}
                    aria-label={label}
                  />
                  <span className="slider-tip">{tip}</span>
                </div>
              ))}
            </div>

            <label className="form-label" style={{ marginTop: 8 }}>
              Emergency fund target ({currency}) — leave blank to auto-calculate
              <input
                type="number" className="input"
                value={emergencyInput}
                onChange={e => setEmergencyInput(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder={`Auto: ~3 months expenses`}
              />
            </label>
          </section>

          {/* Loans */}
          <section className="card" aria-labelledby="loans-hd">
            <div className="section-header">
              <h2 id="loans-hd">Loans &amp; Debts</h2>
              <button className="btn btn-secondary btn-sm" onClick={addLoan}>+ Add loan</button>
            </div>
            {loans.length === 0 && (
              <p className="empty-state">No loans yet. Tap "Add loan" to track your debts.</p>
            )}
            <div className="card-grid">
              {loans.map(loan => (
                <div key={loan.id} className="item-card">
                  <div className="item-card-header">
                    <span className="item-card-num">Loan</span>
                    <button className="btn-remove" onClick={() => removeLoan(loan.id)} aria-label="Remove loan">×</button>
                  </div>
                  <label className="form-label">
                    Lender / name
                    <input
                      list={`lenders-${loan.id}`} className="input"
                      value={loan.name}
                      onChange={e => updateLoan(loan.id, 'name', e.target.value)}
                      placeholder="e.g. Tala, Fuliza…"
                    />
                    <datalist id={`lenders-${loan.id}`}>
                      {KENYAN_LENDERS.map(l => <option key={l.name} value={l.name}>{l.type}</option>)}
                    </datalist>
                  </label>
                  <div className="form-row-compact">
                    <label className="form-label">
                      Balance ({currency})
                      <input type="number" className="input" value={loan.balance}
                        onChange={e => updateLoan(loan.id, 'balance', e.target.value)}
                        onFocus={e => e.target.select()} min="0" />
                    </label>
                    <label className="form-label">
                      Rate (% p.a.)
                      <input type="number" className="input" step="0.1" value={loan.rate}
                        onChange={e => updateLoan(loan.id, 'rate', e.target.value)}
                        onFocus={e => e.target.select()} min="0" />
                    </label>
                    <label className="form-label">
                      Min. payment ({currency})
                      <input type="number" className="input" value={loan.minPayment}
                        onChange={e => updateLoan(loan.id, 'minPayment', e.target.value)}
                        onFocus={e => e.target.select()} min="0" />
                    </label>
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={loan.isEssential || false}
                      onChange={() => updateLoan(loan.id, 'isEssential', !loan.isEssential)} />
                    Cannot defer this loan
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Expenses */}
          <section className="card" aria-labelledby="expenses-hd">
            <div className="section-header">
              <h2 id="expenses-hd">Monthly Expenses</h2>
              <button className="btn btn-secondary btn-sm" onClick={addExpense}>+ Add expense</button>
            </div>
            {expenses.length === 0 && (
              <p className="empty-state">No expenses yet. Tap "Add expense" to list your monthly costs.</p>
            )}
            <div className="card-grid">
              {expenses.map(exp => (
                <div key={exp.id} className="item-card">
                  <div className="item-card-header">
                    <span className="item-card-num">Expense</span>
                    <button className="btn-remove" onClick={() => removeExpense(exp.id)} aria-label="Remove expense">×</button>
                  </div>
                  <label className="form-label">
                    Description
                    <input
                      list={`presets-${exp.id}`} className="input"
                      value={exp.name}
                      onChange={e => updateExpense(exp.id, 'name', e.target.value)}
                      placeholder="e.g. Rent, Food, KPLC…"
                    />
                    <datalist id={`presets-${exp.id}`}>
                      {EXPENSE_PRESETS.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </label>
                  <label className="form-label">
                    Amount ({currency})
                    <input type="number" className="input" value={exp.amount}
                      onChange={e => updateExpense(exp.id, 'amount', e.target.value)}
                      onFocus={e => e.target.select()} min="0" />
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={exp.isEssential || false}
                      onChange={() => updateExpense(exp.id, 'isEssential', !exp.isEssential)} />
                    Essential (prioritise in full)
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <section className="card actions-card">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleCalculate}
              disabled={isCalculating}
              aria-busy={isCalculating}
            >
              {isCalculating ? <><Spinner /> Calculating…</> : '🧮 Calculate My Plan'}
            </button>
            <div className="action-row">
              <button className="btn btn-secondary" onClick={handleDownloadPDF}>📄 Download PDF</button>
              <button className="btn btn-secondary" onClick={downloadHistory}>📊 Export History CSV</button>
              <button className="btn btn-ghost"     onClick={clearHistory}>🗑️ Clear History</button>
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

      {/* ══════════════ TAB: RESULTS ══════════════ */}
      {activeTab === 'results' && (
        <main className="tab-content" ref={resultsRef}>
          {!results ? (
            <div className="empty-results">
              <span style={{ fontSize: 48 }}>📊</span>
              <p>No plan yet. Go to the <strong>Budget</strong> tab and tap <strong>Calculate My Plan</strong>.</p>
            </div>
          ) : (
            <>
              {/* Summary strip — visible immediately at top */}
              <div className="summary-strip">
                {[
                  { label: 'Monthly salary',  value: fmtCurrency(results.sal, currency),        color: '#2980b9' },
                  { label: `Savings (${savingsPct}%)`, value: fmtCurrency(results.adjSavings, currency), color: '#27ae60' },
                  { label: 'Debt payments',   value: fmtCurrency(results.adjDebt, currency),    color: '#e74c3c' },
                  { label: results.deficit > 0 ? 'Shortfall ⚠️' : 'Surplus',
                    value: fmtCurrency(results.deficit > 0 ? results.deficit : results.spareCash, currency),
                    color: results.deficit > 0 ? '#c0392b' : '#f39c12' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="summary-card">
                    <span className="summary-label">{label}</span>
                    <span className="summary-value" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Action plan table */}
              <section className="card" aria-labelledby="plan-hd">
                <h2 id="plan-hd">Monthly Action Plan</h2>
                <p className="section-sub">
                  Salary {fmtCurrency(results.sal, currency)} allocated as follows:
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Item</th>
                        <th style={{ textAlign: 'right' }}>Amount ({currency})</th>
                        <th>Action / Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.plan.map((item, i) => (
                        <tr
                          key={i}
                          className={
                            item.type === 'deficit'  ? 'row-danger' :
                            item.type === 'surplus'  ? 'row-success' :
                            item.type === 'savings'  ? 'row-info' : ''
                          }
                        >
                          <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{item.type}</td>
                          <td><strong>{item.label}</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {fmtCurrency(item.amount, currency)}
                          </td>
                          <td className="text-muted text-sm">{item.note}</td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr style={{ background: 'rgba(39,174,96,0.08)' }}>
                        <td colSpan={2}><strong>Total allocated</strong></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {fmtCurrency(results.adjSavings + results.adjDebt + results.adjExp, currency)}
                        </td>
                        <td className="text-muted text-sm">
                          vs salary of {fmtCurrency(results.sal, currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* AI Advice */}
              <section className="card ai-card" aria-labelledby="ai-hd">
                <h2 id="ai-hd">🤖 AI Financial Coach</h2>
                {aiStreaming && !aiAdvice && (
                  <div className="ai-loading"><Spinner /> Generating personalised advice…</div>
                )}
                {aiAdvice ? (
                  <div className="ai-advice">
                    {aiAdvice}
                    {aiStreaming && <span className="ai-cursor" aria-hidden="true">▍</span>}
                  </div>
                ) : (!aiStreaming && <p className="ai-empty">AI advice will appear here after calculating.</p>)}
              </section>

              {/* Allocation pie */}
              <section className="card chart-card" aria-labelledby="pie-hd">
                <h2 id="pie-hd">Budget Allocation</h2>
                <div className="chart-wrap">
                  <Pie
                    data={results.pieData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { padding: 16 } } },
                    }}
                  />
                </div>
              </section>

              {/* Debt comparison */}
              {results.debtChartData && results.allLoans.length > 0 && (
                <section className="card chart-card" aria-labelledby="debt-hd">
                  <h2 id="debt-hd">Debt Payoff: Snowball vs Avalanche</h2>
                  <p className="section-sub">
                    Snowball: {results.snowResult.months} months ({fmtCurrency(results.snowResult.totalInterest, currency)} interest) ·
                    Avalanche: {results.avaResult.months} months ({fmtCurrency(results.avaResult.totalInterest, currency)} interest)
                    {results.snowResult.totalInterest > results.avaResult.totalInterest
                      ? ` · Avalanche saves you ${fmtCurrency(results.snowResult.totalInterest - results.avaResult.totalInterest, currency)}`
                      : ''}
                  </p>
                  <div className="chart-wrap">
                    <Bar
                      data={results.debtChartData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                          y:  { title: { display: true, text: 'Months to payoff' } },
                          y1: { position: 'right', title: { display: true, text: `Interest (${currency})` }, grid: { drawOnChartArea: false } },
                        },
                      }}
                    />
                  </div>
                </section>
              )}

              {/* Budget adjustments */}
              {results.adjustments.some(a => a.original !== a.adjusted) && (
                <section className="card" aria-labelledby="adj-hd">
                  <h2 id="adj-hd">Expense Adjustments</h2>
                  <p className="section-sub">Items automatically adjusted to fit within your {expensesPct}% expense budget.</p>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Expense</th><th>Your Amount</th><th>Adjusted To</th><th>Reason</th></tr>
                      </thead>
                      <tbody>
                        {results.adjustments.map((a, i) => (
                          <tr key={i}>
                            <td><strong>{a.category}</strong></td>
                            <td>{fmtCurrency(a.original, currency)}</td>
                            <td className={a.adjusted < a.original ? 'text-warning' : 'text-success'}>
                              {fmtCurrency(a.adjusted, currency)}
                            </td>
                            <td className="text-muted text-sm">{a.suggestion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Emergency fund progress */}
              <section className="card" aria-labelledby="ef-hd">
                <div className="section-header">
                  <h2 id="ef-hd">Emergency Fund Progress</h2>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={addSurplusToGoal}
                    disabled={!(results.spareCash > 0)}
                  >
                    + Add surplus ({fmtCurrency(results.spareCash, currency)})
                  </button>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 14 }}>
                  <strong>{fmtCurrency(currentSavings, currency)}</strong> saved of{' '}
                  <strong>{fmtCurrency(efTarget, currency)}</strong> target
                </p>
                <ProgressBar value={currentSavings} max={efTarget} label="Overall progress" />
                <div className="sub-goals">
                  {results.subGoals.map((g, i) => (
                    <div key={i} className={`sub-goal-row${g.achieved ? ' achieved' : ''}`}>
                      <span>{g.achieved ? '✅' : '⬜'} {g.label}: {fmtCurrency(g.target, currency)}</span>
                      <div className="sub-goal-bar">
                        <div style={{ width: `${Math.min(100, (currentSavings / g.target) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Badges */}
              {badges.length > 0 && (
                <section className="card badges-card" aria-labelledby="badges-hd">
                  <h2 id="badges-hd">Achievements</h2>
                  <div className="badges-grid">
                    {badges.map((b, i) => (
                      <div key={i} className="badge-item">
                        <strong>{b.name}</strong>
                        <span>{b.desc}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      )}

      {/* ══════════════ TAB: HISTORY ══════════════ */}
      {activeTab === 'history' && (
        <main className="tab-content">
          <section className="card" aria-labelledby="hist-hd">
            <div className="section-header">
              <h2 id="hist-hd">Budget History</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={downloadHistory}>Export CSV</button>
                <button className="btn btn-ghost btn-sm" onClick={clearHistory}>Clear</button>
              </div>
            </div>
            {budgetHistory.length === 0 ? (
              <p className="empty-state">No history yet. Calculate your first budget to start tracking.</p>
            ) : (
              <>
                <div className="chart-wrap" style={{ height: 240 }}>
                  <Line
                    data={historyChartData}
                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                  />
                </div>
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th><th>Salary</th><th>Saved</th>
                        <th>Expenses</th><th>Debt Paid</th>
                        <th>Ava. Months</th><th>Household</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...budgetHistory].reverse().map((e, i) => (
                        <tr key={i}>
                          <td>{e.month}</td>
                          <td>{fmtCurrency(e.salary, currency)}</td>
                          <td className="text-success">{fmtCurrency(e.savings, currency)}</td>
                          <td>{fmtCurrency(e.totalExpenses, currency)}</td>
                          <td className="text-warning">{fmtCurrency(e.debtBudget, currency)}</td>
                          <td>{e.avaMonths}</td>
                          <td>{e.householdSize || 1}</td>
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

      {/* ══════════════ TAB: INVEST ══════════════ */}
      {activeTab === 'invest' && (
        <main className="tab-content">
          <p className="section-sub" style={{ marginBottom: 12, fontSize: 13 }}>
            Data sourced from CBK, Vasili Africa &amp; Money254 (2025). Rates are indicative — verify before investing. Not financial advice.
          </p>

          <section className="card" aria-labelledby="mmf-hd">
            <h2 id="mmf-hd">💹 Money Market Funds (MMF)</h2>
            <p className="section-sub">Liquid, low-risk. Best for emergency savings. Withdraw anytime.</p>
            <div className="invest-grid">
              {financialData.mmfs.map((m, i) => (
                <div key={i} className="invest-card invest-card-green">
                  <span className="invest-rank">#{i + 1}</span>
                  <strong>{m.name}</strong>
                  <span className="invest-rate">{m.net}%<small> yield p.a.</small></span>
                  <p className="invest-note">{m.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="sacco-hd">
            <h2 id="sacco-hd">🏦 SACCOs</h2>
            <p className="section-sub">Higher dividends; membership required. Best for long-term wealth.</p>
            <div className="invest-grid">
              {financialData.saccos.map((s, i) => (
                <div key={i} className="invest-card invest-card-blue">
                  <span className="invest-rank">#{i + 1}</span>
                  <strong>{s.name}</strong>
                  <span className="invest-rate">{s.dividend}%<small> dividend</small></span>
                  <p className="invest-note">{s.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="tbill-hd">
            <h2 id="tbill-hd">🏛️ Treasury Bills &amp; Bonds (CBK)</h2>
            <p className="section-sub">Government-backed, zero default risk. Access via CBK DhowCSD portal.</p>
            <div className="invest-grid">
              {[
                { label: '91-Day T-Bill',  rate: financialData.bonds.tBills['91-day'],  note: 'Short-term, very liquid' },
                { label: '182-Day T-Bill', rate: financialData.bonds.tBills['182-day'], note: 'Medium-term safety' },
                { label: '364-Day T-Bill', rate: financialData.bonds.tBills['364-day'], note: 'Best T-Bill rate' },
                { label: '10-Year Bond',   rate: financialData.bonds['10Y'],             note: 'Best long-term yield' },
              ].map((t, i) => (
                <div key={i} className="invest-card invest-card-amber">
                  <strong>{t.label}</strong>
                  <span className="invest-rate">{t.rate}%<small> p.a.</small></span>
                  <p className="invest-note">{t.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="dep-hd">
            <h2 id="dep-hd">🏧 Call Deposits (Kenyan Banks)</h2>
            <p className="section-sub">Fixed deposits — minimum investment applies. Higher than savings account rates.</p>
            <div className="invest-grid">
              {financialData.callDeposits.map((d, i) => (
                <div key={i} className="invest-card invest-card-purple">
                  <span className="invest-rank">#{i + 1}</span>
                  <strong>{d.name}</strong>
                  <span className="invest-rate">{d.rate}%<small> p.a.</small></span>
                  <p className="invest-note">Min: {fmtCurrency(d.minInvestment, currency)}</p>
                  <p className="invest-note">{d.note}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="app-footer">
        <p>Budget &amp; Debt Coach — Free tool for Kenyans. Not financial advice.</p>
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

/* ═══════════════════════════════════════════════════════════════
   FALLBACK AI ADVICE  (when backend is unreachable)
═══════════════════════════════════════════════════════════════ */
function buildFallbackAdvice(ctx, fd, currency) {
  const f = n => fmtCurrency(n, currency);
  const mmf   = fd?.mmfs?.[0];
  const sacco = fd?.saccos?.[0];
  const intSaving = ctx.avalanche?.interest < ctx.snowball?.interest
    ? f((ctx.snowball?.interest || 0) - (ctx.avalanche?.interest || 0))
    : null;

  return [
    `📌 Debt Strategy: Pay minimums on all debts, then direct every extra shilling to your highest-rate loan (Avalanche method).${intSaving ? ` This saves ${intSaving} vs Snowball and clears debt ${Math.abs((ctx.snowball?.months || 0) - (ctx.avalanche?.months || 0))} months faster.` : ''}`,
    '',
    `💰 Savings: Your ${f(ctx.adjSavings)}/month (${ctx.savingsPct}% of salary) should be transferred to ${mmf?.name || 'a Money Market Fund'} (${mmf?.net || 16.8}% yield) immediately on payday — before any spending. Automate this if possible.`,
    '',
    `🛡️ Emergency Fund: Target 3 months of living expenses (${f(ctx.emergencyTarget)}). You have ${f(ctx.currentSavings)} saved so far.${ctx.currentSavings >= ctx.emergencyTarget ? ' ✅ Fully funded — well done!' : ` You need ${f(ctx.emergencyTarget - ctx.currentSavings)} more.`}`,
    '',
    `🇰🇪 Kenya tip: Once debt-free, join ${sacco?.name || 'Tower Sacco'} (${sacco?.dividend || 20}% dividend). SACCOs offer 3× savings as a loan at competitive rates — a powerful wealth tool.`,
    '',
    ctx.spareCash > 0
      ? `✨ You have ${f(ctx.spareCash)} unallocated this month. Apply it to your highest-rate debt for maximum impact.`
      : `⚠️ Budget is fully committed. Avoid new credit until you have breathing room.`,
  ].join('\n');
}
