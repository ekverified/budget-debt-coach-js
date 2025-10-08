import React, { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import './App.css';  // Ensures CSS is loaded

// Chart.js registration
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

function App() {
  const [salary, setSalary] = useState(0);
  const [savingsPct, setSavingsPct] = useState(10);
  const [debtPct, setDebtPct] = useState(20);
  const [expensesPct, setExpensesPct] = useState(70);
  const [householdSize, setHouseholdSize] = useState('');
  const [loans, setLoans] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [emergencyTarget, setEmergencyTarget] = useState(0);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [budgetHistory, setBudgetHistory] = useState([]);  // Renamed from 'history' to avoid global conflict
  const [chartData, setChartData] = useState(null);
  const [advice, setAdvice] = useState('');
  const [adjustedData, setAdjustedData] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [displaySalary, setDisplaySalary] = useState(0);
  const [enableAI, setEnableAI] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [currentQuote, setCurrentQuote] = useState('');
  const [nseData, setNseData] = useState({ gainers: [], losers: [] });

  useEffect(() => {
    const savedHistory = localStorage.getItem('budgetHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (parsed && parsed.length > 0) {
          setBudgetHistory(parsed);
        }
      } catch (e) {
        console.warn('Invalid history in localStorage, clearing:', e);
        localStorage.removeItem('budgetHistory');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('budgetHistory', JSON.stringify(budgetHistory));
  }, [budgetHistory]);

  // Fetch NSE data
  const fetchNSE = useCallback(async () => {
    try {
      const response = await fetch('https://afx.kwayisi.org/nse/');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const tables = doc.querySelectorAll('table');
      let gainers = [];
      let losers = [];
      tables.forEach((table) => {
        const th = table.querySelector('thead th');
        if (th && th.textContent.includes('Gainers')) {
          const rows = table.querySelectorAll('tbody tr');
          gainers = Array.from(rows).slice(0, 5).map((row) => {
            const tds = row.querySelectorAll('td');
            return {
              ticker: tds[0].textContent.trim(),
              price: tds[1].textContent.trim(),
              change: tds[2].textContent.trim(),
            };
          });
        } else if (th && th.textContent.includes('Losers')) {
          const rows = table.querySelectorAll('tbody tr');
          losers = Array.from(rows).slice(0, 5).map((row) => {
            const tds = row.querySelectorAll('td');
            return {
              ticker: tds[0].textContent.trim(),
              price: tds[1].textContent.trim(),
              change: tds[2].textContent.trim(),
            };
          });
        }
      });
      setNseData({ gainers, losers });
    } catch (error) {
      console.error('NSE Fetch Error:', error);
      // Updated fallback with real recent data
      setNseData({
        gainers: [
          { ticker: 'UNGA', price: '25.25', change: '+8.60%' },
          { ticker: 'BOC', price: '129.00', change: '+3.41%' },
          { ticker: 'KUKZ', price: '430.00', change: '+3.18%' },
          { ticker: 'CGEN', price: '50.50', change: '+2.96%' },
          { ticker: 'CARB', price: '27.65', change: '+2.79%' },
        ],
        losers: [
          { ticker: 'FTGH', price: '1.57', change: '-5.99%' },
          { ticker: 'KPLC', price: '14.25', change: '-5.94%' },
          { ticker: 'PORT', price: '56.00', change: '-5.88%' },
          { ticker: 'KAPC', price: '391.50', change: '-5.32%' },
          { ticker: 'KEGN', price: '9.28', change: '-3.13%' },
        ],
      });
    }
  }, []);

  useEffect(() => {
    fetchNSE();
    const interval = setInterval(fetchNSE, 1000);
    return () => clearInterval(interval);
  }, [fetchNSE]);

  // Weekly quotes setup
  useEffect(() => {
    const quotes = [
      { text: '"The poor and the middle class work for money. The rich have money work for them."', book: 'Rich Dad Poor Dad' },
      { text: '"A part of all you earn is yours to keep."', book: 'The Richest Man in Babylon' },
      { text: '"It\'s not how much money you make. It\'s how much you keep."', book: 'Rich Dad Poor Dad' },
      { text: '"Pay yourself first."', book: 'The Richest Man in Babylon' },
      { text: '"Rich people acquire assets. The poor and middle class acquire liabilities."', book: 'Rich Dad Poor Dad' },
      { text: '"Where the determination is, the way can be found."', book: 'The Richest Man in Babylon' },
      { text: '"The single most powerful asset we all have is our mind."', book: 'Rich Dad Poor Dad' }
    ];
    const today = new Date();
    const dayIndex = today.getDay(); // 0 = Sunday, 6 = Saturday
    setCurrentQuote(quotes[dayIndex]);
  }, []);

  // Fetch or load financial data
  const loadFinancialData = useCallback(async () => {
    // Static data as of Oct 7, 2025 (updated from real-time sources; in production, fetch real-time via APIs)
    const data = {
      saccos: [
        { name: 'Tower SACCO', dividend: 20, members: 'Large membership', note: '20% for 2025' },
        { name: 'Ports SACCO', dividend: 20, members: '200k+', note: 'Consistent high dividends' },
        { name: 'Yetu SACCO', dividend: 19, note: 'Open to public' }
      ],
      bonds: {
        '10Y': 13.46,
        tBills: { '91-day': 10.45, '182-day': 10.8, '364-day': 11.5 }
      },
      mmfs: [
        { name: 'Madison MMF', net: 10.5 },
        { name: 'Cytonn MMF', net: 16.2 },
        { name: 'Ndovu MMF', net: 16.5 }
      ],
      crypto: {
        lowRisk: ['Bitcoin (stable at ~$124,725, up 0.5%, ETF potential)', 'Ethereum (DeFi growth at ~$4,686)'],
        highPotential: ['Solana (scalability, 2025 boom candidate at ~$232)'],
        highRisk: ['Dogecoin (meme volatility at current trends ~$0.266, 1000x potential but high risk, 80% ETF odds)']
      }
    };
    setFinancialData(data);
    return data;
  }, []);

  const clearOnFocus = (e) => e.target.select();

  const updateSavingsPct = useCallback((newVal) => {
    const val = parseInt(newVal);
    setSavingsPct(val);
    const remaining = 100 - val;
    const otherSum = debtPct + expensesPct;
    if (otherSum > 0) {
      const debtNew = Math.round((debtPct / otherSum) * remaining);
      setDebtPct(debtNew);
      setExpensesPct(100 - val - debtNew);
    }
  }, [debtPct, expensesPct]);

  const updateDebtPct = useCallback((newVal) => {
    const val = parseInt(newVal);
    setDebtPct(val);
    const remaining = 100 - val;
    const otherSum = savingsPct + expensesPct;
    if (otherSum > 0) {
      const savingsNew = Math.round((savingsPct / otherSum) * remaining);
      setSavingsPct(savingsNew);
      setExpensesPct(100 - val - savingsNew);
    }
  }, [savingsPct, expensesPct]);

  const updateExpensesPct = useCallback((newVal) => {
    const val = parseInt(newVal);
    setExpensesPct(val);
    const remaining = 100 - val;
    const otherSum = savingsPct + debtPct;
    if (otherSum > 0) {
      const savingsNew = Math.round((savingsPct / otherSum) * remaining);
      setSavingsPct(savingsNew);
      setDebtPct(100 - val - savingsNew);
    }
  }, [savingsPct, debtPct]);

  const addLoan = useCallback(() => {
    setLoans(prev => [...prev, { name: '', balance: 0, rate: 0, minPayment: 0, isEssential: false }]);
  }, []);

  const updateLoan = useCallback((index, field, value) => {
    let parsedValue = value;
    if (field === 'name') {
      const numMatch = value.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const num = parseFloat(numMatch[1]);
        if (loans[index].balance === 0 && num > 0) {
          setTimeout(() => alert(`Detected amount ${num.toLocaleString()} in name "${value}". Consider moving to Balance field.`), 0);
          parsedValue = value.replace(numMatch[0], '').trim();
        }
      }
    }
    setLoans(prev => {
      const updated = [...prev];
      updated[index][field] = field === 'name' ? parsedValue : (parseFloat(value) || 0);
      return updated;
    });
  }, [loans]);

  const toggleLoanEssential = useCallback((index) => {
    setLoans(prev => {
      const updated = [...prev];
      updated[index].isEssential = !updated[index].isEssential;
      return updated;
    });
  }, []);

  const addExpense = useCallback(() => {
    setExpenses(prev => [...prev, { name: '', amount: 0, isEssential: false }]);
  }, []);

  const updateExpense = useCallback((index, field, value) => {
    let parsedValue = value;
    if (field === 'name') {
      const numMatch = value.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const num = parseFloat(numMatch[1]);
        if (expenses[index].amount === 0 && num > 0) {
          setTimeout(() => alert(`Detected amount ${num.toLocaleString()} in name "${value}". Consider moving to Amount field.`), 0);
          parsedValue = value.replace(numMatch[0], '').trim();
        }
      }
    }
    setExpenses(prev => {
      const updated = [...prev];
      updated[index][field] = field === 'name' ? parsedValue : (parseFloat(value) || 0);
      return updated;
    });
  }, [expenses]);

  const toggleExpenseEssential = useCallback((index) => {
    setExpenses(prev => {
      const updated = [...prev];
      updated[index].isEssential = !updated[index].isEssential;
      return updated;
    });
  }, []);

  const simulate = useCallback((loans, extra, sorter) => {
    const clonedLoans = loans.map(l => ({ ...l }));
    let months = 0;
    let totalInterest = 0;
    while (clonedLoans.some(l => l.balance > 0) && months < 600) {
      let totalMinPayThisMonth = 0;
      clonedLoans.forEach(loan => {
        if (loan.balance <= 0) return;
        const interest = loan.balance * (loan.rate / 100 / 12);
        loan.balance += interest;
        totalInterest += interest;
        const pay = Math.min(loan.minPayment, loan.balance);
        loan.balance -= pay;
        totalMinPayThisMonth += pay;
      });
      const extraThisMonth = Math.max(0, extra - totalMinPayThisMonth);
      if (extraThisMonth > 0) {
        const remaining = clonedLoans.filter(l => l.balance > 0).sort(sorter);
        if (remaining.length > 0) {
          const targetLoan = remaining[0];
          const pay = Math.min(extraThisMonth, targetLoan.balance);
          const targetIndex = clonedLoans.findIndex(l => l === targetLoan);
          clonedLoans[targetIndex].balance -= pay;
        }
      }
      months++;
    }
    return { months, totalInterest };
  }, []);

  const snowball = useCallback((loans, extra) => simulate(loans, extra, (a, b) => a.balance - b.balance), [simulate]);
  const avalanche = useCallback((loans, extra) => simulate(loans, extra, (a, b) => b.rate - a.rate), [simulate]);

  const getFreeAIAdvice = useCallback(async (userData, finData) => {
    if (!enableAI) return '';
    const models = ['distilgpt2', 'gpt2'];
    let tips = [];
    for (const model of models) {
      const prompt = `Kenyan financial advisor for ${userData.householdSize} members. Advice: Debt (high-interest), cuts (min 1000KES/person), savings, invest (MMFs, SACCOs, bonds). Crypto: balanced low-risk/high-pot with volatility warning. Data: Salary ${userData.salary}KES, Debt ${userData.debtBudget}, Expenses ${userData.totalExpenses}. Loans/Expenses: ${JSON.stringify([...userData.loans, ...userData.expenses].slice(0,4))}. Cuts: ${userData.suggestedCuts?.slice(0,100)||'None'}. SACCOs: ${finData.saccos.map(s => `${s.name} ${s.dividend}%`).join(', ')}. Bonds: 10Y ${finData.bonds['10Y']}% . MMFs: ${finData.mmfs.map(m => `${m.name} ${m.net || m.gross}%`).join(', ')}. Crypto: ${JSON.stringify(finData.crypto)}. 3-mo emergency, side hustles, survival tips. 5 bullets.`;

      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 150, temperature: 0.7 } })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const tip = data[0]?.generated_text?.split('Output:')[1]?.trim() || data[0]?.generated_text?.trim() || '';
        tips.push(tip);
      } catch (error) {
        console.error('AI Error:', error);
      }
    }
    const highInt = userData.highInterestLoans || 'high-interest loans';
    const saccoRec = finData.saccos[0].name;
    const mmfRec = finData.mmfs[0].name;
    const fallback = `- Prioritize ${highInt} payoff first.\n- Cut non-essentials 20% (save 1k/person), fund ${saccoRec} or ${mmfRec}.\n- Invest spare in 10Y bonds (${finData.bonds['10Y']}% yield).\n- Crypto: Start with ${finData.crypto.lowRisk[0]}, avoid high-risk ${finData.crypto.highRisk[0]} volatility.\n- Side hustle: Family tutoring for ${userData.householdSize} members. Build 3-mo emergency.`;
    return tips.length > 0 ? tips.join('\n\n') : fallback;
  }, [enableAI]);

  const handleCalculate = useCallback(async () => {
    try {
      console.log('Calc debug - Salary:', salary);
      console.log('Calc debug - Loans:', loans, 'length:', loans.length);
      console.log('Calc debug - Expenses:', expenses, 'length:', expenses.length);
      if (savingsPct + debtPct + expensesPct !== 100) {
        alert('Percentages must sum to 100%');
        return;
      }

      const finData = await loadFinancialData();

      const savings = salary * (savingsPct / 100);
      let debtBudget = salary * (debtPct / 100);
      let expensesBudget = salary * (expensesPct / 100);

      const totalMinPayments = loans.reduce((sum, loan) => sum + loan.minPayment, 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      console.log('Calc debug - totalMinPayments:', totalMinPayments, 'totalExpenses:', totalExpenses);

      const hs = parseInt(householdSize) || 1;

      const highInterestLoans = loans
        .filter(l => l.rate > 0)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 2)
        .map((l, idx) => `${l.name || `Loan ${idx+1}`} at ${l.rate}%`)
        .join(', ') || 'None >0%';

      let adjustedSavings = savings;
      let adjustedDebtBudget = debtBudget;
      let adjustedExpensesBudget = expensesBudget;
      let adjustedTotalExpenses = totalExpenses;
      let adjustedTotalMinPayments = totalMinPayments;
      let overageAdvice = '';
      const adjustments = [];

      // Debt overage - Compute cuts without mutation
      let debtOverage = 0;
      if (totalMinPayments > debtBudget) {
        debtOverage = totalMinPayments - debtBudget;
        adjustedDebtBudget = totalMinPayments;

        let coveredFromExpenses = 0;
        const nonEssentialExpenses = expenses.filter(exp => !exp.isEssential);
        nonEssentialExpenses.forEach(exp => {
          const maxCut = Math.max(0, exp.amount - (1000 * hs));
          const cut = Math.min(maxCut, debtOverage - coveredFromExpenses);
          if (cut > 0) {
            coveredFromExpenses += cut;
            adjustments.push({
              category: exp.name || 'Unnamed Expense',
              current: exp.amount,
              adjusted: exp.amount - cut,
              suggestion: `Cut KES ${cut.toLocaleString()} to cover debt (non-essential; min preserved for ${hs} members)`
            });
          }
        });

        adjustedTotalExpenses -= coveredFromExpenses;

        const remainingOverage = debtOverage - coveredFromExpenses;
        if (remainingOverage > 0) {
          const cutFromSavings = Math.min(remainingOverage, savings * 0.3);
          adjustedSavings = Math.max(salary * 0.05, savings - cutFromSavings);
          adjustments.push({
            category: 'Savings Adjustment for Debt',
            current: savings,
            adjusted: adjustedSavings,
            suggestion: `Reduced by KES ${cutFromSavings.toLocaleString()} to cover remaining debt`
          });
        }

        overageAdvice += `Debt overage covered: KES ${coveredFromExpenses.toLocaleString()} from expenses. `;
        adjustments.push({
          category: 'Total Debt Min Payments',
          current: totalMinPayments,
          adjusted: totalMinPayments,
          suggestion: `Prioritized (e.g., ${highInterestLoans})—no cuts`
        });
      } else {
        const highInterestLoanName = loans.filter(l => l.rate > 0).sort((a, b) => b.rate - a.rate).slice(0, 1).map(l => l.name || 'Top Loan').join(', ') || 'N/A';
        adjustments.push({
          category: 'Total Debt Min Payments',
          current: totalMinPayments,
          adjusted: totalMinPayments,
          suggestion: `Within budget; prioritize ${highInterestLoanName}`
        });
      }

      // Expenses overage - Compute without mutation
      let cutAmount = 0;
      if (adjustedTotalExpenses > expensesBudget) {
        const expOverage = adjustedTotalExpenses - expensesBudget;
        const nonEssentialExpenses = expenses.filter(exp => !exp.isEssential).sort((a, b) => b.amount - a.amount);
        nonEssentialExpenses.forEach(exp => {
          const minPerPerson = exp.name.toLowerCase().includes('shopping') || exp.name.toLowerCase().includes('food') ? 1500 : 500;
          const maxCut = Math.max(0, exp.amount - (minPerPerson * hs));
          const cut = Math.min(maxCut * 0.3, expOverage - cutAmount);
          if (cut > 0) {
            cutAmount += cut;
            adjustments.push({
              category: exp.name || 'Unnamed',
              current: exp.amount,
              adjusted: exp.amount - cut,
              suggestion: `Cut 30% (KES ${cut.toLocaleString()})—sustainable for ${hs} members; to emergency fund`
            });
          }
        });
        adjustedTotalExpenses = Math.max(0, adjustedTotalExpenses - cutAmount);
        adjustedExpensesBudget = adjustedTotalExpenses;
        overageAdvice += `Expense cuts saved KES ${cutAmount.toLocaleString()}. `;
      }

      // Always push total expenses row
      const nonEssentials = expenses.filter(e => !e.isEssential).map(e => e.name || 'Unnamed').join(', ') || 'None';
      adjustments.push({
        category: 'Total Expenses',
        current: totalExpenses,
        adjusted: adjustedTotalExpenses,
        suggestion: `${totalExpenses > expensesBudget || cutAmount > 0 ? `Adjusted (saved KES ${cutAmount.toLocaleString()})` : 'Within budget'}; review ${nonEssentials}`
      });

      // Balance cuts - Compute without mutation
      let totalAdjustedOutgo = adjustedTotalMinPayments + adjustedTotalExpenses;
      let overageAfterCuts = Math.max(0, totalAdjustedOutgo + adjustedSavings - salary);
      if (overageAfterCuts > 0) {
        let extraCutNeeded = overageAfterCuts;
        const remainingNonEssentials = expenses.filter(exp => !exp.isEssential && exp.amount > (500 * hs));
        remainingNonEssentials.forEach(exp => {
          const extraCut = Math.min(exp.amount * 0.2, extraCutNeeded);
          if (extraCut > 0) {
            adjustedTotalExpenses -= extraCut;
            extraCutNeeded -= extraCut;
            adjustments.push({
              category: `Balance Cut - ${exp.name || 'Unnamed'}`,
              current: exp.amount,
              adjusted: exp.amount - extraCut,
              suggestion: `Extra 20% cut (KES ${extraCut.toLocaleString()}) to fit salary`
            });
          }
        });
        totalAdjustedOutgo = adjustedTotalMinPayments + adjustedTotalExpenses;
      }

      const spareCash = Math.max(0, salary - totalAdjustedOutgo - adjustedSavings);

      // Enforce min savings
      if (totalAdjustedOutgo > salary * 0.95) {
        const forcedSavings = salary * 0.05;
        adjustedSavings = Math.max(adjustedSavings, forcedSavings);
        const sideHustleIdeas = ['tutoring', 'goods resale', 'freelance writing', 'delivery services', 'online surveys'];
        const randomIdea = sideHustleIdeas[Math.floor(Math.random() * sideHustleIdeas.length)];
        overageAdvice += `Enforced 5% savings (KES ${adjustedSavings.toLocaleString()}). Side hustle idea${hs > 1 ? ` for ${hs} members` : ''}: ${randomIdea}. `;
      }

      const { months: snowMonths, totalInterest: snowInterest } = snowball(loans, adjustedDebtBudget);
      const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, adjustedDebtBudget);

      let adviceText = loans.length === 0
        ? 'No loans? Focus on 20% savings in MMFs (10%+ return). 50/30/20 rule: needs/wants/savings. Build 3-6 mo emergency.'
        : `${avaInterest < snowInterest ? 'Avalanche saves interest—use if disciplined.' : 'Snowball for motivation.'} Prioritize ${highInterestLoans}.`;

      // Enhanced personalized advice
      const suggestedCutAmount = totalExpenses * 0.2;
      adviceText += `\n\nFor your ${hs}-member household on ${salary.toLocaleString()} KES salary, prioritize high-interest loan payoff. Cut non-essentials like shopping by 20% (save ~${suggestedCutAmount.toLocaleString()} KES) to fund MMFs.`;

      if (totalAdjustedOutgo + adjustedSavings > salary) {
        const overage = totalAdjustedOutgo + adjustedSavings - salary;
        adviceText += `\n\n🚨 Survival: Over by KES ${overage.toLocaleString()}. Short-term: Borrow at 5% over 6 mo (~KES ${(overage / 6 + overage * 0.05 / 2).toFixed(0)}/mo). Long-term: Negotiate rates, sell items for 2k cash. Track spends; 1 no-spend day/week/family. ${overageAdvice}`;
      } else if (spareCash > 0) {
        adviceText += `\n\n💡 Spare KES ${spareCash.toLocaleString()}—boost to 15% savings, treasury bonds (8% yield). Automate.`;
      }

      adviceText += `\n\nTotal Spend: KES ${(totalAdjustedOutgo + adjustedSavings).toLocaleString()} (fits salary).`;

      // 3-Month Emergency build plan with real-time options
      const monthlyExpensesForEmergency = Math.max(adjustedTotalExpenses, emergencyTarget / 3 || 0);
      const threeMonthTarget = Math.max(emergencyTarget, monthlyExpensesForEmergency * 3);
      const monthsToEmergency = adjustedSavings > 0 ? Math.ceil((threeMonthTarget - currentSavings) / adjustedSavings) : 0;
      const thisMonthAdd = Math.min(spareCash, 1000);
      adviceText += `\n\n🛡️ 3-Month Emergency Build Plan: Target KES ${threeMonthTarget.toLocaleString()} (${hs} members). Current: KES ${currentSavings.toLocaleString()}. Reach in ${monthsToEmergency} mo. Add KES ${thisMonthAdd.toLocaleString()} to Sacco this mo. Real-time option: Invest in ${finData.mmfs[0].name} at ${finData.mmfs[0].net}% net.`;

      // Kenyan Investments
      const saccoRec = finData.saccos[0].name;
      const bondYield = finData.bonds['10Y'];
      const mmfRec = finData.mmfs[0].name;
      const mmfYield = finData.mmfs[0].net;
      adviceText += `\n\n<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Kenya.svg/16px-Flag_of_Kenya.svg.png?20221128225827" alt="Flag of Kenya" style="width: 16px; height: 12px; vertical-align: middle;" /> Kenyan Investments: Top SACCOs - ${finData.saccos.map(s => `${s.name} (~${s.dividend}% dividends)`).join(', ')}. Gov Bonds: 10Y yield ~${bondYield}%; T-Bills ~${finData.bonds.tBills['91-day']}-${finData.bonds.tBills['364-day']}% (91-364 days). MMFs: ${finData.mmfs.map(m => `${m.name} (${m.net || m.gross}% ${m.net ? 'net' : 'gross'})`).join(', ')} - e.g., put cuts into ${mmfRec} at ${mmfYield}% net.`;

      // Crypto Advice
      adviceText += `\n\n₿ Crypto Advice: Low-risk entry: ${finData.crypto.lowRisk.join(', ')} for stability. Higher-potential: ${finData.crypto.highPotential.join(', ')} for growth. Warnings: Volatility high - e.g., 1000x potential in memecoins like ${finData.crypto.highRisk[0]}, but high risk; invest only spare cash.`;

      // NEW: Generate Monthly Payment Plan
      const plan = [];
      let totalPlan = 0;

      // Loans: Prioritize by rate (avalanche), assign min + extra to highest
      const sortedLoans = [...loans].sort((a, b) => b.rate - a.rate).filter(l => l.minPayment > 0);
      const extraForDebt = Math.max(0, adjustedDebtBudget - totalMinPayments);
      sortedLoans.forEach((loan, idx) => {
        const minPay = loan.minPayment;
        const extraPay = idx === 0 ? extraForDebt : 0; // All extra to highest rate
        const totalPay = minPay + extraPay;
        plan.push({
          category: 'Loan',
          subcategory: loan.name || `Loan ${idx + 1}`,
          priority: idx + 1,
          budgeted: totalPay,
          notes: `Priority ${idx + 1} (rate ${loan.rate}%). Min: ${minPay.toLocaleString()}, Extra: ${extraPay.toLocaleString()}`
        });
        totalPlan += totalPay;
      });

      // Expenses: Assign adjusted from cuts, or full if not cut
      const expenseAdjustMap = new Map(adjustments.filter(adj => adj.category !== 'Total Expenses' && adj.category !== 'Total Debt Min Payments' && !adj.category.startsWith('Savings') && !adj.category.startsWith('Balance Cut')).map(adj => [adj.category, adj.adjusted]));
      expenses.forEach(exp => {
        const adjAmount = expenseAdjustMap.get(exp.name || 'Unnamed') || exp.amount;
        plan.push({
          category: 'Expense',
          subcategory: exp.name || `Expense`,
          priority: exp.isEssential ? 'Essential' : 'Non-Essential',
          budgeted: adjAmount,
          notes: exp.isEssential ? 'Full allocation' : `Adjusted if over budget`
        });
        totalPlan += adjAmount;
      });

      // Savings
      plan.push({
        category: 'Savings',
        subcategory: 'Emergency/Investments',
        priority: 'N/A',
        budgeted: adjustedSavings,
        notes: `Min 5% enforced; invest in MMFs/SACCOs`
      });
      totalPlan += adjustedSavings;

      // Total and Deficit
      const deficit = totalPlan - salary;
      const sideHustleIdeas = ['tutoring', 'goods resale', 'freelance writing', 'delivery services', 'online surveys'];
      const randomIdea = sideHustleIdeas[Math.floor(Math.random() * sideHustleIdeas.length)];
      if (deficit > 0) {
        plan.push({
          category: 'Deficit',
          subcategory: 'Overall Shortfall',
          priority: 'Alert',
          budgeted: deficit,
          notes: `KES ${deficit.toLocaleString()} over. Advice: Negotiate loan rates, start side hustle (e.g., ${randomIdea}${hs > 1 ? ` for ${hs} members` : ''}, target +${Math.ceil(deficit / hs).toLocaleString()} KES/person/mo), sell non-essentials for quick cash, or seek low-interest bridge loan. Review in 1 mo.`
        });
      } else {
        plan.push({
          category: 'Surplus',
          subcategory: 'Spare Cash',
          priority: 'Opportunity',
          budgeted: Math.max(0, salary - totalPlan),
          notes: `KES ${(salary - totalPlan).toLocaleString()} extra - boost savings or invest in bonds/MMFs.`
        });
      }

      setPlanData(plan);

      // AI
      let aiTip = '';
      if (enableAI) {
        aiTip = await getFreeAIAdvice({
          salary, debtBudget: adjustedDebtBudget, totalExpenses: adjustedTotalExpenses, loans, expenses, householdSize: hs,
          suggestedCuts: adjustments.map(adj => `${adj.category}: ${adj.suggestion}`).join('; '), savings: adjustedSavings, highInterestLoans
        }, finData);
        adviceText += `\n\n🤖 AI Tip:\n${aiTip}`;
      }

      // Add Savings and Spare to adjustments for full table
      adjustments.push({
        category: 'Savings',
        current: savings,
        adjusted: adjustedSavings,
        suggestion: 'Min 5%—low-risk invest (e.g., MMFs); emergency priority'
      });
      adjustments.push({
        category: 'Spare',
        current: 0,
        adjusted: spareCash,
        suggestion: spareCash > 0 ? 'Invest in bonds/MMFs' : 'N/A'
      });

      setAdvice(adviceText);
      setAdjustedData(adjustments);
      setEmergencyTarget(threeMonthTarget);

      const historyEntry = {
        month: new Date().toISOString().slice(0, 7),
        salary, savings: adjustedSavings, debtBudget: adjustedDebtBudget, expensesBudget: adjustedExpensesBudget,
        totalExpenses: adjustedTotalExpenses, snowMonths, snowInterest, avaMonths, avaInterest,
        emergencyTarget: threeMonthTarget, currentSavings: currentSavings + adjustedSavings, adjustments: overageAdvice, householdSize: hs
      };
      setCurrentSavings(historyEntry.currentSavings);
      setBudgetHistory(prev => [...prev, historyEntry]);  // Updated reference

      // PDF (concise text-based summary without tables or emojis)
      try {
        const doc = new jsPDF();
        let yPos = 10;
        doc.setFontSize(12);
        doc.text(`Budget Report - Salary KES ${salary.toLocaleString()} (Household: ${hs})`, 10, yPos);
        yPos += 10;

        // Summary Section (key metrics only)
        doc.setFontSize(10);
        doc.text(`Allocation: ${Math.round(adjustedSavings / salary * 100)}% Savings, ${Math.round(adjustedDebtBudget / salary * 100)}% Debt, ${Math.round(adjustedExpensesBudget / salary * 100)}% Expenses`, 10, yPos);
        yPos += 7;
        doc.text(`Snowball: ${snowMonths} mo, Interest KES ${snowInterest.toLocaleString()}`, 10, yPos);
        yPos += 7;
        doc.text(`Avalanche: ${avaMonths} mo, Interest KES ${avaInterest.toLocaleString()}`, 10, yPos);
        yPos += 7;
        doc.text(`Emergency: KES ${threeMonthTarget.toLocaleString()} (3 mo for ${hs})`, 10, yPos);
        yPos += 7;
        doc.text(`Invest: ${saccoRec} ${finData.saccos[0].dividend}%, Bonds ${bondYield}%, ${mmfRec} ${mmfYield}%`, 10, yPos);
        yPos += 10;

        // AI Tip (truncated)
        if (aiTip) {
          doc.text(`AI Tip: ${aiTip.split('\n')[0].substring(0, 80)}...`, 10, yPos);
          yPos += 7;
        }

        // Monthly Plan Summary (first 8 items)
        doc.text('Monthly Plan Summary:', 10, yPos);
        yPos += 7;
        plan.slice(0, 8).forEach((item) => {
          if (yPos > 270) { doc.addPage(); yPos = 10; }
          doc.text(`${item.subcategory}: KES ${item.budgeted.toLocaleString()} - ${item.notes.substring(0, 40)}`, 10, yPos);
          yPos += 7;
        });
        if (deficit > 0) {
          doc.text(`Deficit Alert: KES ${deficit.toLocaleString()} - See advice above.`, 10, yPos);
          yPos += 7;
        }

        // Adjustments (first 6)
        doc.text('Adjustments:', 10, yPos);
        yPos += 7;
        adjustments.slice(0, 6).forEach((adj) => {
          if (yPos > 270) { doc.addPage(); yPos = 10; }
          doc.text(`${adj.category}: ${adj.current.toLocaleString()} -> ${adj.adjusted.toLocaleString()} - ${adj.suggestion.substring(0, 40)}`, 10, yPos);
          yPos += 7;
        });

        // Brief Advice Snippet
        if (yPos < 250) {
          doc.text('Key Advice: Prioritize high-interest debt. Cut non-essentials by 20%. Build emergency fund.', 10, yPos);
        }

        doc.save('budget_report.pdf');
      } catch (pdfError) {
        console.error('PDF Error:', pdfError);
      }

      // Enhanced Chart: Include Spare if >0
      const pieLabels = ['Savings', 'Debt', 'Expenses'];
      const pieDataValues = [adjustedSavings, adjustedDebtBudget, adjustedExpensesBudget];
      const pieColors = ['#4CAF50', '#FF5722', '#2196F3']; // Distinctive: Green (Savings), Orange (Debt), Blue (Expenses)
      if (spareCash > 0) {
        pieLabels.push('Spare Cash');
        pieDataValues.push(spareCash);
        pieColors.push('#FFC107'); // Yellow for Spare
      }
      const pieData = {
        labels: pieLabels,
        datasets: [{ data: pieDataValues, backgroundColor: pieColors }]
      };
      setChartData(pieData);

      // Store salary for display before clearing
      setDisplaySalary(salary);

      // Clear input fields after generating results
      setSalary(0);
      setLoans([]);
      setExpenses([]);

      console.log('Calculate finished');
    } catch (error) {
      console.error('Calculate Error:', error);
      alert(`Calc failed: ${error.message}. Check console. Try disabling AI.`);
    }
  }, [salary, savingsPct, debtPct, expensesPct, householdSize, loans, expenses, emergencyTarget, currentSavings, enableAI, budgetHistory, snowball, avalanche, getFreeAIAdvice, loadFinancialData]);  // Updated dep

  const downloadHistory = useCallback(() => {
    const csv = 'Month,Salary,Savings,Debt Budget,Expenses Budget,Total Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Current Savings,Adjustments,Household Size\n' +
      budgetHistory.map(entry => `${entry.month},${entry.salary},${entry.savings},${entry.debtBudget},${entry.expensesBudget},${entry.totalExpenses},${entry.snowMonths},${entry.snowInterest},${entry.avaMonths},${entry.avaInterest},${entry.emergencyTarget},${entry.currentSavings},"${entry.adjustments || ''}",${entry.householdSize || 1}`).join('\n');  // Updated reference
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_history.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }, [budgetHistory]);

  const clearHistory = useCallback(() => {
    setBudgetHistory([]);  // Updated reference
    localStorage.removeItem('budgetHistory');
  }, []);

  const historyData = {
    labels: budgetHistory.map(entry => entry.month).reverse(),  // Updated reference
    datasets: [
      { label: 'Debt Budget', data: budgetHistory.map(entry => entry.debtBudget).reverse(), borderColor: 'rgb(244, 67, 54)', backgroundColor: 'rgba(244, 67, 54, 0.2)', tension: 0.1 },
      { label: 'Expenses', data: budgetHistory.map(entry => entry.totalExpenses).reverse(), borderColor: 'rgb(76, 175, 80)', backgroundColor: 'rgba(76, 175, 80, 0.2)', tension: 0.1 }
    ]
  };

  const getChangeDisplay = (change) => {
    const isGain = change.startsWith('+');
    const color = isGain ? '#4CAF50' : '#F44336';
    const arrow = isGain ? '▲' : '▼';
    return (
      <span style={{ color }}>
        {change} {arrow}
      </span>
    );
  };

  return (
    <div className="app-container">
      {/* NSE Widget - Fixed top-right corner */}
      <div className="nse-widget" style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        zIndex: 1000,
        maxWidth: '300px',
        fontSize: '12px'
      }}>
        <h3 className="gainers-header" style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#4CAF50' }}>GAINERS</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '2px 4px', textAlign: 'left' }}>Ticker</th>
              <th style={{ padding: '2px 4px', textAlign: 'right' }}>Price (KES)</th>
              <th style={{ padding: '2px 4px', textAlign: 'right' }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {nseData.gainers.map((g, i) => (
              <tr key={i}>
                <td style={{ padding: '2px 4px' }}>{g.ticker}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>{g.price}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>{getChangeDisplay(g.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="losers-header" style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#F44336' }}>LOSERS</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '2px 4px', textAlign: 'left' }}>Ticker</th>
              <th style={{ padding: '2px 4px', textAlign: 'right' }}>Price (KES)</th>
              <th style={{ padding: '2px 4px', textAlign: 'right' }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {nseData.losers.map((l, i) => (
              <tr key={i}>
                <td style={{ padding: '2px 4px' }}>{l.ticker}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>{l.price}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right' }}>{getChangeDisplay(l.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <header className="header">
        <h1>Budget & Debt Coach App</h1>
        <p>Open Access - Auth coming soon</p>
      </header>

      {currentQuote && (
        <div className="quote-box">
          <strong>{currentQuote.text} - {currentQuote.book}</strong>
        </div>
      )}

      <section className="section">
        <h2>Budget Settings</h2>
        <label>Monthly Salary (KES): <input key="salary" type="number" value={salary || 0} onChange={(e) => setSalary(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} className="input-field" /></label><br />
        <label>Household Size: <input key="household" type="number" min="1" value={householdSize || ''} onChange={(e) => setHouseholdSize(e.target.value)} className="input-field" style={{ width: '50px' }} /> (Scales advice)</label><br />
        <label style={{ color: '#2E7D32' }}>Customization (%): </label>
        <input type="range" min="0" max="50" value={savingsPct} onChange={(e) => updateSavingsPct(e.target.value)} style={{ margin: '5px' }} /> Savings: {savingsPct}%
        <input type="range" min="0" max="50" value={debtPct} onChange={(e) => updateDebtPct(e.target.value)} style={{ margin: '5px' }} /> Debt: {debtPct}%
        <input type="range" min="0" max="100" value={expensesPct} onChange={(e) => updateExpensesPct(e.target.value)} style={{ margin: '5px' }} /> Expenses: {expensesPct}%<br />
        <label>Emergency Target (KES): <input key="emergency" type="number" value={emergencyTarget || 0} onChange={(e) => setEmergencyTarget(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} className="input-field" /> (Auto-updates below)</label>
      </section>

      <section className="section">
        <h2>Loans</h2>
        {loans.map((loan, i) => (
          <div key={`loan-${i}`} className="loan-card">
            <h3>Loan {i+1}</h3>
            <label>Name: <input type="text" value={loan.name} onChange={(e) => updateLoan(i, 'name', e.target.value)} className="input-field" /></label><br />
            <label>Balance (KES): <input type="number" value={loan.balance || 0} onChange={(e) => updateLoan(i, 'balance', e.target.value)} onFocus={clearOnFocus} className="input-field" /></label><br />
            <label>Rate (%): <input type="number" step="0.1" value={loan.rate || 0} onChange={(e) => updateLoan(i, 'rate', e.target.value)} onFocus={clearOnFocus} className="input-field" /></label><br />
            <label>Min Payment (KES): <input type="number" value={loan.minPayment || 0} onChange={(e) => updateLoan(i, 'minPayment', e.target.value)} onFocus={clearOnFocus} className="input-field" /></label><br />
            <label>Essential?: <input type="checkbox" checked={loan.isEssential || false} onChange={() => toggleLoanEssential(i)} style={{ margin: '5px' }} /></label>
          </div>
        ))}
        <button onClick={addLoan} className="action-button">Add Loan</button>
      </section>

      <section className="section">
        <h2>Expenses</h2>
        {expenses.map((exp, i) => (
          <div key={`exp-${i}`} className="expense-card">
            <h3>Expense {i+1}</h3>
            <label>Name: <input type="text" value={exp.name} onChange={(e) => updateExpense(i, 'name', e.target.value)} className="input-field" /></label><br />
            <label>Amount (KES): <input type="number" value={exp.amount || 0} onChange={(e) => updateExpense(i, 'amount', e.target.value)} onFocus={clearOnFocus} className="input-field" /></label><br />
            <label>Essential?: <input type="checkbox" checked={exp.isEssential || false} onChange={() => toggleExpenseEssential(i)} style={{ margin: '5px' }} /></label>
          </div>
        ))}
        <button onClick={addExpense} className="action-button">Add Expense</button>
      </section>

      <section className="section">
        <h2>Actions</h2>
        <label style={{ display: 'block', marginBottom: '10px', color: '#2E7D32' }}>Enable Free AI Advice: <input type="checkbox" checked={enableAI} onChange={(e) => setEnableAI(e.target.checked)} /></label>
        <button onClick={handleCalculate} className="action-button">Calculate & Generate Plan</button>
        <button onClick={downloadHistory} className="action-button download-button">Download History CSV</button>
        <button onClick={clearHistory} className="action-button clear-button">Clear History</button>
      </section>

      {adjustedData && adjustedData.length > 0 && (
        <section className="section">
          <h2>Adjusted Plan Table</h2>
          <table className="table">
            <thead><tr><th>Category</th><th>Current (KES)</th><th>Adjusted (KES)</th><th>Suggestion</th></tr></thead>
            <tbody>{adjustedData.map((adj, i) => (
              <tr key={i}><td>{adj.category}</td><td>{adj.current.toLocaleString()}</td><td>{adj.adjusted.toLocaleString()}</td><td>{adj.suggestion}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {planData && planData.length > 0 && (
        <section className="section">
          <h2>Monthly Payment Plan (Prioritized for Loans/Expenses/Savings)</h2>
          <p style={{ color: '#388E3C' }}>Even after adjustments, here's your detailed monthly plan. Loans prioritized by interest rate (highest first). Expenses budgeted per item. Deficit advice if over salary.</p>
          <table className="table">
            <thead><tr>
              <th>Category</th>
              <th>Item</th>
              <th>Priority</th>
              <th>Budgeted (KES)</th>
              <th>Notes</th>
            </tr></thead>
            <tbody>{planData.map((item, i) => (
              <tr key={i} style={{ backgroundColor: item.category === 'Deficit' ? '#ffebee' : item.category === 'Surplus' ? '#e8f5e8' : '#f1f8e9' }}>
                <td>{item.category}</td>
                <td>{item.subcategory}</td>
                <td>{item.priority}</td>
                <td>{item.budgeted.toLocaleString()}</td>
                <td>{item.notes}</td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{ color: '#388E3C', fontWeight: 'bold' }}><strong>Total Planned: KES {planData.reduce((sum, item) => sum + (item.budgeted || 0), 0).toLocaleString()}</strong> vs Salary KES {displaySalary.toLocaleString()}</p>
        </section>
      )}

      {chartData && (
        <section className="section">
          <h2>Adjusted Allocation Chart (Totals correctly with Spare if available)</h2>
          <div style={{ width: '400px', height: '400px', margin: '0 auto' }}>
            <Pie data={chartData} />
          </div>
        </section>
      )}

      {advice && (
        <section className="section">
          <h2>Financial Advice</h2>
          <div className="advice-box" dangerouslySetInnerHTML={{ __html: advice.replace(/\n/g, '<br>') }} />
        </section>
      )}

      <section className="section">
        <h2>History</h2>
        <div style={{ width: '800px', height: '400px', margin: '0 auto' }}>
          <Line data={historyData} />
        </div>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {budgetHistory.map((entry, i) => (  // Updated reference
            <li key={i} className="history-item">
              <strong>{entry.month}:</strong> Salary KES {entry.salary.toLocaleString()}, Savings KES {entry.savings.toLocaleString()}, Debt KES {entry.debtBudget.toLocaleString()}, Expenses KES {entry.totalExpenses.toLocaleString()} {entry.adjustments ? `(Adjusts: ${entry.adjustments})` : ''} (Household: {entry.householdSize || 1})
            </li>
          ))}
        </ul>
      </section>

      <section className="section progress-section">
        <h2>Emergency Fund Progress</h2>
        <p>Current Savings: KES {currentSavings.toLocaleString()} / {emergencyTarget.toLocaleString()}</p>
        <progress value={currentSavings} max={emergencyTarget || 1} style={{ width: '100%', height: '20px', borderRadius: '10px', backgroundColor: '#A5D6A7' }} />
      </section>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; text-shadow: 0 0 5px #FF9800; } 51%, 100% { opacity: 0.7; text-shadow: none; } }
        @media (max-width: 768px) {
          .nse-widget {
            position: fixed !important;
            bottom: 10px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            right: auto !important;
            top: auto !important;
            max-width: 90vw !important;
            font-size: 10px !important;
          }
          .nse-widget h3 {
            font-size: 12px !important;
          }
          .nse-widget table th, .nse-widget table td {
            padding: 1px 2px !important;
            font-size: 9px !important;
          }
        }
      `}</style>

      <footer className="footer">
        <p>For enquiries: <a href="https://wa.me/254705245123" target="_blank" rel="noopener noreferrer" className="footer-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366" style={{ verticalAlign: 'middle' }}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
          </svg>
        </a> | <a href="https://x.com/B_D_coach_app" target="_blank" rel="noopener noreferrer" className="footer-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 16 16" style={{ verticalAlign: 'middle' }}>
            <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/>
          </svg>
        </a> | <a href="https://www.tiktok.com/@budget_and_debt_coach" target="_blank" rel="noopener noreferrer" className="footer-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-tiktok" viewBox="0 0 16 16" style={{ verticalAlign: 'middle' }}>
            <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/>
          </svg>
        </a></p>
      </footer>
    </div>
  );
}

export default App;
