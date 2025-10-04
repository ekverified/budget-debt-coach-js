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
  const [loans, setLoans] = useState([]);
  const [expenses, setExpenses] = useState([]);
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
    setLoans([...loans, { name: '', balance: 0, rate: 0, minPayment: 0 }]);
  };

  const updateLoan = (index, field, value) => {
    const updatedLoans = [...loans];
    updatedLoans[index][field] = field === 'name' ? value : (parseFloat(value) || 0);
    setLoans(updatedLoans);
  };

  const addExpense = () => {
    setExpenses([...expenses, { name: '', amount: 0 }]);
  };

  const updateExpense = (index, field, value) => {
    const updatedExpenses = [...expenses];
    updatedExpenses[index][field] = field === 'name' ? value : (parseFloat(value) || 0);
    setExpenses(updatedExpenses);
  };

  const snowball = (loans, extra) => {
    const sortedLoans = [...loans].sort((a, b) => a.balance - b.balance);
    return simulate(sortedLoans, extra);
  };

  const avalanche = (loans, extra) => {
    const sortedLoans = [...loans].sort((a, b) => b.rate - a.rate);
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

  // New: Free AI Advice Function using Hugging Face
  const getFreeAIAdvice = async (userData) => {
    const model = 'distilgpt2'; // Free, fast model; change to 'microsoft/DialoGPT-medium' for better chat
    const prompt = `You are a financial advisor focused on Kenyan users. Provide concise, actionable advice on debt payoff, expense cuts, savings habits, and low-risk investing (e.g., MMFs, treasury bonds). User data: Salary KES ${userData.salary}, Debt budget KES ${userData.debtBudget}, Total expenses KES ${userData.totalExpenses}, Loans: ${JSON.stringify(userData.loans.map(l => ({ name: l.name, balance: l.balance, rate: l.rate })))}, Suggested cuts: ${userData.suggestedCuts || 'None'}. Emphasize saving culture and survival tips if over budget. Output: 2-3 bullet points only.`;

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 150, temperature: 0.7 } }) // Limits output length
      });

      if (!response.ok) {
        throw new Error('API response failed');
      }

      const data = await response.json();
      return data[0]?.generated_text?.split('Output:')[1]?.trim() || 'AI unavailable—fallback: Track spends daily and save 10% first.'; // Extract response
    } catch (error) {
      console.error('AI Integration Error:', error);
      return 'Tip: Review your top expense and redirect 10% to an emergency fund.';
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

    // NEW: Auto-adjust if over budget (no more halting)
    let adjustedSavings = savings;
    let adjustedDebtBudget = debtBudget;
    let adjustedExpensesBudget = expensesBudget;
    let adjustedTotalExpenses = totalExpenses;
    let adjustedTotalMinPayments = totalMinPayments;
    let overageAdvice = '';
    const adjustments = []; // For table

    if (totalMinPayments > debtBudget) {
      const debtOverage = totalMinPayments - debtBudget;
      adjustedDebtBudget = totalMinPayments; // Prioritize min payments
      adjustedExpensesBudget -= debtOverage; // Pull from expenses
      adjustedSavings = Math.max(salary * 0.05, savings - (debtOverage * 0.2)); // Enforce 5% min savings, take 20% from savings if needed
      adjustedTotalMinPayments = totalMinPayments; // No cut on essentials
      overageAdvice += `Debt overage: Reduced expenses by KES ${debtOverage.toLocaleString()} to cover min payments. `;
      adjustments.push({ category: 'Debt Min Payments', current: totalMinPayments, adjusted: adjustedTotalMinPayments, suggestion: 'Prioritize—no cuts needed' });
    } else {
      adjustments.push({ category: 'Debt Min Payments', current: totalMinPayments, adjusted: totalMinPayments, suggestion: 'Within budget' });
    }

    if (totalExpenses > expensesBudget) {
      const expOverage = totalExpenses - expensesBudget;
      // Sort expenses descending and suggest cuts on top 3 non-essentials (assume names like "Entertainment" are cuttable)
      const sortedExpenses = [...expenses].sort((a, b) => b.amount - a.amount);
      let cutAmount = 0;
      sortedExpenses.slice(0, 3).forEach(exp => {
        if (exp.name.toLowerCase().includes('entertainment') || exp.name.toLowerCase().includes('dining')) {
          const cut = exp.amount * 0.3; // 30% cut on fun stuff
          cutAmount += cut;
          adjustments.push({ category: exp.name, current: exp.amount, adjusted: exp.amount - cut, suggestion: `Cut 30% (KES ${cut.toLocaleString()})—redirect to savings` });
        }
      });
      adjustedTotalExpenses = Math.max(0, totalExpenses - Math.min(cutAmount, expOverage));
      adjustedExpensesBudget = adjustedTotalExpenses;
      overageAdvice += `Expense overage: Suggested cuts save KES ${Math.min(cutAmount, expOverage).toLocaleString()}. `;
    } else {
      adjustments.push({ category: 'Total Expenses', current: totalExpenses, adjusted: totalExpenses, suggestion: 'Within budget' });
    }

    // Enforce saving culture: Always reserve 5-10% if possible
    const totalAdjustedOutgo = adjustedTotalMinPayments + adjustedTotalExpenses;
    if (totalAdjustedOutgo > salary * 0.95) {
      const forcedSavings = salary * 0.05;
      adjustedSavings = forcedSavings;
      overageAdvice += `Tight budget: Forced 5% (KES ${forcedSavings.toLocaleString()}) to savings for emergencies. Start a side hustle (e.g., freelance on Upwork) to add KES 5k/month. `;
    }

    const { months: snowMonths, totalInterest: snowInterest } = snowball(loans, adjustedDebtBudget);
    const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, adjustedDebtBudget);

    let adviceText = '';
    if (loans.length === 0) {
      adviceText = 'No loans? Excellent! Focus on savings: Aim for 20% in investments (e.g., money market funds at 10% return). Break expenses into 50% needs (rent/food), 30% wants (entertainment), 20% savings buffer. Build an emergency fund of 3-6 months expenses for financial freedom.';
    } else {
      adviceText = avaInterest < snowInterest ? 'Avalanche saves more on interest—stick to it if disciplined.' : 'Snowball for quick wins—use it for motivation.';
    }

    // Enhanced advice with overage/survival tips
    const totalOutgo = totalMinPayments + totalExpenses;
    if (totalOutgo > salary) {
      const overage = totalOutgo - salary;
      adviceText += `\n\n🚨 Survival Mode: Outgo exceeds salary by KES ${overage.toLocaleString()}. Short-term: Borrow KES ${overage.toLocaleString()} at 5% over 6 months (monthly: ~KES ${(overage / 6 + (overage * 0.05 / 12) * 6).toLocaleString()}). Long-term: Negotiate loan rates down 1-2%, sell unused items for KES 2k quick cash. Build saving culture: Track daily spends in app—aim for 1 "no-spend" day/week. Invest any surplus in S&P 500 ETF (7-10% avg return). ${overageAdvice}`;
    } else if (totalOutgo < salary * 0.9) {
      adviceText += `\n\n💡 Opportunity: Spare KES ${(salary - totalOutgo).toLocaleString()}—boost savings to 15%, invest in treasury bonds (8% yield). Automate transfers to avoid temptation.`;
    }

    // Tabulated adjustments
    const tableMarkdown = `
| Category | Current (KES) | Adjusted (KES) | Suggestion |
|----------|---------------|----------------|------------|
${adjustments.map(adj => `| ${adj.category} | ${adj.current.toLocaleString()} | ${adj.adjusted.toLocaleString()} | ${adj.suggestion} |`).join('\n')}
| **Savings Buffer** | ${savings.toLocaleString()} | **${adjustedSavings.toLocaleString()}** | Enforced min 5%—invest in low-risk funds |
    `;
    adviceText += `\n\n**Adjusted Spending Plan:**\n${tableMarkdown}`;

    // NEW: Get AI advice if enabled
    let aiTip = '';
    if (enableAI) {
      aiTip = await getFreeAIAdvice({
        salary,
        debtBudget: adjustedDebtBudget,
        totalExpenses: adjustedTotalExpenses,
        loans,
        suggestedCuts: adjustments.map(adj => `${adj.category}: ${adj.suggestion}`).join('; ')
      });
      adviceText += `\n\n🤖 Free AI Tip (via Hugging Face): ${aiTip}`;
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
      emergencyTarget,
      currentSavings: currentSavings + adjustedSavings,
      adjustments: overageAdvice // Log adjustments
    };
    setCurrentSavings(historyEntry.currentSavings);
    setHistory([...history, historyEntry]);

    // Generate PDF with table and AI tip
    const doc = new jsPDF();
    let yPos = 10;
    doc.text(`Budget Report - Salary KES ${salary.toLocaleString()}`, 10, yPos);
    yPos += 10;
    doc.text(`Adjusted Allocation: ${Math.round((adjustedSavings / salary) * 100)}% Savings, ${Math.round((adjustedDebtBudget / salary) * 100)}% Debt, ${Math.round((adjustedExpensesBudget / salary) * 100)}% Expenses`, 10, yPos);
    yPos += 10;
    doc.text(`Snowball: ${snowMonths} months, Interest KES ${snowInterest.toLocaleString()}`, 10, yPos);
    yPos += 10;
    doc.text(`Avalanche: ${avaMonths} months, Interest KES ${avaInterest.toLocaleString()}`, 10, yPos);
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
    const csv = 'Month,Salary,Savings,Debt Budget,Expenses Budget,Total Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Current Savings,Adjustments\n' +
      history.map(entry => `${entry.month},${entry.salary},${entry.savings},${entry.debtBudget},${entry.expensesBudget},${entry.totalExpenses},${entry.snowMonths},${entry.snowInterest},${entry.avaMonths},${entry.avaInterest},${entry.emergencyTarget},${entry.currentSavings},"${entry.adjustments || ''}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_history.csv';
    a.click();
    window.URL.revokeObjectURL(url);
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Budget & Debt Coach</h1>
        <p>Open Access - Auth coming soon</p>
      </header>

      <section style={{ marginBottom: '30px' }}>
        <h2>Budget Settings</h2>
        <label>Monthly Salary (KES): </label>
        <input type="number" value={salary} onChange={(e) => setSalary(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '5px' }} />
        <br />
        <label>Customization (%): </label>
        <input type="range" min="0" max="50" value={savingsPct} onChange={(e) => setSavingsPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Savings: {savingsPct}%
        <input type="range" min="0" max="50" value={debtPct} onChange={(e) => setDebtPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Debt: {debtPct}%
        <input type="range" min="0" max="100" value={expensesPct} onChange={(e) => setExpensesPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Expenses: {expensesPct}% (must sum to 100%)
        <br />
        <label>Emergency Fund Target (KES): </label>
        <input type="number" value={emergencyTarget} onChange={(e) => setEmergencyTarget(parseFloat(e.target.value) || 0)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '5px' }} />
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Loans</h2>
        {loans.map((loan, i) => (
          <div key={i} style={{ border: '1px solid #ccc', margin: '10px 0', padding: '10px', borderRadius: '5px' }}>
            <h3>Loan {i+1}</h3>
            <label>Name: </label>
            <input type="text" value={loan.name} onChange={(e) => updateLoan(i, 'name', e.target.value)} style={{ margin: '5px', padding: '5px' }} />
            <br />
            <label>Balance (KES): </label>
            <input type="number" value={loan.balance} onChange={(e) => updateLoan(i, 'balance', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '5px' }} />
            <br />
            <label>Rate (%): </label>
            <input type="number" step="0.1" value={loan.rate} onChange={(e) => updateLoan(i, 'rate', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '5px' }} />
            <br />
            <label>Min Payment (KES): </label>
            <input type="number" value={loan.minPayment} onChange={(e) => updateLoan(i, 'minPayment', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '5px' }} />
          </div>
        ))}
        <button onClick={addLoan} style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Add Loan</button>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Expenses</h2>
        {expenses.map((exp, i) => (
          <div key={i} style={{ border: '1px solid #ccc', margin: '10px 0', padding: '10px', borderRadius: '5px' }}>
            <h3>Expense {i+1}</h3>
            <label>Name: </label>
            <input type="text" value={exp.name} onChange={(e) => updateExpense(i, 'name', e.target.value)} style={{ margin: '5px', padding: '5px' }} />
            <br />
            <label>Amount (KES): </label>
            <input type="number" value={exp.amount} onChange={(e) => updateExpense(i, 'amount', e.target.value)} onFocus={clearOnFocus} style={{ margin: '5px', padding: '5px' }} />
          </div>
        ))}
        <button onClick={addExpense} style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Add Expense</button>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Actions</h2>
        <label style={{ display: 'block', marginBottom: '10px' }}>Enable Free AI Advice: <input type="checkbox" checked={enableAI} onChange={(e) => setEnableAI(e.target.checked)} /></label>
        <button onClick={handleCalculate} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', margin: '10px' }}>Calculate & Generate Plan</button>
        <button onClick={downloadHistory} style={{ padding: '10px 20px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', margin: '10px' }}>Download History CSV</button>
      </section>

      {chartData && (
        <section style={{ marginBottom: '30px' }}>
          <h2>Adjusted Allocation Chart</h2>
          <div style={{ width: '400px', height: '400px', margin: '0 auto' }}>
            <Pie data={chartData} />
          </div>
        </section>
      )}

      {advice && (
        <section style={{ marginBottom: '30px' }}>
          <h2>Financial Advice</h2>
          <div style={{ background: '#e8f5e8', padding: '10px', borderRadius: '5px', whiteSpace: 'pre-line' }}>{advice}</div>
        </section>
      )}

      {adjustedData && (
        <section style={{ marginBottom: '30px' }}>
          <h2>Adjusted Spending Table</h2>
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
        </section>
      )}

      <section style={{ marginBottom: '30px' }}>
        <h2>History</h2>
        <div style={{ width: '800px', height: '400px', margin: '0 auto' }}>
          <Line data={historyData} />
        </div>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {history.map((entry, i) => (
            <li key={i} style={{ margin: '5px 0', padding: '5px', borderBottom: '1px solid #eee' }}>
              <strong>{entry.month}:</strong> Salary KES {entry.salary.toLocaleString()}, Savings KES {entry.savings.toLocaleString()}, Debt Budget KES {entry.debtBudget.toLocaleString()}, Expenses KES {entry.totalExpenses.toLocaleString()} {entry.adjustments ? `(Adjustments: ${entry.adjustments})` : ''}
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
