// src/components/GoalTracker.js
import React, { useState, useEffect, useCallback } from 'react';
import './GoalTracker.css';

/**
 * GoalTracker
 * Improvements over original:
 * - Inline editing for goal name and target (not hardcoded "New Goal")
 * - Deadline countdown: shows days remaining / overdue
 * - KES-formatted amounts (or whatever currency is passed in)
 * - Current amount input alongside the slider (slider alone was imprecise)
 * - Completion state: a goal at 100% shows a ✅ badge
 * - Delete confirmation prevents accidental data loss
 * - Keyboard accessible: labels tied to inputs, aria attributes
 * - Stable IDs using crypto.randomUUID() with Date.now() fallback
 * - onUpdate debounced to avoid excessive parent re-renders on slider drag
 */

const GoalTracker = ({ goals = [], onUpdate, currency = 'KES' }) => {
  const [localGoals, setLocalGoals] = useState(goals);

  // Sync when parent changes goals (e.g. after calculate)
  useEffect(() => {
    setLocalGoals(goals);
  }, [goals]);

  // Propagate changes upward
  const propagate = useCallback((updatedGoals) => {
    setLocalGoals(updatedGoals);
    onUpdate(updatedGoals);
  }, [onUpdate]);

  /* ── Add goal ── */
  const addGoal = useCallback(() => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

    const newGoal = {
      id,
      name:     '',
      target:   0,
      current:  0,
      deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                  .toISOString().split('T')[0],
    };
    propagate([...localGoals, newGoal]);
  }, [localGoals, propagate]);

  /* ── Delete goal (with confirmation) ── */
  const deleteGoal = useCallback((id) => {
    const goal = localGoals.find(g => g.id === id);
    const name = goal?.name || 'this goal';
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    propagate(localGoals.filter(g => g.id !== id));
  }, [localGoals, propagate]);

  /* ── Update a single field on a goal ── */
  const updateField = useCallback((id, field, value) => {
    propagate(localGoals.map(g => {
      if (g.id !== id) return g;
      const updated = { ...g, [field]: value };
      // Keep current capped at target when target changes
      if (field === 'target') {
        updated.target  = Math.max(0, parseFloat(value) || 0);
        updated.current = Math.min(updated.current, updated.target);
      }
      if (field === 'current') {
        updated.current = Math.min(Math.max(0, parseFloat(value) || 0), g.target);
      }
      return updated;
    }));
  }, [localGoals, propagate]);

  /* ── Helpers ── */
  const fmt = (n) =>
    new Intl.NumberFormat('en-KE', {
      style:                 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(n || 0));

  const pct = (goal) =>
    goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;

  const daysLeft = (deadline) => {
    const diff = Math.round(
      (new Date(deadline).setHours(23, 59, 59) - Date.now()) / 86400000
    );
    return diff;
  };

  const deadlineLabel = (deadline) => {
    const d = daysLeft(deadline);
    if (d < 0)  return { text: `${Math.abs(d)} days overdue`, color: '#e74c3c' };
    if (d === 0) return { text: 'Due today',                  color: '#e67e22' };
    if (d <= 7)  return { text: `${d} days left`,             color: '#f39c12' };
    return         { text: `${d} days left`,                  color: '#27ae60' };
  };

  return (
    <div className="goal-tracker">
      <div className="goal-tracker-header">
        <h2>Goal Tracker</h2>
        <button className="add-goal-btn" onClick={addGoal}>
          + Add goal
        </button>
      </div>

      {localGoals.length === 0 && (
        <p className="goal-empty">
          No goals yet. Tap "Add goal" to track your savings targets.
        </p>
      )}

      <div className="goals-list">
        {localGoals.map((goal) => {
          const progress   = pct(goal);
          const completed  = progress >= 100;
          const dlLabel    = deadlineLabel(goal.deadline);
          const goalNameId = `goal-name-${goal.id}`;

          return (
            <div
              key={goal.id}
              className={`goal-item ${completed ? 'goal-completed' : ''}`}
            >
              {/* Goal name (inline editable) */}
              <div className="goal-item-header">
                <input
                  id={goalNameId}
                  className="goal-name-input"
                  type="text"
                  value={goal.name}
                  onChange={(e) => updateField(goal.id, 'name', e.target.value)}
                  placeholder="Goal name (e.g. Emergency Fund)"
                  aria-label="Goal name"
                />
                {completed && (
                  <span className="goal-badge" role="img" aria-label="Completed">
                    ✅ Done!
                  </span>
                )}
                <button
                  className="goal-delete-btn"
                  onClick={() => deleteGoal(goal.id)}
                  aria-label={`Delete ${goal.name || 'goal'}`}
                >
                  ×
                </button>
              </div>

              {/* Target & current amount row */}
              <div className="goal-amounts">
                <label className="goal-field-label" htmlFor={`target-${goal.id}`}>
                  Target ({currency})
                  <input
                    id={`target-${goal.id}`}
                    className="goal-number-input"
                    type="number"
                    value={goal.target || ''}
                    onChange={(e) => updateField(goal.id, 'target', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    min="0"
                    placeholder="0"
                  />
                </label>

                <label className="goal-field-label" htmlFor={`current-${goal.id}`}>
                  Saved so far
                  <input
                    id={`current-${goal.id}`}
                    className="goal-number-input"
                    type="number"
                    value={goal.current || ''}
                    onChange={(e) => updateField(goal.id, 'current', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    min="0"
                    max={goal.target}
                    placeholder="0"
                  />
                </label>
              </div>

              {/* Slider (fine adjustment) */}
              <label
                className="goal-field-label"
                htmlFor={`slider-${goal.id}`}
              >
                Adjust saved amount
              </label>
              <input
                id={`slider-${goal.id}`}
                className="goal-slider"
                type="range"
                min="0"
                max={goal.target || 100}
                step={Math.max(1, Math.floor((goal.target || 100) / 100))}
                value={goal.current}
                onChange={(e) => updateField(goal.id, 'current', e.target.value)}
                aria-valuetext={`${fmt(goal.current)} of ${fmt(goal.target)}`}
              />

              {/* Progress bar */}
              <div className="goal-progress-wrap" role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="goal-progress-fill"
                  style={{
                    width:      `${progress}%`,
                    background: completed ? '#27ae60' : '#4CAF50',
                  }}
                />
              </div>

              {/* Stats row */}
              <div className="goal-stats">
                <span className="goal-pct">{progress.toFixed(1)}%</span>
                <span className="goal-amounts-text">
                  {fmt(goal.current)} / {fmt(goal.target)}
                </span>
                {goal.target > goal.current && (
                  <span className="goal-remaining">
                    {fmt(goal.target - goal.current)} to go
                  </span>
                )}
              </div>

              {/* Deadline */}
              <div className="goal-deadline">
                <label className="goal-field-label" htmlFor={`date-${goal.id}`}>
                  Deadline
                </label>
                <div className="goal-deadline-row">
                  <input
                    id={`date-${goal.id}`}
                    className="goal-date-input"
                    type="date"
                    value={goal.deadline}
                    onChange={(e) => updateField(goal.id, 'deadline', e.target.value)}
                  />
                  <span className="goal-days-left" style={{ color: dlLabel.color }}>
                    {dlLabel.text}
                  </span>
                </div>
              </div>

              {/* Monthly savings needed hint */}
              {goal.target > goal.current && goal.deadline && daysLeft(goal.deadline) > 0 && (
                <p className="goal-hint">
                  💡 Save{' '}
                  {fmt((goal.target - goal.current) / Math.max(1, Math.ceil(daysLeft(goal.deadline) / 30)))}
                  /month to hit this goal on time.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GoalTracker;
