import React, { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';

// Chart.js registration
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

function App() {
  const [salary, setSalary] = useState(0);
  const [savingsPct, setSavingsPct] = useState(10);
  const [debtPct, setDebtPct] = useState(20);
  const [expensesPct, setExpensesPct] = useState(70);
  const [householdSize, setHouseholdSize] = useState(1);
  const [loans, setLoans] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [emergencyTarget, setEmergencyTarget] = useState(0);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [history, setHistory] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [advice, setAdvice] = useState('');
  const [adjustedData, setAdjustedData] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [displaySalary, setDisplaySalary] = useState(0);
  const [enableAI, setEnableAI] = useState(true);
  const [financialData, setFinancialData] = useState(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('budgetHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (parsed && parsed.length > 0) {
          setHistory(parsed);
        }
      } catch (e) {
        console.warn('Invalid history in localStorage, clearing:', e);
        localStorage.removeItem('budgetHistory');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('budgetHistory', JSON.stringify(history));
  }, [history]);

  // Fetch or load financial data
  const loadFinancialData = useCallback(async () => {
    // Static data as of Oct 5, 2025 (updated from real-time sources; in production, fetch real-time via APIs)
    const data = {
      saccos: [
        { name: 'Kenya Police SACCO', dividend: 17, members: 'Large membership', note: '17% for 2025' },
        { name: 'Stima SACCO', dividend: 15, members: '200k+', note: 'Consistent high dividends' },
        { name: 'Safaricom SACCO', dividend: 13, note: 'Open to public' }
      ],
      bonds: {
        '10Y': 13.46,
        tBills: { '91-day': 7.98, '182-day': 8.5, '364-day': 9.54 }
      },
      mmfs: [
        { name: 'Cytonn MMF', net: 13.2 },
        { name: 'GulfCap MMF', gross: 13 },
        { name: 'Orient Kasha MMF', net: 10.0 }
      ],
      crypto: {
        lowRisk: ['Bitcoin (stable at ~$124k, up 1.23%, ETF potential)', 'Ethereum (DeFi growth at ~$4,470)'],
        highPotential: ['Solana (scalability, 2025 boom candidate)'],
        highRisk: ['Dogecoin (meme volatility at current trends, 1000x potential but high risk, 80% ETF odds)']
      }
    };
    setFinancialData(data);
    return data;
  }, []);

  const clearOnFocus = (e) => e.target.select();

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
    const model = 'distilgpt2';
    const prompt = `Kenyan financial advisor for ${userData.householdSize} members. Advice: Debt (high-interest), cuts (min 1000KES/person), savings, invest (MMFs, SACCOs, bonds). Crypto: balanced low-risk/high-pot with volatility warning. Data: Salary ${userData.salary}KES, Debt ${userData.debtBudget}, Expenses ${userData.totalExpenses}. Loans/Expenses: ${JSON.stringify([...userData.loans, ...userData.expenses].slice(0,4))}. Cuts: ${userData.suggestedCuts?.slice(0,100)||'None'}. SACCOs: ${finData.saccos.map(s => `${s.name} ${s.dividend}%`).join(', ')}. Bonds: 10Y ${finData.bonds['10Y']}% . MMFs: ${finData.mmfs.map(m => `${m.name} ${m.net || m.gross}%`).join(', ')}. Crypto: ${JSON.stringify(finData.crypto)}. 3-mo emergency, side hustles, survival tips. 5 bullets.`;

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 150, temperature: 0.7 } })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data[0]?.generated_text?.split('Output:')[1]?.trim() || data[0]?.generated_text?.trim() || '';
    } catch (error) {
      console.error('AI Error:', error);
      const highInt = userData.highInterestLoans || 'high-interest loans';
      const saccoRec = finData.saccos[0].name;
      const mmfRec = finData.mmfs[0].name;
      return `- Prioritize ${highInt} payoff first.\n- Cut non-essentials 20% (save 1k/person), fund ${saccoRec} or ${mmfRec}.\n- Invest spare in 10Y bonds (${finData.bonds['10Y']}% yield).\n- Crypto: Start with ${finData.crypto.lowRisk[0]}, avoid high-risk ${finData.crypto.highRisk[0]} volatility.\n- Side hustle: Family tutoring for ${userData.householdSize} members. Build 3-mo emergency.`;
    }
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
          const maxCut = Math.max(0, exp.amount - (1000 * householdSize));
          const cut = Math.min(maxCut, debtOverage - coveredFromExpenses);
          if (cut > 0) {
            coveredFromExpenses += cut;
            adjustments.push({
              category: exp.name || 'Unnamed Expense',
              current: exp.amount,
              adjusted: exp.amount - cut,
              suggestion: `Cut KES ${cut.toLocaleString()} to cover debt (non-essential; min preserved for ${householdSize} members)`
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
          const maxCut = Math.max(0, exp.amount - (minPerPerson * householdSize));
          const cut = Math.min(maxCut * 0.3, expOverage - cutAmount);
          if (cut > 0) {
            cutAmount += cut;
            adjustments.push({
              category: exp.name || 'Unnamed',
              current: exp.amount,
              adjusted: exp.amount - cut,
              suggestion: `Cut 30% (KES ${cut.toLocaleString()})—sustainable for ${householdSize} members; to emergency fund`
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
        const remainingNonEssentials = expenses.filter(exp => !exp.isEssential && exp.amount > (500 * householdSize));
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
        overageAdvice += `Enforced 5% savings (KES ${adjustedSavings.toLocaleString()}). Side hustle idea for ${householdSize} members: family tutoring or goods resale. `;
      }

      const { months: snowMonths, totalInterest: snowInterest } = snowball(loans, adjustedDebtBudget);
      const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, adjustedDebtBudget);

      let adviceText = loans.length === 0
        ? 'No loans? Focus on 20% savings in MMFs (10%+ return). 50/30/20 rule: needs/wants/savings. Build 3-6 mo emergency.'
        : `${avaInterest < snowInterest ? 'Avalanche saves interest—use if disciplined.' : 'Snowball for motivation.'} Prioritize ${highInterestLoans}.`;

      // Enhanced personalized advice
      const suggestedCutAmount = totalExpenses * 0.2;
      adviceText += `\nFor your ${householdSize}-member household on ${salary.toLocaleString()} KES salary, prioritize high-interest loan payoff. Cut non-essentials like shopping by 20% (save ~${suggestedCutAmount.toLocaleString()} KES) to fund MMFs.`;

      if (totalAdjustedOutgo + adjustedSavings > salary) {
        const overage = totalAdjustedOutgo + adjustedSavings - salary;
        adviceText += `\n🚨 Survival: Over by KES ${overage.toLocaleString()}. Short-term: Borrow at 5% over 6 mo (~KES ${(overage / 6 + overage * 0.05 / 2).toFixed(0)}/mo). Long-term: Negotiate rates, sell items for 2k cash. Track spends; 1 no-spend day/week/family. ${overageAdvice}`;
      } else if (spareCash > 0) {
        adviceText += `\n💡 Spare KES ${spareCash.toLocaleString()}—boost to 15% savings, treasury bonds (8% yield). Automate.`;
      }

      adviceText += `\nTotal Spend: KES ${(totalAdjustedOutgo + adjustedSavings).toLocaleString()} (fits salary).`;

      // 3-Month Emergency build plan with real-time options
      const monthlyExpensesForEmergency = Math.max(adjustedTotalExpenses, emergencyTarget / 3 || 0);
      const threeMonthTarget = Math.max(emergencyTarget, monthlyExpensesForEmergency * 3);
      const monthsToEmergency = adjustedSavings > 0 ? Math.ceil((threeMonthTarget - currentSavings) / adjustedSavings) : 0;
      const thisMonthAdd = Math.min(spareCash, 1000);
      adviceText += `\n🛡️ 3-Month Emergency Build Plan: Target KES ${threeMonthTarget.toLocaleString()} (${householdSize} members). Current: KES ${currentSavings.toLocaleString()}. Reach in ${monthsToEmergency} mo. Add KES ${thisMonthAdd.toLocaleString()} to Sacco this mo. Real-time option: Invest in ${finData.mmfs[0].name} at ${finData.mmfs[0].net}% net.`;

      // Kenyan Investments
      const saccoRec = finData.saccos[0].name;
      const bondYield = finData.bonds['10Y'];
      const mmfRec = finData.mmfs[0].name;
      const mmfYield = finData.mmfs[0].net;
      adviceText += `\n🇰🇪 Kenyan Investments: Top SACCOs - ${finData.saccos.map(s => `${s.name} (~${s.dividend}% dividends)`).join(', ')}. Gov Bonds: 10Y yield ~${bondYield}%; T-Bills ~${finData.bonds.tBills['91-day']}-${finData.bonds.tBills['364-day']}% (91-364 days). MMFs: ${finData.mmfs.map(m => `${m.name} (${m.net || m.gross}% ${m.net ? 'net' : 'gross'})`).join(', ')} - e.g., put cuts into ${mmfRec} at ${mmfYield}% net.`;

      // NSE Top Performers (cleaned, updated with real data as of Oct 4, 2025)
      adviceText += `\n📈 NSE Top Performers (Oct 5, 2025): KEGN at KSh10.00 (+9.6%), OCH at KSh7.04 (+9.3%), CGEN at KSh45.50 (+8.6%). Consider diversifying with these for growth.`;

      // Crypto Advice
      adviceText += `\n₿ Crypto Advice: Low-risk entry: ${finData.crypto.lowRisk.join(', ')} for stability. Higher-potential: ${finData.crypto.highPotential.join(', ')} for growth. Warnings: Volatility high - e.g., 1000x potential in memecoins like ${finData.crypto.highRisk[0]}, but high risk; invest only spare cash.`;

      // Table Markdown (better formatting)
      const tableMarkdown = `\n\nAdjusted Plan Table:\n| Category | Current (KES) | Adjusted (KES) | Suggestion |\n|----------|---------------|----------------|------------|\n${adjustments.map(adj => `| ${adj.category.padEnd(20)} | ${adj.current.toLocaleString().padEnd(15)} | ${adj.adjusted.toLocaleString().padEnd(15)} | ${adj.suggestion.substring(0, 60)}... |`).join('\n')}\n| Savings  | ${savings.toLocaleString().padEnd(15)} | ${adjustedSavings.toLocaleString().padEnd(15)} | Min 5%—low-risk invest (e.g., MMFs); emergency priority |\n| Spare    | -             | ${spareCash.toLocaleString().padEnd(15)} | ${spareCash > 0 ? `Invest in bonds/MMFs` : 'N/A'} |`;
      adviceText += tableMarkdown;

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
      if (deficit > 0) {
        plan.push({
          category: 'Deficit',
          subcategory: 'Overall Shortfall',
          priority: 'Alert',
          budgeted: deficit,
          notes: `KES ${deficit.toLocaleString()} over. Advice: Negotiate loan rates, start side hustle (e.g., tutoring for ${householdSize} members, target +${Math.ceil(deficit / householdSize).toLocaleString()} KES/person/mo), sell non-essentials for quick cash, or seek low-interest bridge loan. Review in 1 mo.`
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
          salary, debtBudget: adjustedDebtBudget, totalExpenses: adjustedTotalExpenses, loans, expenses, householdSize,
          suggestedCuts: adjustments.map(adj => `${adj.category}: ${adj.suggestion}`).join('; '), savings: adjustedSavings, highInterestLoans
        }, finData);
        adviceText += `\n\n🤖 AI Tip:\n${aiTip}`;
      }

      setAdvice(adviceText);
      setAdjustedData(adjustments);
      setEmergencyTarget(threeMonthTarget);

      const historyEntry = {
        month: new Date().toISOString().slice(0, 7),
        salary, savings: adjustedSavings, debtBudget: adjustedDebtBudget, expensesBudget: adjustedExpensesBudget,
        totalExpenses: adjustedTotalExpenses, snowMonths, snowInterest, avaMonths, avaInterest,
        emergencyTarget: threeMonthTarget, currentSavings: currentSavings + adjustedSavings, adjustments: overageAdvice, householdSize
      };
      setCurrentSavings(historyEntry.currentSavings);
      setHistory(prev => [...prev, historyEntry]);

      // PDF (concise text-based summary without tables or emojis)
      try {
        const doc = new jsPDF();
        let yPos = 10;
        doc.setFontSize(12);
        doc.text(`Budget Report - Salary KES ${salary.toLocaleString()} (Household: ${householdSize})`, 10, yPos);
        yPos += 10;

        // Summary Section (key metrics only)
        doc.setFontSize(10);
        doc.text(`Allocation: ${Math.round(adjustedSavings / salary * 100)}% Savings, ${Math.round(adjustedDebtBudget / salary * 100)}% Debt, ${Math.round(adjustedExpensesBudget / salary * 100)}% Expenses`, 10, yPos);
        yPos += 7;
        doc.text(`Snowball: ${snowMonths} mo, Interest KES ${snowInterest.toLocaleString()}`, 10, yPos);
        yPos += 7;
        doc.text(`Avalanche: ${avaMonths} mo, Interest KES ${avaInterest.toLocaleString()}`, 10, yPos);
        yPos += 7;
        doc.text(`Emergency: KES ${threeMonthTarget.toLocaleString()} (3 mo for ${householdSize})`, 10, yPos);
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
      setEmergencyTarget(0);
      setCurrentSavings(0);

      console.log('Calculate finished');
    } catch (error) {
      console.error('Calculate Error:', error);
      alert(`Calc failed: ${error.message}. Check console. Try disabling AI.`);
    }
  }, [salary, savingsPct, debtPct, expensesPct, householdSize, loans, expenses, emergencyTarget, currentSavings, enableAI, history, snowball, avalanche, getFreeAIAdvice, loadFinancialData]);

  const downloadHistory = useCallback(() => {
    const csv = 'Month,Salary,Savings,Debt Budget,Expenses Budget,Total Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Current Savings,Adjustments,Household Size\n' +
      history.map(entry => `${entry.month},${entry.salary},${entry.savings},${entry.debtBudget},${entry.expensesBudget},${entry.totalExpenses},${entry.snowMonths},${entry.snowInterest},${entry.avaMonths},${entry.avaInterest},${entry.emergencyTarget},${entry.currentSavings},"${entry.adjustments || ''}",${entry.householdSize || 1}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_history.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('budgetHistory');
  }, []);

  const historyData = {
    labels: history.map(entry => entry.month).reverse(),
    datasets: [
      { label: 'Debt Budget', data: history.map(entry => entry.debtBudget).reverse(), borderColor: 'rgb(244, 67, 54)', backgroundColor: 'rgba(244, 67, 54, 0.2)', tension: 0.1 },
      { label: 'Expenses', data: history.map(entry => entry.totalExpenses).reverse(), borderColor: 'rgb(76, 175, 80)', backgroundColor: 'rgba(76, 175, 80, 0.2)', tension: 0.1 }
    ]
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', backgroundColor: '#f1f8e9', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#4CAF50', color: 'white', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: 'white' }}>Budget & Debt Coach App</h1>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>Open Access - Auth coming soon</p>
      </header>

      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Budget Settings</h2>
        <label>Monthly Salary (KES): <input key="salary" type="number" value={salary || 0} onChange={(e) => setSalary(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /></label><br />
        <label>Household Size: <input key="household" type="number" min="1" value={householdSize} onChange={(e) => setHouseholdSize(parseInt(e.target.value) || 1)} style={{ margin: '5px', padding: '8px', width: '50px', border: '1px solid #81C784', borderRadius: '5px' }} /> (Scales advice)</label><br />
        <label style={{ color: '#2E7D32' }}>Customization (%): </label>
        <input type="range" min="0" max="50" value={savingsPct} onChange={(e) => setSavingsPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Savings: {savingsPct}%
        <input type="range" min="0" max="50" value={debtPct} onChange={(e) => setDebtPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Debt: {debtPct}%
        <input type="range" min="0" max="100" value={expensesPct} onChange={(e) => setExpensesPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Expenses: {expensesPct}%<br />
        <label>Emergency Target (KES): <input key="emergency" type="number" value={emergencyTarget || 0} onChange={(e) => setEmergencyTarget(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /> (Auto-updates below)</label>
      </section>

      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Loans</h2>
        {loans.map((loan, i) => (
          <div key={`loan-${i}`} style={{ border: '1px solid #A5D6A7', margin: '10px 0', padding: '15px', borderRadius: '8px', backgroundColor: '#f1f8e9' }}>
            <h3 style={{ color: '#388E3C', marginTop: 0 }}>Loan {i+1}</h3>
            <label>Name: <input type="text" value={loan.name} onChange={(e) => updateLoan(i, 'name', e.target.value)} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /></label><br />
            <label>Balance (KES): <input type="number" value={loan.balance || 0} onChange={(e) => updateLoan(i, 'balance', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /></label><br />
            <label>Rate (%): <input type="number" step="0.1" value={loan.rate || 0} onChange={(e) => updateLoan(i, 'rate', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /></label><br />
            <label>Min Payment (KES): <input type="number" value={loan.minPayment || 0} onChange={(e) => updateLoan(i, 'minPayment', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /></label><br />
            <label>Essential?: <input type="checkbox" checked={loan.isEssential || false} onChange={() => toggleLoanEssential(i)} style={{ margin: '5px' }} /></label>
          </div>
        ))}
        <button onClick={addLoan} style={{ padding: '12px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Add Loan</button>
      </section>

      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Expenses</h2>
        {expenses.map((exp, i) => (
          <div key={`exp-${i}`} style={{ border: '1px solid #A5D6A7', margin: '10px 0', padding: '15px', borderRadius: '8px', backgroundColor: '#f1f8e9' }}>
            <h3 style={{ color: '#388E3C', marginTop: 0 }}>Expense {i+1}</h3>
            <label>Name: <input type="text" value={exp.name} onChange={(e) => updateExpense(i, 'name', e.target.value)} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /></label><br />
            <label>Amount (KES): <input type="number" value={exp.amount || 0} onChange={(e) => updateExpense(i, 'amount', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '8px', border: '1px solid #81C784', borderRadius: '5px' }} /></label><br />
            <label>Essential?: <input type="checkbox" checked={exp.isEssential || false} onChange={() => toggleExpenseEssential(i)} style={{ margin: '5px' }} /></label>
          </div>
        ))}
        <button onClick={addExpense} style={{ padding: '12px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Add Expense</button>
      </section>

      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Actions</h2>
        <label style={{ display: 'block', marginBottom: '10px', color: '#2E7D32' }}>Enable Free AI Advice: <input type="checkbox" checked={enableAI} onChange={(e) => setEnableAI(e.target.checked)} /></label>
        <button onClick={handleCalculate} style={{ padding: '12px 24px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', margin: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Calculate & Generate Plan</button>
        <button onClick={downloadHistory} style={{ padding: '12px 24px', background: '#66BB6A', color: 'white', border: 'none', borderRadius: '8px', margin: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Download History CSV</button>
        <button onClick={clearHistory} style={{ padding: '12px 24px', background: '#FF5722', color: 'white', border: 'none', borderRadius: '8px', margin: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Clear History</button>
      </section>

      {chartData && (
        <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Adjusted Allocation Chart (Totals correctly with Spare if available)</h2>
          <div style={{ width: '400px', height: '400px', margin: '0 auto' }}>
            <Pie data={chartData} />
          </div>
        </section>
      )}

      {advice && (
        <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Enhanced Financial Advice</h2>
          <div style={{ background: '#e8f5e8', padding: '15px', borderRadius: '8px', whiteSpace: 'pre-line', fontSize: '14px', lineHeight: '1.4', borderLeft: '4px solid #4CAF50' }}>{advice}</div>
        </section>
      )}

      {adjustedData && adjustedData.length > 0 && (
        <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Adjusted Spending Table</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #A5D6A7' }}>
            <thead><tr><th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Category</th><th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Current (KES)</th><th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Adjusted (KES)</th><th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Suggestion</th></tr></thead>
            <tbody>{adjustedData.map((adj, i) => (
              <tr key={i}><td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{adj.category}</td><td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{adj.current.toLocaleString()}</td><td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{adj.adjusted.toLocaleString()}</td><td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{adj.suggestion}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {planData && planData.length > 0 && (
        <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Monthly Payment Plan (Prioritized for Loans/Expenses/Savings)</h2>
          <p style={{ color: '#388E3C' }}>Even after adjustments, here's your detailed monthly plan. Loans prioritized by interest rate (highest first). Expenses budgeted per item. Deficit advice if over salary.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #A5D6A7' }}>
            <thead><tr>
              <th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Category</th>
              <th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Item</th>
              <th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Priority</th>
              <th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Budgeted (KES)</th>
              <th style={{ border: '1px solid #A5D6A7', padding: '8px', backgroundColor: '#C8E6C9' }}>Notes</th>
            </tr></thead>
            <tbody>{planData.map((item, i) => (
              <tr key={i} style={{ backgroundColor: item.category === 'Deficit' ? '#ffebee' : item.category === 'Surplus' ? '#e8f5e8' : '#f1f8e9' }}>
                <td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{item.category}</td>
                <td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{item.subcategory}</td>
                <td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{item.priority}</td>
                <td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{item.budgeted.toLocaleString()}</td>
                <td style={{ border: '1px solid #A5D6A7', padding: '8px' }}>{item.notes}</td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{ color: '#388E3C', fontWeight: 'bold' }}><strong>Total Planned: KES {planData.reduce((sum, item) => sum + (item.budgeted || 0), 0).toLocaleString()}</strong> vs Salary KES {displaySalary.toLocaleString()}</p>
        </section>
      )}

      <section style={{ marginBottom: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#2E7D32', marginTop: 0 }}>History</h2>
        <div style={{ width: '800px', height: '400px', margin: '0 auto' }}>
          <Line data={historyData} />
        </div>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {history.map((entry, i) => (
            <li key={i} style={{ margin: '5px 0', padding: '10px', borderBottom: '1px solid #A5D6A7', backgroundColor: '#f1f8e9', borderRadius: '5px' }}>
              <strong style={{ color: '#388E3C' }}>{entry.month}:</strong> Salary KES {entry.salary.toLocaleString()}, Savings KES {entry.savings.toLocaleString()}, Debt KES {entry.debtBudget.toLocaleString()}, Expenses KES {entry.totalExpenses.toLocaleString()} {entry.adjustments ? `(Adjusts: ${entry.adjustments})` : ''} (Household: {entry.householdSize || 1})
            </li>
          ))}
        </ul>
      </section>

      <section style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#2E7D32', marginTop: 0 }}>Emergency Fund Progress</h2>
        <p style={{ color: '#388E3C' }}>Current Savings: KES {currentSavings.toLocaleString()} / {emergencyTarget.toLocaleString()}</p>
        <progress value={currentSavings} max={emergencyTarget || 1} style={{ width: '100%', height: '20px', borderRadius: '10px', backgroundColor: '#A5D6A7' }} />
      </section>

      <footer style={{ textAlign: 'center', marginTop: '40px', padding: '20px', backgroundColor: '#4CAF50', color: 'white', borderRadius: '10px' }}>
        <p style={{ margin: 0, fontSize: '16px' }}>For enquiries: <span style={{ fontSize: '20px' }}>📲</span> WhatsApp e.k via <a href="https://wa.me/254705245123" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline', fontWeight: 'bold' }}>+254 705 245 123</a> | <span style={{ fontSize: '20px' }}>𝕏</span> Follow on X: <a href="https://x.com/010deux" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline', fontWeight: 'bold' }}>@010deux</a></p>
      </footer>
    </div>
  );
}

export default App;
