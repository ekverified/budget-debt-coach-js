import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';

// Chart.js registration
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

function App() {
  const [salary, setSalary] = useState(0);  // Default to 0 for manual input
  const [savingsPct, setSavingsPct] = useState(10);
  const [debtPct, setDebtPct] = useState(20);
  const [expensesPct, setExpensesPct] = useState(70);
  const [householdSize, setHouseholdSize] = useState(1); // NEW: Household size for scaled advice
  const [loans, setLoans] = useState([]); // Each loan now includes { ..., isEssential: false }
  const [expenses, setExpenses] = useState([]); // Each expense now includes { ..., isEssential: false }
  const [emergencyTarget, setEmergencyTarget] = useState(0);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [history, setHistory] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [advice, setAdvice] = useState('');
  // New state for adjusted values (to show in table)
  const [adjustedData, setAdjustedData] = useState(null);
  // New state for AI toggle
  const [enableAI, setEnableAI] = useState(true);

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem('budgetHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('budgetHistory', JSON.stringify(history));
  }, [history]);

  const clearOnFocus = (e) => e.target.select();  // Selects "0" to replace when typing

  const addLoan = () => {
    setLoans([...loans, { name: '', balance: 0, rate: 0, minPayment: 0, isEssential: false }]); // NEW: Add essential flag
    
    // NEW: Track GA4 event for adding loan
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'add_loan', {
        event_category: 'User Action',
        event_label: 'Loans Section'
      });
    }
  };

  const updateLoan = (index, field, value) => {
    const updatedLoans = [...loans];
    updatedLoans[index][field] = field === 'name' ? value : (parseFloat(value) || 0);
    setLoans(updatedLoans);
  };

  const toggleLoanEssential = (index) => {
    const updatedLoans = [...loans];
    updatedLoans[index].isEssential = !updatedLoans[index].isEssential;
    setLoans(updatedLoans);
  };

  const addExpense = () => {
    setExpenses([...expenses, { name: '', amount: 0, isEssential: false }]); // NEW: Add essential flag
    
    // NEW: Track GA4 event for adding expense
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'add_expense', {
        event_category: 'User Action',
        event_label: 'Expenses Section'
      });
    }
  };

  const updateExpense = (index, field, value) => {
    const updatedExpenses = [...expenses];
    updatedExpenses[index][field] = field === 'name' ? value : (parseFloat(value) || 0);
    setExpenses(updatedExpenses);
  };

  const toggleExpenseEssential = (index) => {
    const updatedExpenses = [...expenses];
    updatedExpenses[index].isEssential = !updatedExpenses[index].isEssential;
    setExpenses(updatedExpenses);
  };

  const snowball = (loans, extra) => {
    const sortedLoans = [...loans].sort((a, b) => a.balance - b.balance);
    return simulate(sortedLoans, extra);
  };

  const avalanche = (loans, extra) => {
    const sortedLoans = [...loans].sort((a, b) => b.rate - a.rate); // Prioritizes high interest
    return simulate(sortedLoans, extra);
  };

  const simulate = (loans, extra) => {
    const clonedLoans = loans.map(l => ({ ...l }));
    let months = 0;
    let totalInterest = 0;
    while (clonedLoans.some(l => l.balance > 0) && months < 600) {
      let extraLeft = extra;
      clonedLoans.forEach(loan => {
        if (loan.balance <= 0) return;
        const interest = loan.balance * (loan.rate / 100 / 12);
        loan.balance += interest;
        totalInterest += interest;
        const pay = Math.min(loan.minPayment, loan.balance);
        loan.balance -= pay;
        extraLeft -= pay;
      });
      extraLeft = Math.max(0, extraLeft);
      if (extraLeft > 0) {
        const targetLoan = clonedLoans.find(l => l.balance > 0);
        if (targetLoan) {
          const pay = Math.min(extraLeft, targetLoan.balance);
          targetLoan.balance -= pay;
        }
      }
      months++;
    }
    return { months, totalInterest };
  };

  // New: Free AI Advice Function using Hugging Face (updated prompt with new fields)
  const getFreeAIAdvice = async (userData) => {
    const model = 'distilgpt2'; // Free, fast model; change to 'microsoft/DialoGPT-medium' for better chat
    const prompt = `You are a financial advisor focused on Kenyan users with ${userData.householdSize} household members. Provide concise, actionable advice on debt payoff (prioritize high-interest/essential loans), specific expense cuts (respect essentials and household size, e.g., min shopping KES 1000/person), savings habits, and low-risk investing (e.g., MMFs, treasury bonds). User data: Salary KES ${userData.salary}, Debt budget KES ${userData.debtBudget}, Total expenses KES ${userData.totalExpenses}, Loans: ${JSON.stringify(userData.loans.map((l, idx) => ({ name: l.name || `Loan ${idx+1}`, balance: l.balance, rate: l.rate, isEssential: l.isEssential })))}, Expenses: ${JSON.stringify(userData.expenses.map((e, idx) => ({ name: e.name || `Expense ${idx+1}`, amount: e.amount, isEssential: e.isEssential })))}, Suggested cuts: ${userData.suggestedCuts || 'None'}. Include 3-month emergency fund build plan. Emphasize saving culture and survival tips if over budget. Output: 3-4 bullet points only.`;

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 200, temperature: 0.7 } }) // Slightly longer output
      });

      if (!response.ok) {
        throw new Error('API response failed');
      }

      const data = await response.json();
      return data[0]?.generated_text?.split('Output:')[1]?.trim() || `Fallback for ${userData.householdSize} members: Prioritize ${userData.highInterestLoans || 'high-interest loans'}; cut non-essentials like cloths by 20% (save KES 1k); save KES ${userData.savings}/month toward 3-month fund.`; // Extract response
    } catch (error) {
      console.error('AI Integration Error:', error);
      return `Tip for ${userData.householdSize} members: Review top non-essential (e.g., cloths) and redirect 10% to emergency fund; prioritize loans >5% interest like ${userData.highInterestLoans || 'high-interest loans'}.`;
    }
  };

  const handleCalculate = async () => {  // Make async for AI call
    if (savingsPct + debtPct + expensesPct !== 100) {
      alert('Percentages must sum to 100%');
      return;
    }

    const savings = salary * (savingsPct / 100);
    let debtBudget = salary * (debtPct / 100);
    let expensesBudget = salary * (expensesPct / 100);

    const totalMinPayments = loans.reduce((sum, loan) => sum + loan.minPayment, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // FIXED: Define highInterestLoans early (before if-else) for full scope; dedup by index
    const highInterestLoans = loans
      .filter(l => l.rate > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 2)
      .map((l, idx) => `${l.name || `Loan ${idx+1}`} at ${l.rate}%`)
      .join(', ') || 'None >0%';

    // NEW: Auto-adjust if over budget (improved: prioritize cuts from non-essentials first)
    let adjustedSavings = savings;
    let adjustedDebtBudget = debtBudget;
    let adjustedExpensesBudget = expensesBudget;
    let adjustedTotalExpenses = totalExpenses;
    let adjustedTotalMinPayments = totalMinPayments;
    let overageAdvice = '';
    const adjustments = []; // For table - now individual items

    // Handle debt overage first (cover from non-essential expenses before savings)
    let debtOverage = 0;
    if (totalMinPayments > debtBudget) {
      debtOverage = totalMinPayments - debtBudget;
      adjustedDebtBudget = totalMinPayments; // Prioritize min payments (essential by default)

      // Try to cover from non-essential expenses
      let coveredFromExpenses = 0;
      const nonEssentialExpenses = expenses.filter((exp) => !exp.isEssential);
      nonEssentialExpenses.forEach(exp => {
        const maxCut = Math.max(0, exp.amount - (1000 * householdSize)); // Min KES 1000/person for basics
        const cut = Math.min(maxCut, debtOverage - coveredFromExpenses);
        if (cut > 0) {
          coveredFromExpenses += cut;
          adjustments.push({ 
            category: `Debt Overage Coverage - ${exp.name || 'Unnamed'}`, 
            current: 0, 
            adjusted: -cut, 
            suggestion: `Cut ${exp.name || 'Unnamed'} by KES ${cut.toLocaleString()} (non-essential; min preserved for ${householdSize} members)` 
          });
        }
      });

      // If still overage, dip minimally into savings (enforce 5% min)
      const remainingOverage = debtOverage - coveredFromExpenses;
      if (remainingOverage > 0) {
        const cutFromSavings = Math.min(remainingOverage, savings * 0.3); // Max 30% of savings
        adjustedSavings = Math.max(salary * 0.05, savings - cutFromSavings);
        adjustments.push({ 
          category: 'Savings Adjustment for Debt', 
          current: savings, 
          adjusted: adjustedSavings, 
          suggestion: `Reduced savings by KES ${cutFromSavings.toLocaleString()} to cover remaining debt overage` 
        });
      }

      overageAdvice += `Debt overage covered: KES ${coveredFromExpenses.toLocaleString()} from expenses + adjustments to savings. `;
      adjustments.push({ category: 'Total Debt Min Payments', current: totalMinPayments, adjusted: totalMinPayments, suggestion: `Prioritized (high-interest first: e.g., ${highInterestLoans})—no cuts` });
    } else {
      const highInterestLoanName = loans
        .filter(l => l.rate > 0)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 1)
        .map((l, idx) => l.name || `Loan ${idx+1}`)
        .join(', ') || 'N/A';
      adjustments.push({ category: 'Total Debt Min Payments', current: totalMinPayments, adjusted: totalMinPayments, suggestion: `Within budget; prioritize high-interest loans like ${highInterestLoanName}` });
    }

    // Handle expenses overage (only cut non-essentials, scaled by household)
    let expOverage = 0;
    if (totalExpenses > expensesBudget) {
      expOverage = totalExpenses - expensesBudget;
      let cutAmount = 0;
      const nonEssentialExpenses = expenses.filter(exp => !exp.isEssential).sort((a, b) => b.amount - a.amount); // Sort by amount
      nonEssentialExpenses.forEach(exp => {
        const minPerPerson = exp.name.toLowerCase().includes('shopping') || exp.name.toLowerCase().includes('food') ? 1500 : 500; // Scaled min
        const maxCut = Math.max(0, exp.amount - (minPerPerson * householdSize));
        const cut = Math.min(maxCut * 0.3, expOverage - cutAmount); // 30% max cut
        if (cut > 0) {
          cutAmount += cut;
          adjustments.push({ 
            category: exp.name || 'Unnamed', 
            current: exp.amount, 
            adjusted: exp.amount - cut, 
            suggestion: `Cut 30% (KES ${cut.toLocaleString()})—sustainable for ${householdSize} members; redirect to emergency fund` 
          });
        }
      });
      adjustedTotalExpenses = Math.max(0, totalExpenses - cutAmount);
      adjustedExpensesBudget = adjustedTotalExpenses;
      overageAdvice += `Expense overage: Specific cuts save KES ${cutAmount.toLocaleString()}. `;
    } else {
      const nonEssentials = expenses.filter(e => !e.isEssential).map(e => e.name || 'Unnamed').join(', ') || 'None';
      adjustments.push({ category: 'Total Expenses', current: totalExpenses, adjusted: totalExpenses, suggestion: `Within budget; review non-essentials like ${nonEssentials}.` });
    }

    // FIXED: Enforce total <= salary (deeper cuts if needed)
    let totalAdjustedOutgo = adjustedTotalMinPayments + adjustedTotalExpenses;
    const overageAfterCuts = Math.max(0, totalAdjustedOutgo + adjustedSavings - salary);
    if (overageAfterCuts > 0) {
      // Extra cut from non-essentials to balance
      const extraCutNeeded = overageAfterCuts;
      const remainingNonEssentials = expenses.filter(exp => !exp.isEssential && exp.amount > (500 * householdSize));
      remainingNonEssentials.forEach(exp => {
        const extraCut = Math.min(exp.amount * 0.2, extraCutNeeded); // 20% extra
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
      totalAdjustedOutgo = adjustedTotalMinPayments + adjustedTotalExpenses; // Recalc
    }

    const spareCash = Math.max(0, salary - totalAdjustedOutgo - adjustedSavings); // FIXED: Clamp to 0

    // Enforce saving culture: Always reserve 5% min; use any spare for emergency build
    if (totalAdjustedOutgo > salary * 0.95) {
      const forcedSavings = salary * 0.05;
      adjustedSavings = Math.max(adjustedSavings, forcedSavings);
      overageAdvice += `Tight budget: Enforced 5% (KES ${adjustedSavings.toLocaleString()}) to savings. Consider side hustle for ${householdSize} members (e.g., family tutoring). `;
    }

    const { months: snowMonths, totalInterest: snowInterest } = snowball(loans, adjustedDebtBudget);
    const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, adjustedDebtBudget);

    let adviceText = '';
    if (loans.length === 0) {
      adviceText = 'No loans? Excellent! Focus on savings: Aim for 20% in investments (e.g., money market funds at 10% return). Break expenses into 50% needs (rent/food), 30% wants (entertainment), 20% savings buffer. Build an emergency fund of 3-6 months expenses for financial freedom.';
    } else {
      adviceText = avaInterest < snowInterest ? 'Avalanche saves more on interest—stick to it if disciplined.' : 'Snowball for quick wins—use it for motivation.';
      adviceText += ` Prioritize high-interest loans (e.g., ${highInterestLoans}).`;
    }

    // FIXED: Use adjusted totals for advice consistency; only Survival if truly over
    if (totalAdjustedOutgo + adjustedSavings > salary) {
      const overage = totalAdjustedOutgo + adjustedSavings - salary;
      adviceText += `\n\n🚨 Survival Mode: Adjusted total exceeds salary by KES ${overage.toLocaleString()}. Short-term: Borrow KES ${overage.toLocaleString()} at 5% over 6 months (monthly: ~KES ${Math.round((overage / 6) + (overage * 0.05 / 12) * 6).toLocaleString()}). Long-term: Negotiate essential loan rates down 1-2%, sell unused items for KES 2k quick cash. Build saving culture: Track daily spends in app—aim for 1 "no-spend" day/week per family member. Invest any surplus in S&P 500 ETF (7-10% avg return). ${overageAdvice}`;
    } else if (spareCash > 0) {
      adviceText += `\n\n💡 Opportunity: Spare KES ${spareCash.toLocaleString()} after adjustments—boost savings to 15%, invest in treasury bonds (8% yield). Automate transfers to avoid temptation.`;
    }

    adviceText += `\nAdjusted Total Spend: KES ${(totalAdjustedOutgo + adjustedSavings).toLocaleString()} (fits within salary).`; // NEW: Clear summary

    // NEW: 3-Month Emergency Fund Advice
    const monthlyExpensesForEmergency = adjustedTotalExpenses;
    const threeMonthTarget = monthlyExpensesForEmergency * 3;
    const monthsToEmergency = threeMonthTarget > 0 ? Math.ceil((threeMonthTarget - currentSavings) / adjustedSavings) : 0;
    const thisMonthAdd = Math.min(spareCash, 1000); // FIXED: Clamp
    adviceText += `\n\n🛡️ 3-Month Emergency Fund: Target KES ${threeMonthTarget.toLocaleString()} (covers ${householdSize} members for essentials). Current: KES ${currentSavings.toLocaleString()}. Save KES ${adjustedSavings.toLocaleString()}/month to reach in ${monthsToEmergency} months. Start small: Add KES ${thisMonthAdd.toLocaleString()} this month to a high-yield Sacco account.`;

    // Tabulated adjustments (now more individual; no bold)
    const tableMarkdown = `
| Category | Current (KES) | Adjusted (KES) | Suggestion |
|----------|---------------|----------------|------------|
${adjustments.map(adj => `| ${adj.category} | ${adj.current.toLocaleString()} | ${adj.adjusted.toLocaleString()} | ${adj.suggestion} |`).join('\n')}
| Savings Buffer | ${savings.toLocaleString()} | ${adjustedSavings.toLocaleString()} | Enforced min 5%—invest in low-risk funds; build emergency as priority |
    `;
    adviceText += `\n\nAdjusted Spending Plan:\n${tableMarkdown}`;

    // NEW: Get AI advice if enabled (with household/essential data)
    let aiTip = '';
    if (enableAI) {
      aiTip = await getFreeAIAdvice({
        salary,
        debtBudget: adjustedDebtBudget,
        totalExpenses: adjustedTotalExpenses,
        loans,
        expenses,
        householdSize,
        suggestedCuts: adjustments.map(adj => `${adj.category}: ${adj.suggestion}`).join('; '),
        savings: adjustedSavings,
        highInterestLoans
      });
      adviceText += `\n\n🤖 Free AI Tip (via Hugging Face): ${aiTip}`;
    }

    // NEW: Track GA4 event for generating plan
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'generate_plan', {
        event_category: 'User Action',
        event_label: `Household: ${householdSize}, AI: ${enableAI}`,
        value: Math.round(salary)  // Integer value for GA
      });
    }

    setAdvice(adviceText);
    setAdjustedData(adjustments); // For UI table

    const historyEntry = {
      month: new Date().toISOString().slice(0, 7),
      salary,
      savings: adjustedSavings,
      debtBudget: adjustedDebtBudget,
      expensesBudget: adjustedExpensesBudget,
      totalExpenses: adjustedTotalExpenses,
      snowMonths,
      snowInterest,
      avaMonths,
      avaInterest,
      emergencyTarget: threeMonthTarget, // NEW: Auto-set 3-month target
      currentSavings: currentSavings + adjustedSavings,
      adjustments: overageAdvice, // Log adjustments
      householdSize
    };
    setCurrentSavings(historyEntry.currentSavings);
    setHistory([...history, historyEntry]);

    // Generate PDF with table, AI tip, and emergency
    const doc = new jsPDF();
    let yPos = 10;
    doc.text(`Budget Report - Salary KES ${salary.toLocaleString()} (Household: ${householdSize})`, 10, yPos);
    yPos += 10;
    doc.text(`Adjusted Allocation: ${Math.round((adjustedSavings / salary) * 100)}% Savings, ${Math.round((adjustedDebtBudget / salary) * 100)}% Debt, ${Math.round((adjustedExpensesBudget / salary) * 100)}% Expenses`, 10, yPos);
    yPos += 10;
    doc.text(`Snowball: ${snowMonths} months, Interest KES ${snowInterest.toLocaleString()}`, 10, yPos);
    yPos += 10;
    doc.text(`Avalanche: ${avaMonths} months, Interest KES ${avaInterest.toLocaleString()}`, 10, yPos);
    yPos += 10;
    doc.text(`Emergency Target: KES ${threeMonthTarget.toLocaleString()} (3 months for ${householdSize} members)`, 10, yPos);
    yPos += 10;
    if (aiTip) {
      doc.text('AI Tip:', 10, yPos);
      yPos += 7;
      doc.text(aiTip.substring(0, 100), 10, yPos); // Truncate AI tip
      yPos += 10;
    }
    yPos += 10;
    // Simple table in PDF (text-based)
    doc.text('Adjusted Plan:', 10, yPos);
    yPos += 10;
    adjustments.forEach(adj => {
      doc.text(`${adj.category}: Current ${adj.current.toLocaleString()} → Adjusted ${adj.adjusted.toLocaleString()} (${adj.suggestion})`, 10, yPos);
      yPos += 7;
    });
    yPos += 10;
    doc.text(adviceText.substring(0, 1500), 10, yPos, { maxWidth: 180 }); // Truncate if too long
    doc.save('budget_report.pdf');

    // NEW: Track GA4 event for PDF download
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'download_pdf', {
        event_category: 'User Action',
        event_label: 'Budget Report'
      });
    }

    // Allocation Pie Chart (use adjusted values)
    const pieData = {
      labels: ['Savings', 'Debt', 'Expenses'],
      datasets: [{
        data: [adjustedSavings, adjustedDebtBudget, adjustedExpensesBudget],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
      }]
    };
    setChartData(pieData);
  };

  const downloadHistory = () => {
    const csv = 'Month,Salary,Savings,Debt Budget,Expenses Budget,Total Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Current Savings,Adjustments,Household Size\n' +
      history.map(entry => `${entry.month},${entry.salary},${entry.savings},${entry.debtBudget},${entry.expensesBudget},${entry.totalExpenses},${entry.snowMonths},${entry.snowInterest},${entry.avaMonths},${entry.avaInterest},${entry.emergencyTarget},${entry.currentSavings},"${entry.adjustments || ''}",${entry.householdSize || 1}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_history.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    // NEW: Track GA4 event for downloading history
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'download_history', {
        event_category: 'User Action',
        event_label: 'CSV Export'
      });
    }
  };

  // Allocation Pie Chart
  const pieData = chartData;

  // History Line Chart (debt reduction over time)
  const historyData = {
    labels: history.map(entry => entry.month).reverse(),
    datasets: [{
      label: 'Total Debt Budget',
      data: history.map(entry => entry.debtBudget).reverse(),
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      tension: 0.1
    }, {
      label: 'Total Expenses',
      data: history.map(entry => entry.totalExpenses).reverse(),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1
    }]
  };

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="App-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Budget & Debt Coach</h1>
        <p>Open Access - Auth coming soon</p>
      </header>

      <section style={{ marginBottom: '30px' }}>
        <h2>Budget Settings</h2>
        <form>
          <div className="form-row">
            <label>Monthly Salary (KES): </label>
            <input type="number" value={salary} onChange={(e) => setSalary(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} />
          </div>
          <div className="form-row">
            <label>Household Size: </label>
            <input type="number" min="1" value={householdSize} onChange={(e) => setHouseholdSize(parseInt(e.target.value) || 1)} />
            <small>(Scales advice for family needs)</small>
          </div>
          <div className="budget-settings">
            <label>Customization (%): </label>
            <input type="range" min="0" max="50" value={savingsPct} onChange={(e) => setSavingsPct(parseInt(e.target.value))} /> Savings: {savingsPct}%
            <input type="range" min="0" max="50" value={debtPct} onChange={(e) => setDebtPct(parseInt(e.target.value))} /> Debt: {debtPct}%
            <input type="range" min="0" max="100" value={expensesPct} onChange={(e) => setExpensesPct(parseInt(e.target.value))} /> Expenses: {expensesPct}% (must sum to 100%)
          </div>
          <div className="form-row">
            <label>Emergency Fund Target (KES): </label>
            <input type="number" value={emergencyTarget} onChange={(e) => setEmergencyTarget(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} />
            <small>(Auto-suggests 3 months below)</small>
          </div>
        </form>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Loans</h2>
        {loans.map((loan, i) => (
          <div key={i} className="loan-card" style={{ border: '1px solid #ccc', margin: '10px 0', padding: '10px', borderRadius: '5px' }}>
            <h3>Loan {i+1}</h3>
            <div className="form-row">
              <label>Name: </label>
              <input type="text" value={loan.name} onChange={(e) => updateLoan(i, 'name', e.target.value)} />
            </div>
            <div className="form-row">
              <label>Balance (KES): </label>
              <input type="number" value={loan.balance} onChange={(e) => updateLoan(i, 'balance', e.target.value)} onFocus={clearOnFocus} />
            </div>
            <div className="form-row">
              <label>Rate (%): </label>
              <input type="number" step="0.1" value={loan.rate} onChange={(e) => updateLoan(i, 'rate', e.target.value)} onFocus={clearOnFocus} />
            </div>
            <div className="form-row">
              <label>Min Payment (KES): </label>
              <input type="number" value={loan.minPayment} onChange={(e) => updateLoan(i, 'minPayment', e.target.value)} onFocus={clearOnFocus} />
            </div>
            <div className="form-row">
              <label>Essential? (Cannot Cut/Pay Full): </label>
              <input type="checkbox" checked={loan.isEssential} onChange={() => toggleLoanEssential(i)} />
            </div>
          </div>
        ))}
        <button className="btn-success" onClick={addLoan} style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Add Loan</button>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Expenses</h2>
        {expenses.map((exp, i) => (
          <div key={i} className="expense-card" style={{ border: '1px solid #ccc', margin: '10px 0', padding: '10px', borderRadius: '5px' }}>
            <h3>Expense {i+1}</h3>
            <div className="form-row">
              <label>Name: </label>
              <input type="text" value={exp.name} onChange={(e) => updateExpense(i, 'name', e.target.value)} />
            </div>
            <div className="form-row">
              <label>Amount (KES): </label>
              <input type="number" value={exp.amount} onChange={(e) => updateExpense(i, 'amount', e.target.value)} onFocus={clearOnFocus} />
            </div>
            <div className="form-row">
              <label>Essential? (Fixed, e.g., Transport/Medical): </label>
              <input type="checkbox" checked={exp.isEssential} onChange={() => toggleExpenseEssential(i)} />
            </div>
          </div>
        ))}
        <button className="btn-success" onClick={addExpense} style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Add Expense</button>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Actions</h2>
        <form>
          <div className="form-row">
            <label>Enable Free AI Advice: </label>
            <input type="checkbox" checked={enableAI} onChange={(e) => setEnableAI(e.target.checked)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={handleCalculate} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', margin: '10px' }}>Calculate & Generate Plan</button>
            <button className="btn-secondary" onClick={downloadHistory} style={{ padding: '10px 20px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', margin: '10px' }}>Download History CSV</button>
          </div>
        </form>
      </section>

      {chartData && (
        <section style={{ marginBottom: '30px' }}>
          <h2>Adjusted Allocation Chart</h2>
          <div className="chart-container" style={{ width: '400px', height: '400px', margin: '0 auto' }}>
            <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
          </div>
        </section>
      )}

      {advice && (
        <section className="advice-section" style={{ marginBottom: '30px' }}>
          <h2>Financial Advice</h2>
          <div style={{ background: '#e8f5e8', padding: '10px', borderRadius: '5px', whiteSpace: 'pre-line' }}>{advice}</div>
        </section>
      )}

      {adjustedData && (
        <section style={{ marginBottom: '30px' }}>
          <h2>Adjusted Spending Table</h2>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Category</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Current (KES)</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Adjusted (KES)</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {adjustedData.map((adj, i) => (
                  <tr key={i}>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{adj.category}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{adj.current.toLocaleString()}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{adj.adjusted.toLocaleString()}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{adj.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section style={{ marginBottom: '30px' }}>
        <h2>History</h2>
        <div className="chart-container" style={{ width: '800px', height: '400px', margin: '0 auto' }}>
          <Line data={historyData} options={{ responsive: true, maintainAspectRatio: true }} />
        </div>
        <ul className="history-list" style={{ listStyleType: 'none', padding: 0 }}>
          {history.map((entry, i) => (
            <li key={i} style={{ margin: '5px 0', padding: '5px', borderBottom: '1px solid #eee' }}>
              <strong>{entry.month}:</strong> Salary KES {entry.salary.toLocaleString()}, Savings KES {entry.savings.toLocaleString()}, Debt Budget KES {entry.debtBudget.toLocaleString()}, Expenses KES {entry.totalExpenses.toLocaleString()} {entry.adjustments ? `(Adjustments: ${entry.adjustments})` : ''} (Household: {entry.householdSize || 1})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Emergency Fund Progress</h2>
        <p>Current Savings: KES {currentSavings.toLocaleString()} / {emergencyTarget.toLocaleString()}</p>
        <progress value={currentSavings} max={emergencyTarget} style={{ width: '100%', height: '20px' }} />
      </section>
    </div>
  );
}

export default App;
