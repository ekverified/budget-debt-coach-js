// src/components/GoalTracker.js
import React, { useState, useEffect } from 'react';
import './GoalTracker.css'; // Optional: for styling

const GoalTracker = ({ goals = [], onUpdate }) => {
  const [localGoals, setLocalGoals] = useState(goals);

  useEffect(() => {
    setLocalGoals(goals);
  }, [goals]);

  const updateProgress = (id, newProgress) => {
    const updatedGoals = localGoals.map(goal =>
      goal.id === id ? { ...goal, progress: newProgress } : goal
    );
    setLocalGoals(updatedGoals);
    onUpdate(updatedGoals);
  };

  const addGoal = () => {
    const newGoal = {
      id: Date.now(),
      name: 'New Goal',
      target: 0,
      current: 0,
      progress: 0,
      deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    const updatedGoals = [...localGoals, newGoal];
    setLocalGoals(updatedGoals);
    onUpdate(updatedGoals);
  };

  const deleteGoal = (id) => {
    const updatedGoals = localGoals.filter(goal => goal.id !== id);
    setLocalGoals(updatedGoals);
    onUpdate(updatedGoals);
  };

  return (
    <div className="goal-tracker">
      <h2>Goal Tracker</h2>
      <button onClick={addGoal} className="add-goal-btn">Add Goal</button>
      <div className="goals-list">
        {localGoals.map(goal => (
          <div key={goal.id} className="goal-item">
            <h3>{goal.name}</h3>
            <p>Target: {goal.target.toLocaleString()}</p>
            <p>Current: {goal.current.toLocaleString()}</p>
            <input
              type="range"
              min="0"
              max={goal.target}
              value={goal.progress}
              onChange={(e) => updateProgress(goal.id, parseFloat(e.target.value))}
            />
            <p>Progress: {(goal.progress / goal.target * 100).toFixed(1)}%</p>
            <input
              type="date"
              value={goal.deadline}
              onChange={(e) => {
                const updated = localGoals.map(g => g.id === goal.id ? { ...g, deadline: e.target.value } : g);
                setLocalGoals(updated);
                onUpdate(updated);
              }}
            />
            <button onClick={() => deleteGoal(goal.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalTracker;
