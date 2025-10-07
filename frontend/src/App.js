import React, { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import './App.css';  // Add this import

// Chart.js registration
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

function App() {
  // ... (all your state and useEffects unchanged)

  // ... (all your callbacks unchanged: clearOnFocus, updateSavingsPct, etc.)

  // ... (handleCalculate, downloadHistory, clearHistory unchanged)

  const historyData = {
    // ... unchanged
  };

  return (
    <div className="app-container">
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
          <div className="advice-box">{advice}</div>
        </section>
      )}

      <section className="section">
        <h2>History</h2>
        <div style={{ width: '800px', height: '400px', margin: '0 auto' }}>
          <Line data={historyData} />
        </div>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {history.map((entry, i) => (
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

      <style>{`@keyframes blink { 0%, 50% { opacity: 1; text-shadow: 0 0 5px #FF9800; } 51%, 100% { opacity: 0.7; text-shadow: none; } }`}</style>

      <footer className="footer">
        <p>For enquiries: <a href="https://wa.me/254705245123" target="_blank" rel="noopener noreferrer" className="footer-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366">
            {/* Your SVG path unchanged */}
          </svg>
        </a> | <a href="https://x.com/B_D_coach_app" target="_blank" rel="noopener noreferrer" className="footer-link">
          {/* X SVG unchanged */}
        </a> | <a href="https://www.tiktok.com/@budget_and_debt_coach" target="_blank" rel="noopener noreferrer" className="footer-link">
          {/* TikTok SVG unchanged */}
        </a></p>
      </footer>
    </div>
  );
}

export default App;
