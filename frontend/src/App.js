import React, { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import './App.css';
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);
function App() {
  const [salary, setSalary] = useState(0);
  const [savingsPct, setSavingsPct] = useState(10);
  const [debtPct, setDebtPct] = useState(20);
  const [expensesPct, setExpensesPct] = useState(70);
  const [householdSize, setHouseholdSize] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [loans, setLoans] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [emergencyTarget, setEmergencyTarget] = useState(0);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [advice, setAdvice] = useState('');
  const [adjustedData, setAdjustedData] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [displaySalary, setDisplaySalary] = useState(0);
  const [enableAI, setEnableAI] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [currentQuote, setCurrentQuote] = useState('');
  const [adjustedSavings, setAdjustedSavings] = useState(0);
  const [adjustedTotalExpenses, setAdjustedTotalExpenses] = useState(0);
  const [adjustedTotalMinPayments, setAdjustedTotalMinPayments] = useState(0);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem('hasSeenInstallPrompt');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!hasSeenPrompt && !isStandalone) {
      const handler = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowInstallPrompt(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }
  }, []);
  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        setShowInstallPrompt(false);
        localStorage.setItem('hasSeenInstallPrompt', 'true');
        setDeferredPrompt(null);
      });
    }
  };
  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('hasSeenInstallPrompt', 'true');
  };
  useEffect(() => {
    const savedHistory = localStorage.getItem('budgetHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (parsed && parsed.length > 0) {
          setBudgetHistory(parsed);
          // Update currentSavings from latest history entry if available
          const latest = parsed[parsed.length - 1];
          if (latest && latest.currentSavings) {
            setCurrentSavings(latest.currentSavings);
          }
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
  useEffect(() => {
    const countryToCurrency = {
      'KE': 'KES', 'US': 'USD', 'GB': 'GBP', 'DE': 'EUR', 'FR': 'EUR', 'IN': 'INR', 'NG': 'NGN', 'ZA': 'ZAR',
    };
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        const cur = countryToCurrency[data.country_code] || 'USD';
        setCurrency(cur);
      })
      .catch(() => {
        setCurrency('KES');
      });
  }, []);
  useEffect(() => {
    const quotes = [
      { text: '"A part of all you earn is yours to keep. It should be not less than a tenth no matter how little you earn."', author: 'George S. Clason' },
      { text: '"Our desires for goods and pleasures are like the beasts of the field; they must be controlled or they will devour us."', author: 'George S. Clason' },
      { text: '"Opportunity is a haughty goddess who wastes no time with those who are unprepared."', author: 'George S. Clason' },
      { text: '"The intelligent investor is a realist who sells to optimists and buys from pessimists."', author: 'Benjamin Graham' },
      { text: '"The goal of a successful trader is to make the best trades. Money is secondary."', author: 'Alexander Elder' },
      { text: '"Do not save what is left after spending, but spend what is left after saving."', author: 'Warren Buffett' },
      { text: '"Financial peace isn’t the acquisition of stuff. It’s learning to live on less than you make."', author: 'Dave Ramsey' },
    ];
    const today = new Date();
    const dayIndex = today.getDate() % quotes.length;
    setCurrentQuote(quotes[dayIndex]);
  }, []);
  const loadFinancialData = useCallback(async () => {
    const data = {
      saccos: [
        { name: 'Tower SACCO', dividend: 20, members: 'Large membership', note: 'Consistent high dividends - Guard thy treasures from loss with community-backed security' },
        { name: 'Ports SACCO', dividend: 20, members: '200k+', note: 'Consistent high dividends - Guard thy treasures from loss with community-backed security' },
        { name: 'Nyati SACCO', dividend: 21, note: 'Top performer - Start thy purse to fattening with accessible shares' }
      ],
      bonds: {
        '10Y': 13.46,
        tBills: { '91-day': 7.83, '182-day': 7.87, '364-day': 9.35 }
      },
      mmfs: [
        { name: 'Madison MMF', net: 11.0, note: 'Safe, liquid - Ensure future income with steady yields' },
        { name: 'Cytonn MMF', net: 15.8, note: 'Higher yield for growth - Invest where thy principal is protected' },
        { name: 'Ndovu MMF', net: 16.2, note: 'Top performer - Increase thy ability to earn through compounded returns' }
      ],
      callDeposits: [
        { name: 'KCB Bank', rate: 7.0, minInvestment: 300000, note: 'Start small for family emergency buffers' },
        { name: 'Absa Bank', rate: 7.2, minInvestment: 150000, note: 'Scale for short-term household needs' },
        { name: 'I&M Bank', rate: 7.5, minInvestment: 150000, note: 'Ensure future income with competitive rates and easy withdrawals' }
      ]
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
      const prompt = `Kenyan financial advisor inspired by "The Richest Man in Babylon". Employ all seven cures: Start purse fattening (10% save), control expenditures, make gold multiply (invest wisely), guard against loss (safe options), own home, ensure future income (retirement), increase earning ability (skills/side hustles). For ${userData.householdSize}-member household. Advice: Debt (avalanche method for high-interest), cuts (min ${1000 * userData.householdSize}${currency}/month for essentials), savings (emergency 3-mo scaled for ${userData.householdSize}), invest (MMFs, SACCOs, bonds, call deposits - tie to cures). Data: Salary ${userData.salary}${currency}, Debt ${userData.debtBudget}${currency}, Expenses ${userData.totalExpenses}${currency}. Loans/Expenses: ${JSON.stringify([...userData.loans, ...userData.expenses].slice(0,4))}. Cuts: ${userData.suggestedCuts?.slice(0,100)||'None'}. SACCOs: ${finData.saccos.map(s => `${s.name} ${s.dividend}%`).join(', ')}. Bonds: 10Y ${finData.bonds['10Y']}% . MMFs: ${finData.mmfs.map(m => `${m.name} ${m.net || m.gross}%`).join(', ')}. Call Deposits: ${finData.callDeposits.map(d => `${d.name} ${d.rate}% (min ${currency} ${d.minInvestment.toLocaleString()})`).join(', ')}. Include side hustles suitable for ${userData.householdSize} members, home ownership tips, compound interest example. 5 bullets tying to book cures.`;
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
    const fallback = `- First Cure: Start thy purse to fattening - Save 10% in ${saccoRec} (${finData.saccos[0].dividend}%).\n- Second: Control expenditures - Cut non-essentials by 20%, maintain essentials budget.\n- Third: Make gold multiply - Invest cuts in ${mmfRec} at ${finData.mmfs[0].net}% for growth.\n- Fourth: Guard against loss - Use call deposits (e.g., Absa 7.2%, min 150k) for safe returns.\n- Fifth-Seventh: Plan home ownership via SACCO loans, secure retirement, boost income with side hustles.`;
    return tips.length > 0 ? tips.join('\n\n') : fallback;
  }, [enableAI, currency]);
  const handleCalculate = useCallback(async () => {
    try {
      if (savingsPct + debtPct + expensesPct !== 100) {
        alert('Percentages must sum to 100%');
        return;
      }
      const finData = await loadFinancialData();
      const hs = Math.max(1, parseInt(householdSize) || 1);
      let localAdjustedSavings = salary * (savingsPct / 100);
      let debtBudget = salary * (debtPct / 100);
      let expensesBudget = salary * (expensesPct / 100);
      let totalMinPayments = loans.reduce((sum, loan) => sum + loan.minPayment, 0);
      let totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const highInterestLoans = loans
        .filter(l => l.rate > 0)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 2)
        .map((l, idx) => `${l.name || `Loan ${idx+1}`} at ${l.rate}%`)
        .join(', ') || 'None >0%';
      let localAdjustedDebtBudget = debtBudget;
      let localAdjustedExpensesBudget = expensesBudget;
      let localAdjustedTotalExpenses = totalExpenses;
      let localAdjustedTotalMinPayments = totalMinPayments;
      let overageAdvice = '';
      const adjustments = [];
      const expenseAdjustMap = new Map();
      const baseMinPerPerson = 1000;
      const nonEssentialMinPerPerson = 500;
      const householdFactor = 1 + (hs - 1) * 0.2;
      const minEssentialPerPerson = baseMinPerPerson * householdFactor;
      const minNonEssentialPerPerson = nonEssentialMinPerPerson * householdFactor;
      let totalAdjustedOutgo = localAdjustedTotalMinPayments + localAdjustedTotalExpenses + localAdjustedSavings;
      let iteration = 0;
      const maxIterations = 5;
      let deficit = totalAdjustedOutgo - salary;
      while (deficit > 0 && iteration < maxIterations) {
        let debtOverage = localAdjustedTotalMinPayments > localAdjustedDebtBudget ? localAdjustedTotalMinPayments - localAdjustedDebtBudget : 0;
        if (debtOverage > 0) {
          localAdjustedDebtBudget = localAdjustedTotalMinPayments;
          let coveredFromExpenses = 0;
          const nonEssentialExpenses = expenses.filter(exp => !exp.isEssential);
          nonEssentialExpenses.forEach(exp => {
            const minPerPerson = exp.name.toLowerCase().includes('shopping') || exp.name.toLowerCase().includes('food') ? minEssentialPerPerson : minNonEssentialPerPerson;
            const maxCut = Math.max(0, exp.amount - (minPerPerson * hs));
            const cut = Math.min(maxCut * 0.3, debtOverage - coveredFromExpenses);
            if (cut > 0) {
              coveredFromExpenses += cut;
              expenseAdjustMap.set(exp.name || `Expense ${expenses.indexOf(exp) + 1}`, exp.amount - cut);
              adjustments.push({
                category: exp.name || `Expense ${expenses.indexOf(exp) + 1}`,
                current: exp.amount,
                adjusted: exp.amount - cut,
                suggestion: `Reduced by ${currency} ${cut.toLocaleString()} (up to 30% of excess) to cover debt shortfall, preserving ${currency} ${(minPerPerson * hs).toLocaleString()} minimum for monthly needs`
              });
            }
          });
          localAdjustedTotalExpenses -= coveredFromExpenses;
          const remainingOverage = debtOverage - coveredFromExpenses;
          if (remainingOverage > 0) {
            const cutFromSavings = Math.min(remainingOverage, localAdjustedSavings * 0.3);
            localAdjustedSavings = Math.max(salary * (hs <= 2 ? 0.05 : 0.03), localAdjustedSavings - cutFromSavings);
            adjustments.push({
              category: 'Savings Adjustment for Debt',
              current: localAdjustedSavings + cutFromSavings,
              adjusted: localAdjustedSavings,
              suggestion: `Temporarily reduced by ${currency} ${cutFromSavings.toLocaleString()} to cover debt; restore full 10% next month to build savings`
            });
          }
          overageAdvice += `Debt overage covered: ${currency} ${coveredFromExpenses.toLocaleString()} from expenses. `;
        }
        let cutAmount = 0;
        if (localAdjustedTotalExpenses > expensesBudget) {
          const expOverage = localAdjustedTotalExpenses - expensesBudget;
          const nonEssentialExpenses = expenses.filter(exp => !exp.isEssential).sort((a, b) => b.amount - a.amount);
          nonEssentialExpenses.forEach(exp => {
            const minPerPerson = exp.name.toLowerCase().includes('shopping') || exp.name.toLowerCase().includes('food') ? minEssentialPerPerson : minNonEssentialPerPerson;
            const maxCut = Math.max(0, (expenseAdjustMap.get(exp.name || `Expense ${expenses.indexOf(exp) + 1}`) || exp.amount) - (minPerPerson * hs));
            const cut = Math.min(maxCut * 0.3, expOverage - cutAmount);
            if (cut > 0) {
              cutAmount += cut;
              expenseAdjustMap.set(exp.name || `Expense ${expenses.indexOf(exp) + 1}`, (expenseAdjustMap.get(exp.name || `Expense ${expenses.indexOf(exp) + 1}`) || exp.amount) - cut);
              adjustments.push({
                category: exp.name || `Expense ${expenses.indexOf(exp) + 1}`,
                current: exp.amount,
                adjusted: (expenseAdjustMap.get(exp.name || `Expense ${expenses.indexOf(exp) + 1}`) || exp.amount) - cut,
                suggestion: `Reduced by ${currency} ${cut.toLocaleString()} (up to 30% of excess) to fit 70% expenses allocation, ensuring ${currency} ${(minPerPerson * hs).toLocaleString()} minimum for monthly needs`
              });
            }
          });
          localAdjustedTotalExpenses = Math.max(0, localAdjustedTotalExpenses - cutAmount);
          localAdjustedExpensesBudget = localAdjustedTotalExpenses;
          overageAdvice += `Expense cuts saved ${currency} ${cutAmount.toLocaleString()}. `;
        }
        if (deficit > 0) {
          const remainingNonEssentials = expenses.filter(exp => !exp.isEssential && (expenseAdjustMap.get(exp.name || `Expense ${expenses.indexOf(exp) + 1}`) || exp.amount) > (minNonEssentialPerPerson * hs));
          let extraCutNeeded = deficit;
          remainingNonEssentials.forEach(exp => {
            const currentAmount = expenseAdjustMap.get(exp.name || `Expense ${expenses.indexOf(exp) + 1}`) || exp.amount;
            const extraCut = Math.min(currentAmount * 0.2, extraCutNeeded);
            if (extraCut > 0) {
              expenseAdjustMap.set(exp.name || `Expense ${expenses.indexOf(exp) + 1}`, currentAmount - extraCut);
              localAdjustedTotalExpenses -= extraCut;
              extraCutNeeded -= extraCut;
              adjustments.push({
                category: `Balance Cut - ${exp.name || `Expense ${expenses.indexOf(exp) + 1}`}`,
                current: currentAmount,
                adjusted: currentAmount - extraCut,
                suggestion: `Additional reduction of ${currency} ${extraCut.toLocaleString()} (20% of current) to eliminate deficit and reflect earnings in budget`
              });
            }
          });
        }
        if (deficit > 0) {
          const savingsCut = Math.min(deficit, localAdjustedSavings - (salary * (hs <= 2 ? 0.05 : 0.03)));
          localAdjustedSavings = Math.max(salary * (hs <= 2 ? 0.05 : 0.03), localAdjustedSavings - savingsCut);
          if (savingsCut > 0) {
            adjustments.push({
              category: 'Savings Adjustment for Deficit',
              current: localAdjustedSavings + savingsCut,
              adjusted: localAdjustedSavings,
              suggestion: `Further reduced by ${currency} ${savingsCut.toLocaleString()} to eliminate deficit; maintain min allocation to start building emergency fund`
            });
          }
        }
        totalAdjustedOutgo = localAdjustedTotalMinPayments + localAdjustedTotalExpenses + localAdjustedSavings;
        deficit = totalAdjustedOutgo - salary;
        iteration++;
      }
      setAdjustedSavings(localAdjustedSavings);
      setAdjustedTotalExpenses(localAdjustedTotalExpenses);
      setAdjustedTotalMinPayments(localAdjustedTotalMinPayments);
      adjustments.push({
        category: 'Total Debt Min Payments',
        current: totalMinPayments,
        adjusted: localAdjustedTotalMinPayments,
        suggestion: `Fully allocated within 20% debt budget; pay minimums now to recover from debts faster`
      });
      adjustments.push({
        category: 'Total Expenses',
        current: totalExpenses,
        adjusted: localAdjustedTotalExpenses,
        suggestion: `Adjusted down by ${currency} ${(totalExpenses - localAdjustedTotalExpenses).toLocaleString()} to fit 70% allocation and sustain monthly needs within earnings`
      });
      const spareCash = Math.max(0, salary - totalAdjustedOutgo);
      if (totalAdjustedOutgo > salary * 0.95) {
        localAdjustedSavings = Math.max(localAdjustedSavings, salary * (hs <= 2 ? 0.05 : 0.03));
        setAdjustedSavings(localAdjustedSavings);
        overageAdvice += `Enforced ${hs <= 2 ? 5 : 3}% savings (${currency} ${localAdjustedSavings.toLocaleString()}). `;
      }
      const { months: snowMonths, totalInterest: snowInterest } = snowball(loans, localAdjustedDebtBudget);
      const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, localAdjustedDebtBudget);
      let adviceText = loans.length === 0
        ? `No loans entered. Allocate at least ${hs <= 2 ? 20 : 15}% of salary to savings and low-risk investments like MMFs to build stability.`
        : `${avaInterest < snowInterest ? 'Avalanche method recommended to minimize interest.' : 'Snowball method for quick wins.'} Focus on ${highInterestLoans} for payoff priority.`;
      adviceText += `<br><br>With ${salary.toLocaleString()} ${currency} monthly salary, prioritize high-interest debt repayment for financial stability. Review non-essential expenses and reduce by ~${Math.min(20, 25 - hs)}% (potential savings: ${currency} ${(totalExpenses * (0.25 - hs * 0.01)).toLocaleString()}) to align with needs.`;
      let deficitAdvice = '';
      if (deficit > 0) {
        const deficitRatio = deficit / salary;
        let actionPlan = '';
        const ideas = hs > 2 ? ['group tutoring or skill-sharing service', 'family-based resale of goods', 'community freelance tasks', 'shared gig economy roles like delivery', 'home-based online store'] : ['personal tutoring', 'online freelancing', 'part-time resale', 'delivery gigs', 'skill-based services'];
        const selectedIdea = ideas[Math.floor(Math.random() * ideas.length)];
        if (deficitRatio < 0.1) {
          actionPlan = `This minor shortfall can be addressed by trimming discretionary spending further or taking on a quick side gig like ${selectedIdea}, aiming for ${currency} ${Math.ceil(deficit / hs).toLocaleString()}/person monthly.`;
        } else if (deficitRatio < 0.3) {
          actionPlan = `For this moderate gap, launch a collaborative ${selectedIdea} to generate steady extra income, targeting ${currency} ${Math.ceil(deficit / hs).toLocaleString()}/person to bridge it quickly.`;
        } else {
          actionPlan = `This significant shortfall requires immediate action: Negotiate with creditors for lower payments, seek free financial counseling from local resources, and initiate a ${selectedIdea} while cutting non-essentials aggressively to ${currency} ${Math.ceil(deficit / hs).toLocaleString()}/person target.`;
        }
        deficitAdvice = `<br><br>Shortfall of ${currency} ${deficit.toLocaleString()}. ${actionPlan}`;
        adviceText += deficitAdvice;
      } else if (spareCash > 0) {
        adviceText += `<br><br>Surplus of ${currency} ${spareCash.toLocaleString()}. Direct it to accelerate debt payoff or low-risk investments like bonds for compounded growth.`;
      }
      adviceText += `<br><br>Total monthly outflow: ${currency} ${totalAdjustedOutgo.toLocaleString()} vs Salary ${currency} ${salary.toLocaleString()}.`;
      const monthlyExpensesForEmergency = Math.max(localAdjustedTotalExpenses, (minEssentialPerPerson * hs * expenses.length) / 2);
      const threeMonthTarget = Math.max(emergencyTarget, monthlyExpensesForEmergency * 3 * householdFactor);
      const monthsToEmergency = localAdjustedSavings > 0 ? Math.ceil((threeMonthTarget - currentSavings) / localAdjustedSavings) : 0;
      const thisMonthAdd = Math.min(spareCash, 1000 * hs);
      adviceText += `<br><br>Emergency Fund: Target ${currency} ${threeMonthTarget.toLocaleString()} (3 months of expenses, scaled for household). Current: ${currency} ${currentSavings.toLocaleString()}. Projected reach: ~${monthsToEmergency} months. Contribute ${currency} ${thisMonthAdd.toLocaleString()} this month to a SACCO.`;
      const saccoRec = finData.saccos[0].name;
      const bondYield = finData.bonds['10Y'];
      const mmfRec = finData.mmfs[0].name;
      const mmfYield = finData.mmfs[0].net;
      adviceText += `<br><br><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Kenya.svg/16px-Flag_of_Kenya.svg.png?20221128225827" alt="Flag of Kenya" style="width: 16px; height: 12px; vertical-align: middle;" /> Kenyan Investment Options: SACCOs (${finData.saccos.map(s => `${s.name} ~${s.dividend}% - ${s.note}`).join(', ')}). Bonds: 10Y ~${bondYield}%; T-Bills ~${finData.bonds.tBills['91-day']}% to ${finData.bonds.tBills['364-day']}% (91-364 days). MMFs: ${finData.mmfs.map(m => `${m.name} (${m.net || m.gross}% - ${m.note})`).join(', ')}. Consider starting with ${mmfRec} at ${mmfYield}% for liquidity and growth.`;
      adviceText += `<br><br>Bank Call Deposits: Flexible, low-risk for liquidity. ${finData.callDeposits.map(d => `${d.name} (${d.rate}% p.a., min ${currency} ${(d.minInvestment * Math.min(hs, 3)).toLocaleString()} - ${d.note})`).join('; ')}.`;
      const plan = [];
      let totalPlan = 0;
      const sortedLoans = [...loans].sort((a, b) => b.rate - a.rate).filter(l => l.minPayment > 0);
      const extraForDebt = Math.max(0, localAdjustedDebtBudget - totalMinPayments);
      const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, localAdjustedDebtBudget);
      sortedLoans.forEach((loan, idx) => {
        const minPay = loan.minPayment;
        const extraPay = idx === 0 ? extraForDebt : 0;
        const totalPay = minPay + extraPay;
        const loanNotes = `Pay ${currency} ${totalPay.toLocaleString()} this month (${minPay.toLocaleString()} min + ${extraPay.toLocaleString()} extra). At this rate, full payoff in ${avaMonths} months, saving ${currency} ${avaInterest.toLocaleString()} in interest. Focus here to recover from debt.`;
        plan.push({
          category: 'Loan',
          subcategory: loan.name || `Loan ${idx + 1}`,
          priority: idx + 1,
          budgeted: totalPay,
          notes: loanNotes
        });
        totalPlan += totalPay;
      });
      expenses.forEach((exp, idx) => {
        const adjAmount = expenseAdjustMap.get(exp.name || `Expense ${idx + 1}`) || exp.amount;
        let expNotes = '';
        if (exp.name.toLowerCase().includes('shopping') || exp.name.toLowerCase().includes('food')) {
          expNotes = `Allocate ${currency} ${adjAmount.toLocaleString()}; plan weekly bulk buys at market to stretch budget and control spending.`;
        } else if (exp.name.toLowerCase().includes('rent')) {
          expNotes = `Pay ${currency} ${adjAmount.toLocaleString()}; negotiate with landlord if possible to reduce future costs.`;
        } else if (exp.name.toLowerCase().includes('fee') || exp.name.toLowerCase().includes('transport')) {
          expNotes = `Budget ${currency} ${adjAmount.toLocaleString()}; use public options or carpool to minimize.`;
        } else {
          expNotes = `Set aside ${currency} ${adjAmount.toLocaleString()}; track usage weekly to ensure it fits within 70% expenses goal.`;
        }
        if (!exp.isEssential) {
          expNotes += ` Monitor closely to free up more for debt recovery.`;
        }
        plan.push({
          category: 'Expense',
          subcategory: exp.name || `Expense ${idx + 1}`,
          priority: exp.isEssential ? 'Essential' : 'Non-Essential',
          budgeted: adjAmount,
          notes: expNotes
        });
        totalPlan += adjAmount;
      });
      const savingsNotes = `Transfer ${currency} ${localAdjustedSavings.toLocaleString()} immediately to a SACCO or MMF (e.g., Madison at 11%) to start your savings journey and build toward emergency fund.`;
      plan.push({
        category: 'Savings',
        subcategory: 'Emergency/Investments',
        priority: 'N/A',
        budgeted: localAdjustedSavings,
        notes: savingsNotes
      });
      totalPlan += localAdjustedSavings;
      const finalTotalPlanned = localAdjustedSavings + localAdjustedTotalExpenses + localAdjustedTotalMinPayments;
      const finalDeficit = finalTotalPlanned - salary;
      if (finalDeficit > 0) {
        const deficitRatio = finalDeficit / salary;
        let actionPlan = '';
        const ideas = hs > 2 ? ['group tutoring or skill-sharing service', 'family-based resale of goods', 'community freelance tasks', 'shared gig economy roles like delivery', 'home-based online store'] : ['personal tutoring', 'online freelancing', 'part-time resale', 'delivery gigs', 'skill-based services'];
        const selectedIdea = ideas[Math.floor(Math.random() * ideas.length)];
        if (deficitRatio < 0.1) {
          actionPlan = `Minor shortfall – trim spending or quick gig like ${selectedIdea}, target ${currency} ${Math.ceil(finalDeficit / hs).toLocaleString()}/person.`;
        } else if (deficitRatio < 0.3) {
          actionPlan = `Moderate gap – launch ${selectedIdea} for extra income, aim ${currency} ${Math.ceil(finalDeficit / hs).toLocaleString()}/person.`;
        } else {
          actionPlan = `Significant gap – negotiate debts, seek counseling, start ${selectedIdea} targeting ${currency} ${Math.ceil(finalDeficit / hs).toLocaleString()}/person.`;
        }
        plan.push({
          category: 'Deficit',
          subcategory: 'Overall Shortfall',
          priority: 'Alert',
          budgeted: finalDeficit,
          notes: `Monthly shortfall of ${currency} ${finalDeficit.toLocaleString()}. ${actionPlan} Reassess next month.`
        });
      } else {
        const surplusNotes = `Apply ${currency} ${Math.max(0, salary - finalTotalPlanned).toLocaleString()} surplus: ${extraForDebt > 0 ? 'First to debt extra payments' : ''}, then to savings or low-risk MMF to accelerate debt recovery and savings growth.`;
        plan.push({
          category: 'Surplus',
          subcategory: 'Spare Cash',
          priority: 'Opportunity',
          budgeted: Math.max(0, salary - finalTotalPlanned),
          notes: surplusNotes
        });
      }
      setPlanData(plan);
      let aiTip = '';
      if (enableAI) {
        aiTip = await getFreeAIAdvice({
          salary, debtBudget: localAdjustedDebtBudget, totalExpenses: localAdjustedTotalExpenses, loans, expenses, householdSize: hs,
          suggestedCuts: adjustments.map(adj => `${adj.category}: ${adj.suggestion}`).join('; '), savings: localAdjustedSavings, highInterestLoans
        }, finData);
        adviceText += `<br><br>AI-Generated Insights:<br>${aiTip}`;
      }
      const annualRate = finData.mmfs[0].net / 100;
      const monthlyRate = annualRate / 12;
      const years = 5;
      const monthlySavingsAdjusted = localAdjustedSavings / Math.max(1, hs);
      const futureValue = monthlySavingsAdjusted * ((Math.pow(1 + monthlyRate, 12 * years) - 1) / monthlyRate);
      adviceText += `<br><br>Compounding Example: Investing ${currency} ${monthlySavingsAdjusted.toLocaleString()} monthly (total ${currency} ${localAdjustedSavings.toLocaleString()}) at ${finData.mmfs[0].net}% in ${mmfRec} could grow to ${currency} ${futureValue.toLocaleString()} over 5 years.`;
      const curesProgress = [
        `1. <strong>Start thy purse to fattening</strong>: ${savingsPct >= (hs <= 2 ? 10 : 8) ? `✅ Met - Saving ${savingsPct}%` : `<span style="color:red">❌ Not met</span> - Aim for ${hs <= 2 ? 10 : 8}%`}`,
        `2. <strong>Control thy expenditures</strong>: ${localAdjustedTotalExpenses <= expensesBudget ? `✅ Met - Budget aligned` : `<span style="color:red">❌ Not met</span> - Cut non-essentials`}`,
        `3. <strong>Make thy gold multiply</strong>: ${spareCash > 0 ? `✅ Met - Surplus available` : `<span style="color:red">❌ Not met</span> - Create surplus`}`,
        `4. <strong>Guard thy treasures from loss</strong>: ✅ Met - Safe investments prioritized`,
        `5. <strong>Make thy home a worthwhile investment</strong>: <span style="color:red">❌ Pending</span> - Explore SACCO mortgages`,
        `6. <strong>Ensure a future income</strong>: ${monthsToEmergency < 12 ? `✅ Met - Emergency fund building` : `<span style="color:red">❌ Not met</span> - Build fund`}`,
        `7. <strong>Increase thy ability to earn</strong>: <span style="color:red">❌ Pending</span> - Develop side income`
      ];
      adviceText += `<br><br>--- The Seven Cures for a Lean Purse ---<br>${curesProgress.join('<br>')}`;
      adviceText += `<br><br><strong>Home Ownership</strong>: Consider SACCO mortgages (e.g., ${saccoRec} at ~10%) to build long-term wealth.`;
      adjustments.push({
        category: 'Savings',
        current: localAdjustedSavings,
        adjusted: localAdjustedSavings,
        suggestion: `Allocated ${currency} ${localAdjustedSavings.toLocaleString()} (min ${hs <= 2 ? 5 : 3}%). Prioritize emergency fund, then investments.`
      });
      adjustments.push({
        category: 'Spare',
        current: 0,
        adjusted: spareCash,
        suggestion: spareCash > 0 ? `Surplus ${currency} ${spareCash.toLocaleString()}; invest for growth` : `No surplus; focus on balance`
      });
      setAdvice(adviceText);
      setAdjustedData(adjustments);
      setEmergencyTarget(threeMonthTarget);
      const updatedCurrentSavings = currentSavings + localAdjustedSavings;
      const historyEntry = {
        month: new Date().toISOString().slice(0, 7),
        salary, savings: localAdjustedSavings, debtBudget: localAdjustedDebtBudget, expensesBudget: localAdjustedTotalExpenses,
        totalExpenses: localAdjustedTotalExpenses, snowMonths, snowInterest, avaMonths, avaInterest,
        emergencyTarget: threeMonthTarget, currentSavings: updatedCurrentSavings, adjustments: overageAdvice, householdSize: hs
      };
      setCurrentSavings(updatedCurrentSavings);
      setBudgetHistory(prev => [...prev, historyEntry]);
      const pieLabels = ['Savings', 'Debt', 'Expenses'];
      const pieDataValues = [localAdjustedSavings, localAdjustedDebtBudget, localAdjustedExpensesBudget];
      const pieColors = ['#4CAF50', '#FF5722', '#2196F3'];
      if (spareCash > 0) {
        pieLabels.push('Spare Cash');
        pieDataValues.push(spareCash);
        pieColors.push('#FFC107');
      }
      const pieData = {
        labels: pieLabels,
        datasets: [{ data: pieDataValues, backgroundColor: pieColors }]
      };
      setChartData(pieData);
      setDisplaySalary(salary);
      setSalary(0);
      setLoans([]);
      setExpenses([]);
    } catch (error) {
      console.error('Calculate Error:', error);
      alert(`Calc failed: ${error.message}. Check console. Try disabling AI.`);
    }
  }, [salary, savingsPct, debtPct, expensesPct, householdSize, currency, loans, expenses, emergencyTarget, currentSavings, enableAI, budgetHistory, snowball, avalanche, getFreeAIAdvice, loadFinancialData]);
  const handleDownloadPDF = useCallback(() => {
    try {
      const hs = Math.max(1, parseInt(householdSize) || 1);
      const finData = financialData || {
        saccos: [{ name: 'Tower SACCO', dividend: 20 }],
        bonds: { '10Y': 13.46 },
        mmfs: [{ name: 'Madison MMF', net: 11.0 }],
        callDeposits: [{ name: 'KCB Bank', rate: 7.0, minInvestment: 300000 }]
      };
      const totalAdjustedOutgo = adjustedSavings + adjustedTotalExpenses + adjustedTotalMinPayments;
      const { months: snowMonths, totalInterest: snowInterest } = snowball(loans, adjustedTotalMinPayments);
      const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, adjustedTotalMinPayments);
      const threeMonthTarget = emergencyTarget;
      const saccoRec = finData.saccos[0].name;
      const bondYield = finData.bonds['10Y'];
      const mmfRec = finData.mmfs[0].name;
      const mmfYield = finData.mmfs[0].net;
      const annualRate = mmfYield / 100;
      const monthlyRate = annualRate / 12;
      const years = 5;
      const monthlySavingsAdjusted = adjustedSavings / Math.max(1, hs);
      const futureValue = monthlySavingsAdjusted * ((Math.pow(1 + monthlyRate, 12 * years) - 1) / monthlyRate);
      let aiTip = advice.split('AI-Generated Insights')[1]?.split('<br>')[0] || '';
      const doc = new jsPDF();
      let yPos = 10;
      doc.setFontSize(12);
      doc.text(`Budget Report - Salary ${currency} ${displaySalary.toLocaleString()} (Household: ${hs})`, 10, yPos);
      yPos += 10;
      doc.setFontSize(10);
      doc.text(`Allocation: ${Math.round(adjustedSavings / displaySalary * 100)}% Savings, ${Math.round(adjustedTotalMinPayments / displaySalary * 100)}% Debt, ${Math.round(adjustedTotalExpenses / displaySalary * 100)}% Expenses`, 10, yPos);
      yPos += 7;
      doc.text(`Snowball: ${snowMonths} mo, Interest ${currency} ${snowInterest.toLocaleString()}`, 10, yPos);
      yPos += 7;
      doc.text(`Avalanche: ${avaMonths} mo, Interest ${currency} ${avaInterest.toLocaleString()}`, 10, yPos);
      yPos += 7;
      doc.text(`Emergency: ${currency} ${threeMonthTarget.toLocaleString()} (3 mo)`, 10, yPos);
      yPos += 7;
      doc.text(`Invest: ${saccoRec} ${finData.saccos[0].dividend}%, Bonds ${bondYield}%, ${mmfRec} ${mmfYield}%`, 10, yPos);
      yPos += 10;
      doc.text(`5-Yr Projection: ${currency} ${futureValue.toLocaleString()}`, 10, yPos);
      yPos += 7;
      if (aiTip) {
        doc.text(`AI Tip: ${aiTip.substring(0, 80)}...`, 10, yPos);
        yPos += 7;
      }
      doc.text('Monthly Plan Summary:', 10, yPos);
      yPos += 7;
      planData?.slice(0, 8).forEach((item) => {
        if (yPos > 270) { doc.addPage(); yPos = 10; }
        doc.text(`${item.subcategory}: ${currency} ${item.budgeted.toLocaleString()} - ${item.notes.substring(0, 40)}`, 10, yPos);
        yPos += 7;
      });
      const finalDeficit = adjustedSavings + adjustedTotalExpenses + adjustedTotalMinPayments - displaySalary;
      if (finalDeficit > 0) {
        doc.text(`Deficit Alert: ${currency} ${finalDeficit.toLocaleString()} - See advice above.`, 10, yPos);
        yPos += 7;
      }
      doc.text('Adjustments:', 10, yPos);
      yPos += 7;
      adjustedData?.slice(0, 6).forEach((adj) => {
        if (yPos > 270) { doc.addPage(); yPos = 10; }
        doc.text(`${adj.category}: ${adj.current.toLocaleString()} -> ${adj.adjusted.toLocaleString()} - ${adj.suggestion.substring(0, 40)}`, 10, yPos);
        yPos += 7;
      });
      doc.text('Key Advice: Pay thyself first. Cut desires. Invest wisely.', 10, yPos);
      doc.save('budget_report.pdf');
    } catch (error) {
      console.error('PDF Error:', error);
      alert('PDF generation failed. Check console.');
    }
  }, [householdSize, currency, displaySalary, financialData, adjustedSavings, adjustedTotalExpenses, adjustedTotalMinPayments, snowball, avalanche, loans, emergencyTarget, advice, planData, adjustedData, budgetHistory]);
  const downloadHistory = useCallback(() => {
    const csv = 'Month,Salary,Savings,Debt Budget,Expenses Budget,Total Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Current Savings,Adjustments,Household Size\n' +
      budgetHistory.map(entry => `${entry.month},${entry.salary},${entry.savings},${entry.debtBudget},${entry.expensesBudget},${entry.totalExpenses},${entry.snowMonths},${entry.snowInterest},${entry.avaMonths},${entry.avaInterest},${entry.emergencyTarget},${entry.currentSavings},"${entry.adjustments || ''}",${entry.householdSize || 1}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_history.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }, [budgetHistory]);
  const clearHistory = useCallback(() => {
    setBudgetHistory([]);
    setCurrentSavings(0);
    localStorage.removeItem('budgetHistory');
  }, []);
  const historyData = {
    labels: budgetHistory.map(entry => entry.month).reverse(),
    datasets: [
      { label: 'Debt Budget', data: budgetHistory.map(entry => entry.debtBudget).reverse(), borderColor: 'rgb(244, 67, 54)', backgroundColor: 'rgba(244, 67, 54, 0.2)', tension: 0.1 },
      { label: 'Expenses', data: budgetHistory.map(entry => entry.totalExpenses).reverse(), borderColor: 'rgb(76, 175, 80)', backgroundColor: 'rgba(76, 175, 80, 0.2)', tension: 0.1 }
    ]
  };
  return (
    <div className="app-container">
      <header className="header">
        <h1>Budget & Debt Coach App</h1>
        <p style={{ color: '#555' }}>Plan your financial future with wisdom and discipline</p>
      </header>
      {currentQuote && (
        <div className="quote-box golden-quote" title="Daily financial wisdom to guide your journey">
          <strong>{currentQuote.text} - {currentQuote.author}</strong>
        </div>
      )}
      {showInstallPrompt && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1B263B',
            color: '#FFFFFF',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '500px',
            width: '90%',
            zIndex: 1000,
          }}
        >
          <span>Install Budget & Debt Coach App</span>
          <div>
            <button
              onClick={handleInstallClick}
              style={{
                backgroundColor: '#4CAF50',
                color: '#008080',
                border: '2px solid #000000',
                padding: '8px 16px',
                borderRadius: '4px',
                marginRight: '10px',
                cursor: 'pointer',
              }}
            >
              Install
            </button>
            <button
              onClick={handleDismissInstall}
              style={{
                backgroundColor: '#FF5722',
                color: '#FFFFFF',
                border: '2px solid #000000',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <section className="section input-section">
        <h2>Budget Settings</h2>
        <div className="input-group">
          <label title="Your total monthly income after taxes">Monthly Salary ({currency}):
            <input type="number" value={salary || 0} onChange={(e) => setSalary(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} className="input-field" />
          </label>
          <label title="Number of household members to scale monthly budget recommendations">Household Size:
            <input type="number" min="1" value={householdSize || ''} onChange={(e) => setHouseholdSize(e.target.value)} className="input-field" style={{ width: '80px' }} />
          </label>
          <label title="Select your preferred currency">Currency:
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
              <option value="NGN">NGN</option>
              <option value="ZAR">ZAR</option>
            </select>
          </label>
        </div>
        <label style={{ color: '#2E7D32' }} title="Adjust allocation percentages (must sum to 100%)">Customization (%):</label>
        <div className="slider-group">
          <div>
            <label>Savings: {savingsPct}% (Aim {householdSize <= 2 ? 10 : 8}%+)</label>
            <input type="range" min="0" max="50" value={savingsPct} onChange={(e) => updateSavingsPct(e.target.value)} className="slider" />
          </div>
          <div>
            <label>Debt: {debtPct}%</label>
            <input type="range" min="0" max="50" value={debtPct} onChange={(e) => updateDebtPct(e.target.value)} className="slider" />
          </div>
          <div>
            <label>Expenses: {expensesPct}%</label>
            <input type="range" min="0" max="100" value={expensesPct} onChange={(e) => updateExpensesPct(e.target.value)} className="slider" />
          </div>
        </div>
        <label title="Set a target for your emergency fund, scaled for household size">Emergency Target ({currency}):
          <input type="number" value={emergencyTarget || 0} onChange={(e) => setEmergencyTarget(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} className="input-field" />
        </label>
      </section>
      <section className="section input-section">
        <h2>Add Available Loans</h2>
        <div className="card-container">
          {loans.map((loan, i) => (
            <div key={`loan-${i}`} className="card">
              <h3>Loan {i+1}</h3>
              <label title="Name of the loan or creditor">Name:
                <input type="text" value={loan.name} onChange={(e) => updateLoan(i, 'name', e.target.value)} className="input-field" />
              </label>
              <label title="Current outstanding loan balance">Balance ({currency}):
                <input type="number" value={loan.balance || 0} onChange={(e) => updateLoan(i, 'balance', e.target.value)} onFocus={clearOnFocus} className="input-field" />
              </label>
              <label title="Annual interest rate (%)">Rate (%):
                <input type="number" step="0.1" value={loan.rate || 0} onChange={(e) => updateLoan(i, 'rate', e.target.value)} onFocus={clearOnFocus} className="input-field" />
              </label>
              <label title="Minimum monthly payment required">Min Payment ({currency}):
                <input type="number" value={loan.minPayment || 0} onChange={(e) => updateLoan(i, 'minPayment', e.target.value)} onFocus={clearOnFocus} className="input-field" />
              </label>
              <label title="Is this loan critical to maintain?">Essential?:
                <input type="checkbox" checked={loan.isEssential || false} onChange={() => toggleLoanEssential(i)} />
              </label>
            </div>
          ))}
        </div>
        <button onClick={addLoan} className="action-button small-button">Add Loan</button>
      </section>
      <section className="section input-section">
        <h2>Monthly Expenses</h2>
        <div className="card-container">
          {expenses.map((exp, i) => (
            <div key={`exp-${i}`} className="card">
              <h3>Expense {i+1}</h3>
              <label title="Name of the expense">Name:
                <input type="text" value={exp.name} onChange={(e) => updateExpense(i, 'name', e.target.value)} className="input-field" />
              </label>
              <label title="Monthly amount for this expense">Amount ({currency}):
                <input type="number" value={exp.amount || 0} onChange={(e) => updateExpense(i, 'amount', e.target.value)} onFocus={clearOnFocus} className="input-field" />
              </label>
              <label title="Is this expense critical for basic monthly needs?">Essential?:
                <input type="checkbox" checked={exp.isEssential || false} onChange={() => toggleExpenseEssential(i)} />
              </label>
            </div>
          ))}
        </div>
        <button onClick={addExpense} className="action-button small-button">Add Expense</button>
      </section>
      <section className="section">
        <h2>Actions</h2>
        <label title="Enable AI-driven financial advice tailored for your household">Enable Free AI Advice:
          <input type="checkbox" checked={enableAI} onChange={(e) => setEnableAI(e.target.checked)} />
        </label>
        <div className="button-group">
          <button onClick={handleCalculate} className="action-button primary-button" title="Generate your personalized monthly budget plan">Calculate & Generate Plan</button>
          <button onClick={handleDownloadPDF} className="action-button secondary-button" title="Download the monthly budget report as PDF">Download PDF Report</button>
          <button onClick={downloadHistory} className="action-button secondary-button" title="Download your budget history as a CSV file">Download History CSV</button>
          <button onClick={clearHistory} className="action-button secondary-button" title="Clear all budget history">Clear History</button>
        </div>
      </section>
      {adjustedData && adjustedData.length > 0 && (
        <section className="section">
          <h2>Adjusted Monthly Plan Table</h2>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Category</th><th>Current ({currency})</th><th>Adjusted ({currency})</th><th>Suggestion</th></tr></thead>
              <tbody>{adjustedData.map((adj, i) => (
                <tr key={i}><td>{adj.category}</td><td>{adj.current.toLocaleString()}</td><td>{adj.adjusted.toLocaleString()}</td><td>{adj.suggestion}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
      {planData && planData.length > 0 && (
        <section className="section">
          <h2>Monthly Payment Plan</h2>
          <p style={{ color: '#388E3C' }}>Your optimized monthly plan, prioritizing debt and essentials.</p>
          <div className="table-container">
            <table className="table">
              <thead><tr>
                <th>Category</th>
                <th>Item</th>
                <th>Priority</th>
                <th>Budgeted ({currency})</th>
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
          </div>
          <p style={{ color: '#388E3C', fontWeight: 'bold' }}><strong>Total Planned: {currency} {(adjustedSavings + adjustedTotalExpenses + adjustedTotalMinPayments).toLocaleString()}</strong> vs Salary {currency} {displaySalary.toLocaleString()}</p>
        </section>
      )}
      {chartData && (
        <section className="section">
          <h2>Monthly Allocation Chart</h2>
          <div className="chart-container">
            <Pie data={chartData} />
          </div>
        </section>
      )}
      {advice && (
        <section className="section">
          <h2>Financial Advice</h2>
          <div className="advice-box" dangerouslySetInnerHTML={{ __html: advice }} />
        </section>
      )}
      <section className="section">
        <h2>History</h2>
        <div className="chart-container">
          <Line data={historyData} />
        </div>
        <ul className="history-list">
          {budgetHistory.map((entry, i) => (
            <li key={i} className="history-item">
              <strong>{entry.month}:</strong> Salary {currency} {entry.salary.toLocaleString()}, Savings {currency} {entry.savings.toLocaleString()}, Debt {currency} {entry.debtBudget.toLocaleString()}, Expenses {currency} {entry.totalExpenses.toLocaleString()} {entry.adjustments ? `(Adjusts: ${entry.adjustments})` : ''} (Household: {entry.householdSize || 1})
            </li>
          ))}
        </ul>
      </section>
      <section className="section progress-section">
        <h2>Fund Progress</h2>
        <p>Current Savings: {currency} {currentSavings.toLocaleString()} / {currency} {emergencyTarget.toLocaleString()}</p>
        <progress value={currentSavings} max={emergencyTarget || 1} className="progress-bar" />
      </section>
      <footer className="footer">
        <p>Recover from debts, enhance savings, invest & budget wisely. For enquiries:
        <a href="https://x.com/B_D_coach_app" target="_blank" rel="noopener noreferrer" className="footer-link" title="Follow on X">
  <svg width="24" height="24" className="footer-icon x-icon" viewBox="0 0 24 24">
    <path fill="#fff" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933zM16.61 20.644h2.039L7.486 3.24H5.396l11.214 17.404z"/>
  </svg>
</a> ||
          <a href="https://wa.me/254705245123" target="_blank" rel="noopener noreferrer" className="footer-link" title="Contact via WhatsApp">
  <svg width="24" height="24" className="footer-icon whatsapp-icon" viewBox="0 0 16 16">
    <path fill="#fff" d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z"/>
    <path fill="#fff" d="M5.434 9.176a1.144 1.144 0 0 1-.365-.246c-.08-.07-.152-.162-.224-.265a.51.51 0 0 1-.09-.168.618.618 0 0 1-.037-.208.384.384 0 0 1-.004-.083.568.568 0 0 1 .082-.266c.032-.046.069-.092.115-.138.077-.077.166-.168.272-.256a.434.434 0 0 1 .18-.11c.106-.037.215-.055.328-.055.215 0 .39.062.525.185.136.12.235.297.297.531.062.235.062.483 0 .74a.925.925 0 0 1-.22.457c-.12.162-.284.288-.49.378-.205.09-.431.135-.678.135-.247 0-.48-.045-.698-.135-.218-.09-.408-.216-.57-.378-.162-.162-.288-.35-.378-.57-.09-.217-.135-.45-.135-.697 0-.247.045-.48.135-.698a.925.925 0 0 1 .378-.57c.162-.162.35-.288.57-.378.217-.09.45-.135.698-.135.247 0 .48.045.698.135a.925.925 0 0 1 .57.378c.162.162.288.35.378.57.09.217.135.45.135.698s-.045.48-.135.698a.925.925 0 0 1-.378.57c-.162.162-.35.288-.57.378a.925.925 0 0 1-.698.135z"/>
  </svg>
          </a> ||
          <a href="https://www.tiktok.com/@budget_and_debt_coach" target="_blank" rel="noopener noreferrer" className="footer-link" title="Follow on TikTok">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="footer-icon tiktok-icon" viewBox="0 0 16 16">
              <path fill="#000000" d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/>
            </svg>
          </a>
        </p>
      </footer>
    </div>
  );
}
export default App;
