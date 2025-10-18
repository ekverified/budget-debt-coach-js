// src/services/api.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://api.example.com'; // Replace with your backend URL

// Example: Fetch user data (for cloud sync)
export const fetchUserData = async (userId) => {
  try {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // For auth cookies
    });
    if (!response.ok) throw new Error('Failed to fetch user data');
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Example: Save budget history
export const saveBudgetHistory = async (userId, history) => {
  try {
    const response = await fetch(`${API_BASE}/budgets/${userId}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to save history');
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Example: Integrate with bank API (e.g., Plaid mock)
export const fetchTransactions = async (accessToken) => {
  try {
    // Mock for Plaid or similar; replace with real integration
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
