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

/* ─── Constants ─────────────────────────────────────────────── */
const KENYAN_LENDERS = [
  { name: 'M-Pesa Fuliza', type: 'Mobile Credit' },
  { name: 'KCB M-Pesa', type: 'Mobile Loan' },
  { name: 'Tala', type: 'Digital Loan' },
  { name: 'Branch', type: 'Digital Loan' },
  { name: 'M-Shwari', type: 'Mobile Savings/Loan' },
  { name: 'Hustler Fund', type: 'Gov. Credit Fund' },
  { name: 'Equity Bank', type: 'Bank Loan' },
  { name: 'KCB Bank', type: 'Bank Loan' },
  { name: 'Co-op Bank', type: 'Bank Loan' },
  { name: 'Family Bank', type: 'Bank Loan' },
  { name: 'SACCO Loan', type: 'SACCO' },
  { name: 'Employer Advance', type: 'Salary Advance' },
  { name: 'Chama Loan', type: 'Group Loan' },
  { name: 'Other', type: 'Other' },
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
  { text: 'Small amounts saved consistently will become large amounts over time.', author: 'Kenyan Proverb' },
  { text: 'Akiba haba haba, hujaza kibaba. (Save little by little, you fill the container.)', author: 'Swahili Proverb' },
];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://budget-debt-backend.onrender.com';

/* ─── Helpers ────────────────────────────────────────────────── */
const fmt = (n, cur = 'KES') =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: cur, maximumFractionDigits: 0 })
    .format(Math.round(n || 0));

const encodeState = (data) => {
  try { return btoa(encodeURIComponent(JSON.stringify(data))); }
  catch { return null; }
};

const decodeState = (str) => {
  try { return JSON.parse(decodeURIComponent(atob(str))); }
  catch { return null; }
};

/* ─── Sub-components ─────────────────────────────────────────── */
const Spinner = ({ size = 18 }) => (
  <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
);

const ProgressBar = ({ value, max, label, color = '#27ae60' }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress-wrap" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-label">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
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

/* ─── Rate limiter (client-side guard) ───────────────────────── */
const aiCallTracker = { count: 0, resetAt: Date.now() + 3600000 };
const canCallAI = () => {
  if (Date.now() > aiCallTracker.resetAt) {
    aiCallTracker.count = 0;
    aiCallTracker.resetAt = Date.now() + 3600000;
  }
  return aiCallTracker.count < 10; // max 10 AI calls/hour per session
};

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  /* ── Input state ── */
  const [salary, setSalary]             = useState('');
  const [savingsPct, setSavingsPct]     = useState(10);
  const [debtPct, setDebtPct]           = useState(20);
  const [expensesPct, setExpensesPct]   = useState(70);
  const [householdSize, setHouseholdSize] = useState(1);
  const [currency, setCurrency]         = useState('KES');
  const [loans, setLoans]               = useState([]);
  const [expenses, setExpenses]         = useState([]);
  const [emergencyTarget, setEmergencyTarget] = useState('');
  const [currentSavings, setCurrentSavings]   = useState(0);

  /* ── Output state ── */
  const [chartData, setChartData]             = useState(null);
  const [debtCompareData, setDebtCompareData] = useState(null);
  const [adjustedData, setAdjustedData]       = useState(null);
  const [planData, setPlanData]               = useState(null);
  const [displaySalary, setDisplaySalary]     = useState(0);
  const [spareCash, setSpareCash]             = useState(0);
  const [subGoals, setSubGoals]               = useState([]);
  const [budgetHistory, setBudgetHistory]     = useState([]);
  const [financialData, setFinancialData]     = useState(null);

  /* ── AI state ── */
  const [aiAdvice, setAiAdvice]     = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiAbortRef                   = useRef(null);

  /* ── UI state ── */
  const [theme, setTheme]                   = useState(() => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [isCalculating, setIsCalculating]   = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [toasts, setToasts]                 = useState([]);
  const [activeTab, setActiveTab]           = useState('budget');
  const [shareUrl, setShareUrl]             = useState('');
  const [copyDone, setCopyDone]             = useState(false);
  const [currentQuote, setCurrentQuote]     = useState(QUOTES[new Date().getDate() % QUOTES.length]);

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

  /* ── Load saved history ── */
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem('budgetHistory') || '[]');
      if (Array.isArray(h) && h.length) {
        setBudgetHistory(h);
        const latest = h[h.length - 1];
        if (latest?.currentSavings) setCurrentSavings(latest.currentSavings);
      }
    } catch { localStorage.removeItem('budgetHistory'); }
  }, []);

  useEffect(() => {
    localStorage.setItem('budgetHistory', JSON.stringify(budgetHistory));
  }, [budgetHistory]);

  /* ── Load shared state from URL ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('plan');
    if (shared) {
      const decoded = decodeState(shared);
      if (decoded) {
        if (decoded.salary)       setSalary(decoded.salary);
        if (decoded.loans)        setLoans(decoded.loans);
        if (decoded.expenses)     setExpenses(decoded.expenses);
        if (decoded.householdSize) setHouseholdSize(decoded.householdSize);
        if (decoded.currency)     setCurrency(decoded.currency);
        addToast('Shared plan loaded! Review and adjust, then Calculate.', 'success');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []); // eslint-disable-line

  /* ── Currency auto-detect ── */
  useEffect(() => {
    const map = { KE:'KES', US:'USD', GB:'GBP', DE:'EUR', FR:'EUR', IN:'INR', NG:'NGN', ZA:'ZAR' };
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setCurrency(map[d.country_code] || 'KES'))
      .catch(() => setCurrency('KES'));
  }, []);

  /* ── PWA install prompt ── */
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone || localStorage.getItem('hasSeenInstallPrompt')) return;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowInstallPrompt(true), 12000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  /* ── Service worker ── */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', () => {
            if (reg.installing?.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(err => console.warn('SW:', err));
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  }, []);

  /* ── Financial data (with stable fallback) ── */
  const loadFinancialData = useCallback(async () => {
    const CACHE_KEY = 'finDataV2';
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < 3600000) return cached.data; // 1hr cache

    const fallback = {
      saccos: [
        { name: 'Tower Sacco', dividend: 20, note: '249k+ members, consistent top dividends' },
        { name: 'Port DT Sacco', dividend: 20, note: 'Tier 1, assets KSh 10.54B' },
        { name: 'Yetu Sacco', dividend: 19, note: 'Assets grew to KSh 7.86B' },
      ],
      bonds: { '10Y': 13.13, tBills: { '91-day': 7.81, '182-day': 7.90, '364-day': 9.34 } },
      mmfs: [
        { name: 'Lofty-Corban MMF', net: 16.92, note: 'Leading performer' },
        { name: 'Etica Capital MMF', net: 16.86, note: 'Reliable growth' },
        { name: 'Cytonn MMF', net: 16.80, note: 'High yield, accessible' },
      ],
      callDeposits: [
        { name: 'Credit Bank', rate: 13.18, minInvestment: 100000, note: 'Highest savings rate' },
        { name: 'African Banking Corp', rate: 12.32, minInvestment: 50000, note: 'Competitive call' },
        { name: 'Family Bank', rate: 11.50, minInvestment: 100000, note: 'Family-focused yields' },
      ],
    };
    try {
      const res = await fetch(`${BACKEND_URL}/api/financial-data`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      return data;
    } catch {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: fallback }));
      return fallback;
    }
  }, []);

  useEffect(() => {
    loadFinancialData().then(setFinancialData);
  }, [loadFinancialData]);

  /* ── Percentage sliders: proportional rebalance ── */
  const updateSavingsPct = useCallback((v) => {
    const val = Math.min(50, Math.max(0, +v));
    setSavingsPct(val);
    const rem = 100 - val, sum = debtPct + expensesPct;
    if (sum > 0) { const d = Math.round((debtPct / sum) * rem); setDebtPct(d); setExpensesPct(100 - val - d); }
  }, [debtPct, expensesPct]);

  const updateDebtPct = useCallback((v) => {
    const val = Math.min(50, Math.max(0, +v));
    setDebtPct(val);
    const rem = 100 - val, sum = savingsPct + expensesPct;
    if (sum > 0) { const s = Math.round((savingsPct / sum) * rem); setSavingsPct(s); setExpensesPct(100 - val - s); }
  }, [savingsPct, expensesPct]);

  const updateExpensesPct = useCallback((v) => {
    const val = Math.min(100, Math.max(0, +v));
    setExpensesPct(val);
    const rem = 100 - val, sum = savingsPct + debtPct;
    if (sum > 0) { const s = Math.round((savingsPct / sum) * rem); setSavingsPct(s); setDebtPct(100 - val - s); }
  }, [savingsPct, debtPct]);

  /* ── Loans CRUD ── */
  const addLoan = useCallback(() =>
    setLoans(p => [...p, { name: '', balance: '', rate: '', minPayment: '', isEssential: false }]),
  []);

  const updateLoan = useCallback((i, field, value) =>
    setLoans(p => p.map((l, idx) => idx === i ? { ...l, [field]: value } : l)),
  []);

  const removeLoan = useCallback((i) =>
    setLoans(p => p.filter((_, idx) => idx !== i)),
  []);

  /* ── Expenses CRUD ── */
  const addExpense = useCallback(() =>
    setExpenses(p => [...p, { name: '', amount: '', isEssential: false }]),
  []);

  const updateExpense = useCallback((i, field, value) =>
    setExpenses(p => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e)),
  []);

  const removeExpense = useCallback((i) =>
    setExpenses(p => p.filter((_, idx) => idx !== i)),
  []);

  /* ── Debt simulation (snowball / avalanche) ── */
  const simulate = useCallback((loansArr, extra, sorter) => {
    const cloned = loansArr.map(l => ({ ...l, balance: +l.balance || 0, rate: +l.rate || 0, minPayment: +l.minPayment || 0 }));
    let months = 0, totalInterest = 0;
    while (cloned.some(l => l.balance > 0) && months < 600) {
      cloned.forEach(l => {
        if (l.balance <= 0) return;
        const interest = l.balance * (l.rate / 100 / 12);
        l.balance += interest;
        totalInterest += interest;
        l.balance = Math.max(0, l.balance - Math.min(l.minPayment, l.balance));
      });
      const active = cloned.filter(l => l.balance > 0).sort(sorter);
      if (active.length && extra > 0) {
        const tgt = active[0];
        tgt.balance = Math.max(0, tgt.balance - Math.min(extra, tgt.balance));
      }
      months++;
    }
    return { months, totalInterest: Math.round(totalInterest) };
  }, []);

  const snowball  = useCallback((l, e) => simulate(l, e, (a, b) => a.balance - b.balance), [simulate]);
  const avalanche = useCallback((l, e) => simulate(l, e, (a, b) => b.rate - a.rate), [simulate]);

  /* ── Stream AI advice via SSE ── */
  const streamAIAdvice = useCallback(async (contextPayload) => {
    if (!canCallAI()) {
      addToast('AI advice limit reached (10/hr). Please try again later.', 'warning');
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

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const text = line.slice(6);
            if (text === '[DONE]') break;
            setAiAdvice(prev => prev + text);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fallback: generate advice client-side from context
        const finData = financialData;
        const fallbackAdvice = buildFallbackAdvice(contextPayload, finData, currency);
        setAiAdvice(fallbackAdvice);
      }
    } finally {
      setAiStreaming(false);
    }
  }, [addToast, currency, financialData]);

  /* ── Main calculate handler ── */
  const handleCalculate = useCallback(async () => {
    const sal = parseFloat(salary);
    if (!sal || sal <= 0) { addToast('Please enter a valid monthly salary.', 'error'); return; }
    if (savingsPct + debtPct + expensesPct !== 100) {
      addToast('Savings + Debt + Expenses must equal 100%.', 'error'); return;
    }
    setIsCalculating(true);
    setAiAdvice('');

    try {
      const finData = await loadFinancialData();
      setFinancialData(finData);
      const hs = Math.max(1, +householdSize || 1);

      // Raw allocations
      let adjSavings   = sal * (savingsPct / 100);
      let adjDebt      = sal * (debtPct / 100);
      let adjExpenses  = sal * (expensesPct / 100);

      const totalMinPay   = loans.reduce((s, l) => s + (+l.minPayment || 0), 0);
      const totalExpenses = expenses.reduce((s, e) => s + (+e.amount || 0), 0);

      // Budget pressure resolution
      const expAdjMap = new Map();
      const minEssPerPerson    = (adjExpenses * 0.4) / hs;
      const minNonEssPerPerson = (adjExpenses * 0.1) / hs;
      let adjTotalExp = totalExpenses;
      let adjTotalMin = totalMinPay;

      const hhFactor = (name) => {
        const n = (name || '').toLowerCase();
        if (/food|shopping|groceries|milk|transport|matatu/.test(n)) return hs;
        if (/kplc|wifi|internet|water|utility/.test(n)) return Math.sqrt(hs);
        return 1 + (hs - 1) * 0.2;
      };

      for (let iter = 0; iter < 5; iter++) {
        const outgo = adjTotalMin + adjTotalExp + adjSavings;
        const deficit = outgo - sal;
        if (deficit <= 0) break;

        // 1) trim non-essential expenses
        expenses.filter(e => !e.isEssential).forEach((e, i) => {
          const key = `${i}`;
          const cur = expAdjMap.get(key) ?? (+e.amount || 0);
          const min = minNonEssPerPerson * hhFactor(e.name);
          const cut = Math.min((cur - min) * 0.3, deficit);
          if (cut > 0) { expAdjMap.set(key, cur - cut); adjTotalExp -= cut; }
        });

        // 2) trim savings (floor 3%)
        const savFloor = sal * 0.03;
        if (adjSavings > savFloor) {
          const cut = Math.min(adjSavings - savFloor, sal - adjTotalMin - adjTotalExp - savFloor);
          adjSavings = Math.max(savFloor, adjSavings - cut);
        }
      }

      const spareCashAmt = Math.max(0, sal - adjTotalMin - adjTotalExp - adjSavings);

      // Debt comparison
      const { months: snowM, totalInterest: snowI } = snowball(loans, adjDebt);
      const { months: avaM, totalInterest: avaI }   = avalanche(loans, adjDebt);

      // Emergency fund
      const monthlyNeeds = Math.max(adjTotalExp, (minEssPerPerson * hs * 3));
      const efTarget = Math.max(+(emergencyTarget) || 0, monthlyNeeds * 3 * (1 + (hs - 1) * 0.1));

      // Build adjustment summary
      const adjustments = [];
      expenses.forEach((e, i) => {
        const orig = +e.amount || 0;
        const adj  = expAdjMap.get(`${i}`) ?? orig;
        if (Math.abs(adj - orig) > 0.5) {
          adjustments.push({
            category: e.name || `Expense ${i + 1}`,
            current: orig,
            adjusted: adj,
            suggestion: `Trimmed by ${fmt(orig - adj, currency)} to fit your ${expensesPct}% expenses budget.`,
          });
        }
      });
      adjustments.push({
        category: 'Savings',
        current: sal * (savingsPct / 100),
        adjusted: adjSavings,
        suggestion: `${fmt(adjSavings, currency)}/mo allocated. Target MMF or SACCO for best yields.`,
      });
      adjustments.push({
        category: 'Total Debt Payments',
        current: totalMinPay,
        adjusted: adjTotalMin,
        suggestion: 'Always pay minimums on time to protect your credit score.',
      });
      adjustments.push({
        category: 'Total Expenses',
        current: totalExpenses,
        adjusted: adjTotalExp,
        suggestion: `Adjusted to fit within ${fmt(adjExpenses, currency)} (${expensesPct}% of salary).`,
      });
      adjustments.push({
        category: 'Surplus / Spare Cash',
        current: 0,
        adjusted: spareCashAmt,
        suggestion: spareCashAmt > 0
          ? `Extra ${fmt(spareCashAmt, currency)} – apply to highest-rate debt first.`
          : 'Tight budget – look for additional income streams.',
      });
      setAdjustedData(adjustments);
      setSpareCash(spareCashAmt);

      // Build monthly plan
      const plan = [];
      [...loans]
        .sort((a, b) => (+b.rate || 0) - (+a.rate || 0))
        .forEach((l, i) => {
          const minP = +l.minPayment || 0;
          const extra = i === 0 ? Math.max(0, adjDebt - adjTotalMin) : 0;
          const total = Math.min(minP + extra, +l.balance || minP);
          plan.push({
            category: 'Loan',
            subcategory: l.name || `Loan ${i + 1}`,
            priority: i + 1,
            budgeted: total,
            notes: extra > 0
              ? `Minimum ${fmt(minP, currency)} + ${fmt(extra, currency)} extra. Avalanche: highest rate first saves most interest.`
              : `Pay minimum ${fmt(minP, currency)}. Clear higher-rate debts first.`,
          });
        });

      expenses.forEach((e, i) => {
        const adj = expAdjMap.get(`${i}`) ?? (+e.amount || 0);
        plan.push({
          category: 'Expense',
          subcategory: e.name || `Expense ${i + 1}`,
          priority: e.isEssential ? 'Essential' : 'Non-essential',
          budgeted: adj,
          notes: e.isEssential
            ? `Core need – protect this allocation.`
            : `Monitor weekly; cut if spare cash is needed for debt.`,
        });
      });

      const mmfName  = finData.mmfs[0]?.name  || 'Cytonn MMF';
      const mmfYield = finData.mmfs[0]?.net   || 16.8;
      plan.push({
        category: 'Savings',
        subcategory: 'Emergency / Investments',
        priority: 'N/A',
        budgeted: adjSavings,
        notes: `Transfer to ${mmfName} (${mmfYield}% yield) immediately on payday.`,
      });

      const totalPlanned = adjTotalMin + adjTotalExp + adjSavings;
      const finalDiff    = totalPlanned - sal;
      if (finalDiff > 0) {
        plan.push({
          category: 'Deficit',
          subcategory: 'Shortfall',
          priority: 'Action Required',
          budgeted: finalDiff,
          notes: `Monthly shortfall of ${fmt(finalDiff, currency)}. Consider freelancing, overtime, or selling unused items.`,
        });
      } else {
        plan.push({
          category: 'Surplus',
          subcategory: 'Available Cash',
          priority: 'Invest',
          budgeted: Math.max(0, sal - totalPlanned),
          notes: `Put surplus into debt extra payments, then SACCO or T-Bill.`,
        });
      }
      setPlanData(plan);

      // Sub-goals
      const mgBuffer = monthlyNeeds;
      setSubGoals([
        { target: mgBuffer,     label: '1-Month Buffer' },
        { target: mgBuffer * 3, label: '3-Month Emergency' },
        { target: mgBuffer * 6, label: '6-Month Safety Net' },
      ].map(g => ({ ...g, achieved: currentSavings >= g.target })));

      // Charts
      const pieColors = ['#27ae60', '#e74c3c', '#2980b9', '#f39c12'];
      setChartData({
        labels: ['Savings', 'Debt', 'Expenses', ...(spareCashAmt > 0 ? ['Spare'] : [])],
        datasets: [{
          data: [adjSavings, adjTotalMin, adjTotalExp, ...(spareCashAmt > 0 ? [spareCashAmt] : [])],
          backgroundColor: pieColors,
          borderWidth: 2,
        }],
      });

      setDebtCompareData({
        labels: ['Snowball', 'Avalanche'],
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

      // History
      const updatedSavings = currentSavings + adjSavings;
      setCurrentSavings(updatedSavings);
      setEmergencyTarget(efTarget.toString());
      setBudgetHistory(prev => [
        ...prev,
        {
          month: new Date().toISOString().slice(0, 7),
          salary: sal, savings: adjSavings, debtBudget: adjDebt,
          expensesBudget: adjTotalExp, totalExpenses: adjTotalExp,
          snowMonths: snowM, snowInterest: snowI, avaMonths: avaM, avaInterest: avaI,
          emergencyTarget: efTarget, currentSavings: updatedSavings,
          householdSize: hs,
        },
      ]);

      setDisplaySalary(sal);
      setSalary('');
      setLoans([]);
      setExpenses([]);
      setActiveTab('results');

      // Generate shareable URL
      const sharedState = { salary: sal, loans, expenses, householdSize: hs, currency };
      const encoded = encodeState(sharedState);
      if (encoded) setShareUrl(`${window.location.origin}${window.location.pathname}?plan=${encoded}`);

      // Stream AI advice
      await streamAIAdvice({
        salary: sal, currency, householdSize: hs,
        savingsPct, debtPct, expensesPct,
        totalLoans: loans.length,
        totalMinPayments: adjTotalMin,
        totalExpenses: adjTotalExp,
        adjSavings, spareCash: spareCashAmt,
        snowball: { months: snowM, interest: snowI },
        avalanche: { months: avaM, interest: avaI },
        emergencyTarget: efTarget,
        currentSavings: updatedSavings,
        mmf: finData.mmfs[0],
        sacco: finData.saccos[0],
      });

      addToast('Budget calculated! Scroll down for your plan.', 'success');
    } catch (err) {
      console.error(err);
      addToast(`Calculation error: ${err.message}`, 'error');
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
    if (!shareUrl) { addToast('Calculate a plan first to share.', 'info'); return; }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
      addToast('Plan link copied to clipboard!', 'success');
    } catch {
      addToast('Could not copy. Tap the URL to copy manually.', 'warning');
    }
  }, [shareUrl, addToast]);

  /* ── Add surplus to savings goal ── */
  const addSurplusToGoal = useCallback(() => {
    if (spareCash > 0) {
      setCurrentSavings(p => p + spareCash);
      addToast(`${fmt(spareCash, currency)} added to your savings goal!`, 'success');
    }
  }, [spareCash, currency, addToast]);

  /* ── PDF Download (enhanced) ── */
  const handleDownloadPDF = useCallback(() => {
    if (!planData || !displaySalary) {
      addToast('Calculate a plan first before downloading.', 'warning');
      return;
    }
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.width;
      let y = 15;

      const addLine = (text, size = 10, bold = false) => {
        if (y > 275) { doc.addPage(); y = 15; }
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        const lines = doc.splitTextToSize(String(text), pageW - 20);
        doc.text(lines, 10, y);
        y += lines.length * (size * 0.45) + 2;
      };

      const divider = () => {
        doc.setDrawColor(200);
        doc.line(10, y, pageW - 10, y);
        y += 4;
      };

      // Header
      addLine('Budget & Debt Coach — Monthly Report', 16, true);
      addLine(`Generated: ${new Date().toLocaleDateString('en-KE')} | Household: ${householdSize}`, 9);
      divider();

      // Summary
      addLine('Summary', 12, true);
      addLine(`Monthly Salary: ${fmt(displaySalary, currency)}`);
      addLine(`Savings: ${fmt(adjustedData?.find(a=>a.category==='Savings')?.adjusted||0, currency)} | Debt: ${fmt(adjustedData?.find(a=>a.category==='Total Debt Payments')?.adjusted||0, currency)} | Expenses: ${fmt(adjustedData?.find(a=>a.category==='Total Expenses')?.adjusted||0, currency)}`);
      divider();

      // Debt strategy
      const finD = financialData;
      if (finD) {
        addLine('Debt Payoff Strategies', 12, true);
        const { months: sM, totalInterest: sI } = snowball(loans.length ? loans : [], 0);
        const { months: aM, totalInterest: aI } = avalanche(loans.length ? loans : [], 0);
        addLine(`Snowball Method: ${sM} months, Interest: ${fmt(sI, currency)}`);
        addLine(`Avalanche Method: ${aM} months, Interest: ${fmt(aI, currency)}`);
        addLine(`Recommendation: Use Avalanche to save ${fmt(sI - aI, currency)} in interest.`);
        divider();

        // Investment options
        addLine('Investment Opportunities (Kenya)', 12, true);
        addLine(`Top MMF: ${finD.mmfs[0]?.name} — ${finD.mmfs[0]?.net}% yield`);
        addLine(`Top SACCO: ${finD.saccos[0]?.name} — ${finD.saccos[0]?.dividend}% dividend`);
        addLine(`Treasury Bonds (10Y): ${finD.bonds['10Y']}%`);
        addLine(`T-Bill 364-day: ${finD.bonds.tBills['364-day']}%`);
        divider();

        // 5-year projection
        const mmfYield = finD.mmfs[0]?.net || 16.8;
        const adjS = adjustedData?.find(a=>a.category==='Savings')?.adjusted || 0;
        const mr = (mmfYield / 100) / 12;
        const fv = adjS * ((Math.pow(1 + mr, 60) - 1) / mr);
        addLine('5-Year Savings Projection', 12, true);
        addLine(`Investing ${fmt(adjS, currency)}/mo at ${mmfYield}% = ${fmt(fv, currency)} after 5 years`);
        divider();
      }

      // Monthly plan
      addLine('Monthly Action Plan', 12, true);
      planData.slice(0, 12).forEach(item => {
        addLine(`[${item.category}] ${item.subcategory}: ${fmt(item.budgeted, currency)}`, 10, true);
        addLine(`  ${item.notes}`, 9);
      });
      divider();

      // AI advice
      if (aiAdvice) {
        addLine('AI Financial Coach Advice', 12, true);
        addLine(aiAdvice, 9);
      }

      doc.save(`budget_report_${new Date().toISOString().slice(0,7)}.pdf`);
      addToast('PDF downloaded!', 'success');
    } catch (err) {
      console.error(err);
      addToast('PDF generation failed.', 'error');
    }
  }, [planData, displaySalary, adjustedData, householdSize, currency, financialData, snowball, avalanche, loans, aiAdvice, addToast]);

  /* ── CSV download ── */
  const downloadHistory = useCallback(() => {
    if (!budgetHistory.length) { addToast('No history to download yet.', 'info'); return; }
    const headers = 'Month,Salary,Savings,Debt Budget,Expenses,Snowball Months,Interest,Avalanche Months,Interest,Emergency Target,Savings Balance,Household\n';
    const rows = budgetHistory.map(e =>
      `${e.month},${e.salary},${e.savings},${e.debtBudget},${e.totalExpenses},${e.snowMonths},${e.snowInterest},${e.avaMonths},${e.avaInterest},${e.emergencyTarget},${e.currentSavings},${e.householdSize||1}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'budget_history.csv' });
    a.click();
    URL.revokeObjectURL(a.href);
    addToast('CSV downloaded!', 'success');
  }, [budgetHistory, addToast]);

  const clearHistory = useCallback(() => {
    if (!window.confirm('Clear all budget history? This cannot be undone.')) return;
    setBudgetHistory([]); setCurrentSavings(0); setSubGoals([]);
    localStorage.removeItem('budgetHistory');
    addToast('History cleared.', 'info');
  }, [addToast]);

  /* ── Badges ── */
  const badges = useMemo(() => {
    const list = [];
    const streak = budgetHistory.filter(h => h.savings / h.salary >= 0.1).length;
    if (streak >= 3) list.push({ name: '🏦 Purse Fattener', desc: '3+ months saving 10%' });
    if (streak >= 6) list.push({ name: '💪 Wealth Builder', desc: '6+ months saving consistently' });
    const latest = budgetHistory[budgetHistory.length - 1];
    if (latest?.avaMonths <= 12) list.push({ name: '⚡ Debt Slayer', desc: 'Debt payoff under 1 year' });
    if (latest?.currentSavings >= latest?.emergencyTarget) list.push({ name: '🛡️ Emergency Ready', desc: 'Emergency fund fully funded!' });
    return list;
  }, [budgetHistory]);

  /* ── History chart data ── */
  const historyChartData = useMemo(() => ({
    labels: budgetHistory.map(e => e.month),
    datasets: [
      { label: 'Savings', data: budgetHistory.map(e => e.savings), borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.15)', tension: 0.3 },
      { label: 'Expenses', data: budgetHistory.map(e => e.totalExpenses), borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.15)', tension: 0.3 },
    ],
  }), [budgetHistory]);

  /* ── Emergency fund state ── */
  const efTarget = parseFloat(emergencyTarget) || 0;

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="app" data-theme={theme}>

      {/* Toast stack */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => setToasts(p => p.filter(x => x.id !== t.id))} />
        ))}
      </div>

      {/* PWA install prompt */}
      {showInstallPrompt && (
        <div className="pwa-banner">
          <span>📱 Install Budget & Debt Coach — works offline!</span>
          <div>
            <button className="btn btn-primary btn-sm" onClick={() => { deferredPrompt?.prompt(); setShowInstallPrompt(false); localStorage.setItem('hasSeenInstallPrompt','true'); }}>Install</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowInstallPrompt(false); localStorage.setItem('hasSeenInstallPrompt','true'); }}>Later</button>
          </div>
        </div>
      )}

      {/* SW update banner */}
      {updateAvailable && (
        <div className="update-banner">
          <span>🆕 New version available!</span>
          <button className="btn btn-primary btn-sm" onClick={() => { navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' }); setUpdateAvailable(false); }}>Update now</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setUpdateAvailable(false)}>Later</button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">💰</span>
          <div>
            <h1>Budget & Debt Coach</h1>
            <p>Plan. Save. Recover.</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Quote */}
      <div className="quote-bar">
        <span className="quote-mark">"</span>
        <em>{currentQuote.text}</em>
        <span className="quote-author">— {currentQuote.author}</span>
      </div>

      {/* ── Tabs ── */}
      <nav className="tabs" role="tablist">
        {[['budget','📊 Budget'], ['results','📈 Results'], ['history','🗓️ History'], ['invest','💼 Invest']].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`tab ${activeTab === id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ═══════════════ TAB: BUDGET ═══════════════ */}
      {activeTab === 'budget' && (
        <main className="tab-content">

          {/* Budget settings */}
          <section className="card" aria-labelledby="settings-title">
            <h2 id="settings-title">Budget Settings</h2>

            <div className="form-row">
              <label className="form-label">
                Monthly salary ({currency})
                <input
                  type="number"
                  className="input"
                  value={salary}
                  onChange={e => setSalary(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="e.g. 85000"
                  min="0"
                />
              </label>

              <label className="form-label">
                Household size
                <input
                  type="number"
                  className="input"
                  style={{ width: 90 }}
                  value={householdSize}
                  onChange={e => setHouseholdSize(e.target.value)}
                  min="1"
                  max="20"
                />
              </label>

              <label className="form-label">
                Currency
                <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {['KES','USD','EUR','GBP','INR','NGN','ZAR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <div className="slider-section">
              <p className="slider-total" style={{ color: savingsPct + debtPct + expensesPct === 100 ? '#27ae60' : '#e74c3c' }}>
                Allocation total: {savingsPct + debtPct + expensesPct}% {savingsPct + debtPct + expensesPct === 100 ? '✓' : '(must equal 100%)'}
              </p>

              {[
                { label: 'Savings', pct: savingsPct, update: updateSavingsPct, color: '#27ae60', tip: 'Aim for at least 10%' },
                { label: 'Debt repayment', pct: debtPct, update: updateDebtPct, color: '#e74c3c', tip: 'Recommended ≤ 20%' },
                { label: 'Expenses', pct: expensesPct, update: updateExpensesPct, color: '#2980b9', tip: 'Target ≤ 70%' },
              ].map(({ label, pct, update, color, tip }) => (
                <div key={label} className="slider-row">
                  <div className="slider-row-header">
                    <span>{label}</span>
                    <span className="slider-val" style={{ color }}>{pct}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="1"
                    value={pct}
                    onChange={e => update(e.target.value)}
                    className="slider"
                    style={{ accentColor: color }}
                    aria-label={`${label} percentage`}
                  />
                  <span className="slider-tip">{tip}</span>
                </div>
              ))}
            </div>

            <label className="form-label" style={{ marginTop: 8 }}>
              Emergency fund target ({currency})
              <input
                type="number"
                className="input"
                value={emergencyTarget}
                onChange={e => setEmergencyTarget(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="Leave blank to auto-calculate"
              />
            </label>
          </section>

          {/* Loans */}
          <section className="card" aria-labelledby="loans-title">
            <div className="section-header">
              <h2 id="loans-title">Loans & Debts</h2>
              <button className="btn btn-secondary btn-sm" onClick={addLoan}>+ Add loan</button>
            </div>

            {loans.length === 0 && (
              <p className="empty-state">No loans added. Tap "Add loan" to track your debts.</p>
            )}

            <div className="card-grid">
              {loans.map((loan, i) => (
                <div key={i} className="item-card">
                  <div className="item-card-header">
                    <span className="item-card-num">Loan {i + 1}</span>
                    <button className="btn-remove" onClick={() => removeLoan(i)} aria-label={`Remove loan ${i+1}`}>×</button>
                  </div>

                  <label className="form-label">
                    Lender / name
                    <input
                      list={`lenders-${i}`}
                      className="input"
                      value={loan.name}
                      onChange={e => updateLoan(i, 'name', e.target.value)}
                      placeholder="e.g. Tala, Fuliza…"
                    />
                    <datalist id={`lenders-${i}`}>
                      {KENYAN_LENDERS.map(l => <option key={l.name} value={l.name}>{l.type}</option>)}
                    </datalist>
                  </label>

                  <div className="form-row-compact">
                    <label className="form-label">
                      Balance ({currency})
                      <input type="number" className="input" value={loan.balance} onChange={e => updateLoan(i,'balance',e.target.value)} onFocus={e=>e.target.select()} min="0" />
                    </label>
                    <label className="form-label">
                      Rate (% p.a.)
                      <input type="number" className="input" step="0.1" value={loan.rate} onChange={e => updateLoan(i,'rate',e.target.value)} onFocus={e=>e.target.select()} min="0" />
                    </label>
                    <label className="form-label">
                      Min. payment
                      <input type="number" className="input" value={loan.minPayment} onChange={e => updateLoan(i,'minPayment',e.target.value)} onFocus={e=>e.target.select()} min="0" />
                    </label>
                  </div>

                  <label className="checkbox-label">
                    <input type="checkbox" checked={loan.isEssential||false} onChange={() => updateLoan(i,'isEssential',!loan.isEssential)} />
                    Mark as essential (cannot defer)
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Expenses */}
          <section className="card" aria-labelledby="expenses-title">
            <div className="section-header">
              <h2 id="expenses-title">Monthly Expenses</h2>
              <button className="btn btn-secondary btn-sm" onClick={addExpense}>+ Add expense</button>
            </div>

            {expenses.length === 0 && (
              <p className="empty-state">No expenses added. Tap "Add expense" to track where your money goes.</p>
            )}

            <div className="card-grid">
              {expenses.map((exp, i) => (
                <div key={i} className="item-card">
                  <div className="item-card-header">
                    <span className="item-card-num">Expense {i + 1}</span>
                    <button className="btn-remove" onClick={() => removeExpense(i)} aria-label={`Remove expense ${i+1}`}>×</button>
                  </div>

                  <label className="form-label">
                    Description
                    <input
                      list={`exp-presets-${i}`}
                      className="input"
                      value={exp.name}
                      onChange={e => updateExpense(i,'name',e.target.value)}
                      placeholder="e.g. Rent, Food…"
                    />
                    <datalist id={`exp-presets-${i}`}>
                      {EXPENSE_PRESETS.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </label>

                  <div className="form-row-compact">
                    <label className="form-label">
                      Amount ({currency})
                      <input type="number" className="input" value={exp.amount} onChange={e => updateExpense(i,'amount',e.target.value)} onFocus={e=>e.target.select()} min="0" />
                    </label>
                  </div>

                  <label className="checkbox-label">
                    <input type="checkbox" checked={exp.isEssential||false} onChange={() => updateExpense(i,'isEssential',!exp.isEssential)} />
                    Essential expense
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
              {isCalculating ? <><Spinner /> Calculating…</> : '🧮 Calculate & Generate Plan'}
            </button>

            <div className="action-row">
              <button className="btn btn-secondary" onClick={handleDownloadPDF}>📄 Download PDF</button>
              <button className="btn btn-secondary" onClick={downloadHistory}>📊 Export CSV</button>
              <button className="btn btn-ghost" onClick={clearHistory}>🗑️ Clear history</button>
            </div>

            {shareUrl && (
              <div className="share-box">
                <span className="share-label">Share your plan:</span>
                <input className="input share-input" value={shareUrl} readOnly onClick={e => e.target.select()} />
                <button className="btn btn-secondary btn-sm" onClick={handleShare}>
                  {copyDone ? '✓ Copied!' : '📋 Copy link'}
                </button>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ═══════════════ TAB: RESULTS ═══════════════ */}
      {activeTab === 'results' && (
        <main className="tab-content">
          {!planData ? (
            <div className="empty-results">
              <span style={{ fontSize: 48 }}>📊</span>
              <p>No plan yet. Go to the Budget tab and tap <strong>Calculate</strong>.</p>
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="summary-strip">
                {[
                  { label: 'Monthly salary', value: fmt(displaySalary, currency), color: '#2980b9' },
                  { label: 'Savings', value: fmt(adjustedData?.find(a=>a.category==='Savings')?.adjusted||0, currency), color: '#27ae60' },
                  { label: 'Debt payments', value: fmt(adjustedData?.find(a=>a.category==='Total Debt Payments')?.adjusted||0, currency), color: '#e74c3c' },
                  { label: 'Spare cash', value: fmt(spareCash, currency), color: '#f39c12' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="summary-card">
                    <span className="summary-label">{label}</span>
                    <span className="summary-value" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* AI Advice */}
              <section className="card ai-card" aria-labelledby="ai-title">
                <h2 id="ai-title">🤖 AI Financial Coach</h2>
                {aiStreaming && !aiAdvice && (
                  <div className="ai-loading">
                    <Spinner /> <span>Analysing your finances…</span>
                  </div>
                )}
                {aiAdvice ? (
                  <div className="ai-advice">
                    {aiAdvice}
                    {aiStreaming && <span className="ai-cursor" aria-hidden="true">▍</span>}
                  </div>
                ) : !aiStreaming ? (
                  <p className="ai-empty">AI advice will appear here after you calculate.</p>
                ) : null}
              </section>

              {/* Allocation pie */}
              {chartData && (
                <section className="card chart-card" aria-labelledby="alloc-title">
                  <h2 id="alloc-title">Monthly Allocation</h2>
                  <div className="chart-wrap">
                    <Pie data={chartData} options={{ plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }} />
                  </div>
                </section>
              )}

              {/* Debt comparison bar */}
              {debtCompareData && loans.length > 0 && (
                <section className="card chart-card" aria-labelledby="debt-comp-title">
                  <h2 id="debt-comp-title">Snowball vs Avalanche</h2>
                  <p className="chart-sub">Avalanche (highest rate first) typically saves the most interest.</p>
                  <div className="chart-wrap">
                    <Bar
                      data={debtCompareData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                          y:  { title: { display: true, text: 'Months' } },
                          y1: { position: 'right', title: { display: true, text: `Interest (${currency})` }, grid: { drawOnChartArea: false } },
                        },
                      }}
                    />
                  </div>
                </section>
              )}

              {/* Adjustment table */}
              {adjustedData && (
                <section className="card" aria-labelledby="adj-title">
                  <h2 id="adj-title">Budget Adjustments</h2>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Category</th><th>Original</th><th>Adjusted</th><th>Note</th></tr>
                      </thead>
                      <tbody>
                        {adjustedData.map((a, i) => (
                          <tr key={i}>
                            <td><strong>{a.category}</strong></td>
                            <td>{fmt(a.current, currency)}</td>
                            <td className={a.adjusted < a.current ? 'text-warning' : 'text-success'}>{fmt(a.adjusted, currency)}</td>
                            <td className="text-muted">{a.suggestion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Monthly plan */}
              {planData && (
                <section className="card" aria-labelledby="plan-title">
                  <h2 id="plan-title">Monthly Action Plan</h2>
                  <p className="section-sub">Total planned: <strong>{fmt((adjustedData?.find(a=>a.category==='Savings')?.adjusted||0) + (adjustedData?.find(a=>a.category==='Total Debt Payments')?.adjusted||0) + (adjustedData?.find(a=>a.category==='Total Expenses')?.adjusted||0), currency)}</strong> vs salary <strong>{fmt(displaySalary, currency)}</strong></p>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Type</th><th>Item</th><th>Priority</th><th>Amount</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {planData.map((item, i) => (
                          <tr
                            key={i}
                            className={
                              item.category === 'Deficit'  ? 'row-danger' :
                              item.category === 'Surplus'  ? 'row-success' :
                              item.category === 'Savings'  ? 'row-info' : ''
                            }
                          >
                            <td>{item.category}</td>
                            <td><strong>{item.subcategory}</strong></td>
                            <td>{item.priority}</td>
                            <td>{fmt(item.budgeted, currency)}</td>
                            <td className="text-muted text-sm">{item.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Emergency fund progress */}
              <section className="card" aria-labelledby="ef-title">
                <div className="section-header">
                  <h2 id="ef-title">Emergency Fund</h2>
                  <button className="btn btn-secondary btn-sm" onClick={addSurplusToGoal} disabled={!spareCash}>
                    + Add surplus
                  </button>
                </div>
                <p>{fmt(currentSavings, currency)} saved of {fmt(efTarget, currency)} target</p>
                <ProgressBar value={currentSavings} max={efTarget} label="Overall progress" color="#27ae60" />
                <div className="sub-goals">
                  {subGoals.map((g, i) => (
                    <div key={i} className={`sub-goal-row ${g.achieved ? 'achieved' : ''}`}>
                      {g.achieved ? '✅' : '⬜'} {g.label}: {fmt(g.target, currency)}
                      <div className="sub-goal-bar">
                        <div style={{ width: `${Math.min(100, (currentSavings / g.target) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Badges */}
              {badges.length > 0 && (
                <section className="card badges-card" aria-labelledby="badges-title">
                  <h2 id="badges-title">Achievements</h2>
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

      {/* ═══════════════ TAB: HISTORY ═══════════════ */}
      {activeTab === 'history' && (
        <main className="tab-content">
          <section className="card" aria-labelledby="history-title">
            <div className="section-header">
              <h2 id="history-title">Budget History</h2>
              <div>
                <button className="btn btn-secondary btn-sm" onClick={downloadHistory}>Export CSV</button>
                <button className="btn btn-ghost btn-sm" onClick={clearHistory}>Clear</button>
              </div>
            </div>

            {budgetHistory.length === 0 ? (
              <p className="empty-state">No history yet. Calculate your first budget to start tracking.</p>
            ) : (
              <>
                <div className="chart-wrap" style={{ height: 240 }}>
                  <Line data={historyChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                </div>
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Month</th><th>Salary</th><th>Saved</th><th>Expenses</th><th>Debt pmt</th><th>Household</th></tr>
                    </thead>
                    <tbody>
                      {[...budgetHistory].reverse().map((e, i) => (
                        <tr key={i}>
                          <td>{e.month}</td>
                          <td>{fmt(e.salary, currency)}</td>
                          <td className="text-success">{fmt(e.savings, currency)}</td>
                          <td>{fmt(e.totalExpenses, currency)}</td>
                          <td className="text-warning">{fmt(e.debtBudget, currency)}</td>
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

      {/* ═══════════════ TAB: INVEST ═══════════════ */}
      {activeTab === 'invest' && (
        <main className="tab-content">
          {!financialData ? (
            <div className="empty-results"><Spinner size={32} /><p>Loading Kenyan market data…</p></div>
          ) : (
            <>
              <section className="card" aria-labelledby="mmf-title">
                <h2 id="mmf-title">💹 Money Market Funds (MMF)</h2>
                <p className="section-sub">Liquid, low-risk. Best for emergency fund & short-term savings.</p>
                <div className="invest-grid">
                  {financialData.mmfs.map((m, i) => (
                    <div key={i} className="invest-card invest-card-green">
                      <span className="invest-rank">#{i + 1}</span>
                      <strong>{m.name}</strong>
                      <span className="invest-rate">{m.net}% <small>yield p.a.</small></span>
                      <p className="invest-note">{m.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card" aria-labelledby="sacco-title">
                <h2 id="sacco-title">🏦 SACCOs</h2>
                <p className="section-sub">Higher dividends; membership required. Good for long-term wealth building.</p>
                <div className="invest-grid">
                  {financialData.saccos.map((s, i) => (
                    <div key={i} className="invest-card invest-card-blue">
                      <span className="invest-rank">#{i + 1}</span>
                      <strong>{s.name}</strong>
                      <span className="invest-rate">{s.dividend}% <small>dividend</small></span>
                      <p className="invest-note">{s.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card" aria-labelledby="tbill-title">
                <h2 id="tbill-title">🏛️ Treasury Bills & Bonds</h2>
                <p className="section-sub">Government-backed, zero default risk. Available via CBK DhowCSD.</p>
                <div className="invest-grid">
                  {[
                    { label: '91-Day T-Bill', rate: financialData.bonds.tBills['91-day'], note: 'Short-term, very liquid' },
                    { label: '182-Day T-Bill', rate: financialData.bonds.tBills['182-day'], note: 'Medium-term safety' },
                    { label: '364-Day T-Bill', rate: financialData.bonds.tBills['364-day'], note: 'Best T-Bill rate' },
                    { label: '10-Year Bond', rate: financialData.bonds['10Y'], note: 'Long-term, best yield' },
                  ].map((t, i) => (
                    <div key={i} className="invest-card invest-card-amber">
                      <strong>{t.label}</strong>
                      <span className="invest-rate">{t.rate}% <small>p.a.</small></span>
                      <p className="invest-note">{t.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card" aria-labelledby="deposit-title">
                <h2 id="deposit-title">🏧 Call Deposits</h2>
                <p className="section-sub">Fixed deposits at Kenyan banks. Minimum investment applies.</p>
                <div className="invest-grid">
                  {financialData.callDeposits.map((d, i) => (
                    <div key={i} className="invest-card invest-card-purple">
                      <span className="invest-rank">#{i + 1}</span>
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
        <p>Budget & Debt Coach — Free tool for Kenyans. Not financial advice.</p>
        <div className="footer-links">
          <a href="https://x.com/B_D_coach_app" target="_blank" rel="noopener noreferrer" aria-label="Follow on X">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93z"/></svg>
          </a>
          <a href="https://wa.me/254783621541" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ─── Fallback AI advice builder (when backend unavailable) ─── */
function buildFallbackAdvice(ctx, finData, currency) {
  const mmf  = finData?.mmfs[0];
  const sacco = finData?.saccos[0];
  const fmt  = (n) => new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);
  const strategy = ctx.avalanche?.interest < ctx.snowball?.interest ? 'Avalanche' : 'Snowball';
  const saving   = strategy === 'Avalanche'
    ? fmt((ctx.snowball?.interest || 0) - (ctx.avalanche?.interest || 0))
    : '0';

  return `Based on your ${fmt(ctx.salary)} salary for ${ctx.householdSize} person(s):

📌 Debt Strategy: Use the ${strategy} method — pay minimums on all debts, then throw every extra shilling at the highest-rate loan. This saves you ${saving} vs Snowball and clears debt ${Math.abs((ctx.snowball?.months||0) - (ctx.avalanche?.months||0))} months faster.

💰 Savings: Your ${fmt(ctx.adjSavings)}/month should go straight to ${mmf?.name || 'a Money Market Fund'} (currently ${mmf?.net || 16.8}% yield) on payday — before any spending. Never let it sit in a current account.

🛡️ Emergency Fund: Target 3 months of expenses (${fmt(ctx.emergencyTarget)}). You currently have ${fmt(ctx.currentSavings)} saved. ${ctx.currentSavings >= ctx.emergencyTarget ? 'Well done — you are fully funded!' : `You need ${fmt(ctx.emergencyTarget - ctx.currentSavings)} more.`}

🇰🇪 Kenya-specific tip: Once your emergency fund is complete, consider joining ${sacco?.name || 'Tower Sacco'} (${sacco?.dividend || 20}% dividend) for long-term wealth building. SACCOs also give you access to 3× your savings as a loan at competitive rates — a powerful tool once you are debt-free.

${ctx.spareCash > 0 ? `✨ You have ${fmt(ctx.spareCash)} spare this month — add it to your highest-rate debt for maximum impact.` : '⚠️ Budget is tight this month. Avoid any new credit until you have breathing room.'}`;
}
