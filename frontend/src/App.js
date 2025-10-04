import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';

// Chart.js registration
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

function App() {
  const [salary, setSalary] = useState(34547);
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

  const addLoan = () => {
    setLoans([...loans, { name: '', balance: 0, rate: 0, minPayment: 0 }]);
  };

  const updateLoan = (index, field, value) => {
    const updatedLoans = [...loans];
    updatedLoans[index][field] = parseFloat(value) || 0;
    setLoans(updatedLoans);
  };

  const addExpense = () => {
    setExpenses([...expenses, { name: '', amount: 0 }]);
  };

  const updateExpense = (index, field, value) => {
    const updatedExpenses = [...expenses];
    updatedExpenses[index][field] = parseFloat(value) || 0;
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

  const handleCalculate = () => {
    if (savingsPct + debtPct + expensesPct !== 100) {
      alert('Percentages must sum to 100%');
      return;
    }

    const savings = salary * (savingsPct / 100);
    const debtBudget = salary * (debtPct / 100);
    const expensesBudget = salary * (expensesPct / 100);

    const totalMinPayments = loans.reduce((sum, loan) => sum + loan.minPayment, 0);
    if (totalMinPayments > debtBudget) {
      alert('Total minimum payments exceed debt budget');
      return;
    }

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    if (totalExpenses > expensesBudget) {
      alert('Expenses exceed budget');
    }

    const { months: snowMonths, totalInterest: snowInterest } = snowball(loans, debtBudget);
    const { months: avaMonths, totalInterest: avaInterest } = avalanche(loans, debtBudget);

    const adviceText = avaInterest < snowInterest ? 'Avalanche saves more on interest—stick to it if disciplined.' : 'Snowball for quick wins—use it for motivation.';
    setAdvice(adviceText);

    const historyEntry = {
      month: new Date().toISOString().slice(0, 7),
      salary,
      savings,
      debtBudget,
      expensesBudget,
      totalExpenses,
      snowMonths,
      snowInterest,
      avaMonths,
      avaInterest,
      emergencyTarget,
      currentSavings: currentSavings + savings
    };
    setCurrentSavings(historyEntry.currentSavings);
    setHistory([...history, historyEntry]);

    // Generate PDF
    const doc = new jsPDF();
    doc.text(`Budget Report - Salary KES ${salary.toLocaleString()}`, 10, 10);
    doc.text(`Allocation: ${savingsPct}% Savings, ${debtPct}% Debt, ${expensesPct}% Expenses`, 10, 20);
    doc.text(`Snowball: ${snowMonths} months, Interest KES ${snowInterest.toLocaleString()}`, 10, 30);
    doc.text(`Avalanche: ${avaMonths} months, Interest KES ${avaInterest.toLocaleString()}`, 10, 40);
    doc.text(adviceText, 10, 50);
    doc.save('budget_report.pdf');

    // Allocation Pie Chart
    const pieData = {
      labels: ['Savings', 'Debt', 'Expenses'],
      datasets: [{
        data: [savings, debtBudget, expensesBudget],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
      }]
    };
    setChartData(pieData);
  };

  const downloadHistory = () => {
    const csv = 'Month,Salary,Savings,Debt Budget,Expenses Budget,Total Expenses,Snowball Months,Snowball Interest,Avalanche Months,Avalanche Interest,Emergency Target,Current Savings\n' +
      history.map(entry => `${entry.month},${entry.salary},${entry.savings},${entry.debtBudget},${entry.expensesBudget},${entry.totalExpenses},${entry.snowMonths},${entry.snowInterest},${entry.avaMonths},${entry.avaInterest},${entry.emergencyTarget},${entry.currentSavings}`).join('\n');
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
        <input type="number" value={salary} onChange={(e) => setSalary(parseFloat(e.target.value) || 0)} style={{ margin: '5px', padding: '5px' }} />
        <br />
        <label>Customization (%): </label>
        <input type="range" min="0" max="50" value={savingsPct} onChange={(e) => setSavingsPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Savings: {savingsPct}%
        <input type="range" min="0" max="50" value={debtPct} onChange={(e) => setDebtPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Debt: {debtPct}%
        <input type="range" min="0" max="100" value={expensesPct} onChange={(e) => setExpensesPct(parseInt(e.target.value))} style={{ margin: '5px' }} /> Expenses: {expensesPct}% (must sum to 100%)
        <br />
        <label>Emergency Fund Target (KES): </label>
        <input type="number" value={emergencyTarget} onChange={(e) => setEmergencyTarget(parseFloat(e.target.value) || 0)} style={{ margin: '5px', padding: '5px' }} />
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
            <input type="number" value={loan.balance} onChange={(e) => updateLoan(i, 'balance', e.target.value)} style={{ margin: '5px', padding: '5px' }} />
            <br />
            <label>Rate (%): </label>
            <input type="number" step="0.1" value={loan.rate} onChange={(e) => updateLoan(i, 'rate', e.target.value)} style={{ margin: '5px', padding: '5px' }} />
            <br />
            <label>Min Payment (KES): </label>
            <input type="number" value={loan.minPayment} onChange={(e) => updateLoan(i, 'minPayment', e.target.value)} style={{ margin: '5px', padding: '5px' }} />
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
            <input type="number" value={exp.amount} onChange={(e) => updateExpense(i, 'amount', e.target.value)} style={{ margin: '5px', padding: '5px' }} />
          </div>
        ))}
        <button onClick={addExpense} style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Add Expense</button>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Actions</h2>
        <button onClick={handleCalculate} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', margin: '10px' }}>Calculate & Generate Plan</button>
        <button onClick={downloadHistory} style={{ padding: '10px 20px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', margin: '10px' }}>Download History CSV</button>
      </section>

      {chartData && (
        <section style={{ marginBottom: '30px' }}>
          <h2>Allocation Chart</h2>
          <div style={{ width: '400px', height: '400px', margin: '0 auto' }}>
            <Pie data={chartData} />
          </div>
        </section>
      )}

      {advice && (
        <section style={{ marginBottom: '30px' }}>
          <h2>Advice</h2>
          <p style={{ background: '#e8f5e8', padding: '10px', borderRadius: '5px' }}>{advice}</p>
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
              <strong>{entry.month}:</strong> Salary KES {entry.salary.toLocaleString()}, Savings KES {entry.savings.toLocaleString()}, Debt Budget KES {entry.debtBudget.toLocaleString()}, Expenses KES {entry.totalExpenses.toLocaleString()}
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
