import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_META = {
  urgent: { label: 'Urgent', color: '#ef4444', dot: '🔴' },
  high:   { label: 'High',   color: '#f97316', dot: '🟠' },
  medium: { label: 'Medium', color: '#eab308', dot: '🟡' },
  low:    { label: 'Low',    color: '#6b7280', dot: '⚪' }
};

const STATUS_COLS = [
  { id: 'todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done',        label: 'Done',        color: '#10b981' }
];

function formatDate(d) {
  if (!d) return null;
  const date = new Date(d + 'T12:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const target = new Date(date); target.setHours(0,0,0,0);
  if (target.getTime() === today.getTime()) return '📅 Today';
  if (target.getTime() === tomorrow.getTime()) return '📅 Tomorrow';
  return '📅 ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dueDate) {
  if (!dueDate) return false;
  const d = new Date(dueDate + 'T23:59:59');
  return d < new Date();
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0f;
    --surface: #12121a;
    --surface2: #1a1a26;
    --surface3: #22223a;
    --border: #2a2a40;
    --text: #e8e8f0;
    --text2: #9090b0;
    --text3: #5a5a7a;
    --accent: #7c6cff;
    --accent2: #a78bfa;
    --green: #10b981;
    --red: #ef4444;
    --yellow: #f59e0b;
    --radius: 10px;
    --font: 'Syne', sans-serif;
    --mono: 'DM Mono', monospace;
  }
  html, body, #root { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .app { display: flex; height: 100dvh; overflow: hidden; }

  /* Sidebar */
  .sidebar {
    width: 220px; flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
    z-index: 100;
  }
  .sidebar-logo {
    padding: 20px 16px 12px;
    font-size: 18px; font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-section { padding: 12px 8px 4px; }
  .sidebar-label {
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
    color: var(--text3); text-transform: uppercase;
    padding: 0 8px 6px;
  }
  .sidebar-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 8px;
    cursor: pointer; font-size: 13px; font-weight: 600;
    color: var(--text2); transition: all 0.15s;
    white-space: nowrap; overflow: hidden;
  }
  .sidebar-item:hover { background: var(--surface2); color: var(--text); }
  .sidebar-item.active { background: var(--surface3); color: var(--text); }
  .sidebar-item .dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .sidebar-item .count {
    margin-left: auto; font-size: 11px; font-family: var(--mono);
    color: var(--text3); background: var(--surface3);
    padding: 1px 6px; border-radius: 10px;
  }
  .sidebar-add-project {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; margin: 4px 8px;
    border-radius: 6px; cursor: pointer;
    font-size: 12px; color: var(--text3);
    transition: all 0.15s; border: 1px dashed var(--border);
  }
  .sidebar-add-project:hover { color: var(--accent); border-color: var(--accent); }
  .sidebar-footer { margin-top: auto; padding: 12px; border-top: 1px solid var(--border); }

  /* Main */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  /* Top bar */
  .topbar {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .topbar-title { font-size: 16px; font-weight: 700; flex: 1; }
  .view-toggle {
    display: flex; background: var(--surface2); border-radius: 8px; padding: 3px; gap: 2px;
  }
  .view-btn {
    padding: 5px 10px; border-radius: 6px; border: none;
    background: transparent; color: var(--text3);
    cursor: pointer; font-size: 13px; font-family: var(--font);
    font-weight: 600; transition: all 0.15s;
  }
  .view-btn.active { background: var(--surface3); color: var(--text); }
  .icon-btn {
    width: 32px; height: 32px; border-radius: 8px; border: none;
    background: var(--surface2); color: var(--text2);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 16px; transition: all 0.15s;
  }
  .icon-btn:hover { background: var(--surface3); color: var(--text); }

  /* Quick add */
  .quick-add-bar {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .quick-add-wrap {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 10px 14px;
    transition: border-color 0.15s;
  }
  .quick-add-wrap:focus-within { border-color: var(--accent); }
  .quick-add-wrap .icon { font-size: 18px; flex-shrink: 0; }
  .quick-add-input {
    flex: 1; background: none; border: none; outline: none;
    color: var(--text); font-family: var(--font); font-size: 14px;
    font-weight: 500;
  }
  .quick-add-input::placeholder { color: var(--text3); }
  .quick-add-hint {
    font-size: 11px; color: var(--text3); font-family: var(--mono);
    flex-shrink: 0;
  }
  .nlp-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
    padding: 2px 6px; border-radius: 4px;
    background: linear-gradient(135deg, #7c6cff22, #a78bfa22);
    border: 1px solid #7c6cff44; color: var(--accent2);
    flex-shrink: 0;
  }

  /* Content */
  .content { flex: 1; overflow: auto; padding: 20px; }

  /* List view */
  .task-group { margin-bottom: 24px; }
  .task-group-header {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--text3);
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
  .task-group-header .line { flex: 1; height: 1px; background: var(--border); }

  .task-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: var(--radius);
    border: 1px solid transparent;
    background: var(--surface);
    margin-bottom: 4px;
    cursor: pointer; transition: all 0.15s;
    position: relative;
  }
  .task-item:hover { border-color: var(--border); background: var(--surface2); }
  .task-item.done { opacity: 0.5; }
  .task-item.overdue .task-due { color: var(--red) !important; }

  .task-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid var(--border); flex-shrink: 0;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; margin-top: 1px;
  }
  .task-check:hover { border-color: var(--accent); }
  .task-check.done { background: var(--green); border-color: var(--green); }
  .task-check.done::after { content: '✓'; color: white; font-size: 11px; font-weight: 700; }

  .task-body { flex: 1; min-width: 0; }
  .task-title {
    font-size: 14px; font-weight: 600; color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .task-item.done .task-title { text-decoration: line-through; }
  .task-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
  .task-due { font-size: 11px; color: var(--text3); font-family: var(--mono); }
  .task-tag {
    font-size: 10px; padding: 1px 6px; border-radius: 4px;
    background: var(--surface3); color: var(--text2); font-weight: 600;
  }
  .task-priority-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px;
  }
  .task-project-badge {
    font-size: 10px; padding: 1px 6px; border-radius: 4px;
    font-weight: 600; color: white; opacity: 0.8;
  }

  /* Kanban */
  .kanban { display: flex; gap: 16px; height: 100%; align-items: flex-start; }
  .kanban-col {
    flex: 0 0 280px; background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    display: flex; flex-direction: column; max-height: calc(100vh - 180px);
  }
  .kanban-col-header {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .kanban-col-header .col-dot {
    width: 8px; height: 8px; border-radius: 50%;
  }
  .kanban-col-header .col-count {
    margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--text3);
  }
  .kanban-cards { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .kanban-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px; cursor: pointer;
    transition: all 0.15s;
  }
  .kanban-card:hover { border-color: var(--accent); transform: translateY(-1px); }
  .kanban-card-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .kanban-card-footer { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .kanban-status-btn {
    padding: 3px 8px; border-radius: 4px; border: none;
    cursor: pointer; font-size: 10px; font-weight: 700; font-family: var(--font);
    transition: all 0.15s; opacity: 0.7;
  }
  .kanban-status-btn:hover { opacity: 1; }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 20px;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; width: 100%; max-width: 520px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .modal-header {
    display: flex; align-items: center; gap: 10px;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
  }
  .modal-title { flex: 1; font-size: 15px; font-weight: 700; }
  .modal-close {
    width: 28px; height: 28px; border-radius: 6px; border: none;
    background: var(--surface2); color: var(--text2);
    cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;
  }
  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .modal-footer { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }

  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text3); }
  .field-input {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 12px;
    color: var(--text); font-family: var(--font); font-size: 14px;
    outline: none; width: 100%; transition: border-color 0.15s;
  }
  .field-input:focus { border-color: var(--accent); }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field-select {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 12px;
    color: var(--text); font-family: var(--font); font-size: 14px;
    outline: none; width: 100%; cursor: pointer;
    transition: border-color 0.15s; appearance: none;
  }
  .field-select:focus { border-color: var(--accent); }

  .btn {
    padding: 9px 18px; border-radius: 8px; border: none;
    font-family: var(--font); font-size: 13px; font-weight: 700;
    cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
  }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: #6a5ce8; }
  .btn-ghost { background: var(--surface2); color: var(--text2); }
  .btn-ghost:hover { background: var(--surface3); color: var(--text); }
  .btn-danger { background: #ef444422; color: var(--red); }
  .btn-danger:hover { background: #ef444440; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Loading */
  .loading-bar {
    position: fixed; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    animation: loading 1.5s ease infinite;
    z-index: 9999;
  }
  @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

  /* Toast */
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 18px;
    font-size: 13px; font-weight: 600; color: var(--text);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    z-index: 9999; white-space: nowrap;
    animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* NLP parsing indicator */
  .nlp-parsing {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--accent2); padding: 6px 0;
  }
  .nlp-dots span {
    display: inline-block; width: 4px; height: 4px; border-radius: 50%;
    background: var(--accent); margin: 0 1px;
    animation: dot-pulse 1.2s ease infinite;
  }
  .nlp-dots span:nth-child(2) { animation-delay: 0.2s; }
  .nlp-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dot-pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }

  /* Empty state */
  .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 200px; color: var(--text3); gap: 8px;
    font-size: 13px;
  }
  .empty-state .icon { font-size: 32px; opacity: 0.5; }

  /* Mobile */
  .mobile-menu-btn {
    display: none; width: 36px; height: 36px; border-radius: 8px; border: none;
    background: var(--surface2); color: var(--text); cursor: pointer;
    font-size: 18px; align-items: center; justify-content: center;
  }
  .sidebar-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 99;
  }

  @media (max-width: 768px) {
    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0;
      transform: translateX(-100%);
    }
    .sidebar.open { transform: translateX(0); }
    .sidebar-overlay.open { display: block; }
    .mobile-menu-btn { display: flex; }
    .kanban { overflow-x: auto; }
    .kanban-col { flex: 0 0 250px; }
    .quick-add-hint { display: none; }
    .topbar-title { font-size: 14px; }
  }

  /* Subtasks */
  .subtask-list { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .subtask-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px; border-radius: 6px;
    background: var(--surface2); font-size: 12px;
  }
  .subtask-check {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid var(--border); cursor: pointer;
    flex-shrink: 0; transition: all 0.15s;
  }
  .subtask-check.done { background: var(--green); border-color: var(--green); }

  /* Filter bar */
  .filter-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 0 20px 12px; flex-wrap: wrap;
  }
  .filter-chip {
    padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border);
    background: var(--surface2); color: var(--text2);
    font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s;
  }
  .filter-chip:hover, .filter-chip.active { border-color: var(--accent); color: var(--accent); background: #7c6cff15; }

  /* NLP result preview */
  .nlp-preview {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 14px; margin-top: 6px;
    font-size: 12px; color: var(--text2);
    display: flex; flex-wrap: wrap; gap: 8px;
  }
  .nlp-chip {
    padding: 2px 8px; border-radius: 4px;
    background: var(--surface3); color: var(--text);
    font-family: var(--mono); font-size: 11px;
  }
`;

// ── Components ────────────────────────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast">{message}</div>;
}

function TaskCheckbox({ done, onChange }) {
  return (
    <div
      className={`task-check ${done ? 'done' : ''}`}
      onClick={e => { e.stopPropagation(); onChange(!done); }}
    />
  );
}

function TaskModal({ task, projects, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    projectId: task?.projectId || 'inbox',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    dueDate: task?.dueDate || '',
    dueTime: task?.dueTime || '',
    tags: (task?.tags || []).join(', '),
    recurrence: task?.recurrence || '',
    subtasks: task?.subtasks || []
  });
  const [newSub, setNewSub] = useState('');

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addSubtask = () => {
    if (!newSub.trim()) return;
    update('subtasks', [...form.subtasks, { id: Date.now().toString(), title: newSub.trim(), done: false }]);
    setNewSub('');
  };

  const toggleSubtask = (id) => {
    update('subtasks', form.subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const handleSave = () => {
    onSave({
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      dueDate: form.dueDate || null,
      dueTime: form.dueTime || null,
      recurrence: form.recurrence || null
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{task?.id ? 'Edit Task' : 'New Task'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Title</label>
            <input className="field-input" value={form.title} onChange={e => update('title', e.target.value)}
              placeholder="Task title..." autoFocus />
          </div>
          <div className="field-group">
            <label className="field-label">Description</label>
            <textarea className="field-input" rows={2} value={form.description}
              onChange={e => update('description', e.target.value)} placeholder="Optional notes..." />
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Project</label>
              <select className="field-select" value={form.projectId} onChange={e => update('projectId', e.target.value)}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Priority</label>
              <select className="field-select" value={form.priority} onChange={e => update('priority', e.target.value)}>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.dot} {v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Due Date</label>
              <input type="date" className="field-input" value={form.dueDate}
                onChange={e => update('dueDate', e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Due Time</label>
              <input type="time" className="field-input" value={form.dueTime}
                onChange={e => update('dueTime', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Status</label>
              <select className="field-select" value={form.status} onChange={e => update('status', e.target.value)}>
                {STATUS_COLS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Recurrence</label>
              <select className="field-select" value={form.recurrence} onChange={e => update('recurrence', e.target.value)}>
                <option value="">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Tags (comma-separated)</label>
            <input className="field-input" value={form.tags} onChange={e => update('tags', e.target.value)}
              placeholder="home, errands, work..." />
          </div>

          <div className="field-group">
            <label className="field-label">Subtasks ({form.subtasks.filter(s=>s.done).length}/{form.subtasks.length})</label>
            <div className="subtask-list">
              {form.subtasks.map(s => (
                <div key={s.id} className="subtask-item">
                  <div className={`subtask-check ${s.done ? 'done' : ''}`} onClick={() => toggleSubtask(s.id)} />
                  <span style={{ textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.5 : 1 }}>{s.title}</span>
                  <button onClick={() => update('subtasks', form.subtasks.filter(x => x.id !== s.id))}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input className="field-input" value={newSub} onChange={e => setNewSub(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
                placeholder="Add subtask..." style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={addSubtask}>+</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {task?.id && <button className="btn btn-danger" onClick={() => onDelete(task.id)}>Delete</button>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim()}>Save Task</button>
        </div>
      </div>
    </div>
  );
}

function ProjectModal({ project, onSave, onClose }) {
  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
  const ICONS = ['📁','💼','🏠','🛒','📚','🎯','💡','🔧','✈️','💪','🎨','🌱'];
  const [form, setForm] = useState({ name: project?.name || '', color: project?.color || COLORS[0], icon: project?.icon || '📁' });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <span className="modal-title">{project?.id ? 'Edit Project' : 'New Project'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Name</label>
            <input className="field-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
              placeholder="Project name..." autoFocus />
          </div>
          <div className="field-group">
            <label className="field-label">Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(f => ({...f, icon: ic}))}
                  style={{ width: 36, height: 36, border: `2px solid ${form.icon===ic ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 8, background: 'var(--surface2)', cursor: 'pointer', fontSize: 18 }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.color===c ? 'white' : 'transparent'}`, cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>
            {form.icon} Save Project
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('list'); // list | kanban
  const [selectedProject, setSelectedProject] = useState('all');
  const [loading, setLoading] = useState(false);
  const [nlpParsing, setNlpParsing] = useState(false);
  const [nlpResult, setNlpResult] = useState(null);
  const [quickInput, setQuickInput] = useState('');
  const [editTask, setEditTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active'); // active | all | done
  const inputRef = useRef();

  const showToast = useCallback((msg) => setToast(msg), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, ts] = await Promise.all([api.getProjects(), api.getTasks()]);
      setProjects(ps);
      setTasks(ts);
    } catch (e) {
      showToast('⚠️ Could not connect to server');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Filtered tasks
  const displayTasks = tasks.filter(t => {
    if (selectedProject !== 'all' && t.projectId !== selectedProject) return false;
    if (filterStatus === 'active') return t.status !== 'done';
    if (filterStatus === 'done') return t.status === 'done';
    return true;
  }).sort((a, b) => {
    const pd = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return (pd[a.priority]||2) - (pd[b.priority]||2);
  });

  const projectTaskCount = (pid) => tasks.filter(t => t.projectId === pid && t.status !== 'done').length;
  const allActiveCount = tasks.filter(t => t.status !== 'done').length;

  // Quick add (NLP)
  const handleQuickAdd = async (e) => {
    if (e.key !== 'Enter' || !quickInput.trim()) return;
    const input = quickInput.trim();
    setQuickInput('');
    setNlpResult(null);
    setNlpParsing(true);
    try {
      const { task, parsed } = await api.createTaskNLP(input, selectedProject !== 'all' ? selectedProject : undefined);
      setTasks(ts => [task, ...ts]);
      setNlpResult(parsed);
      showToast('✨ Task added');
      setTimeout(() => setNlpResult(null), 4000);
    } catch {
      showToast('⚠️ Error creating task');
    }
    setNlpParsing(false);
  };

  const handleToggleDone = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const updated = await api.updateTask(task.id, { status: newStatus });
    setTasks(ts => ts.map(t => t.id === task.id ? updated : t));
  };

  const handleSaveTask = async (form) => {
    let updated;
    if (editTask?.id) {
      updated = await api.updateTask(editTask.id, form);
      setTasks(ts => ts.map(t => t.id === editTask.id ? updated : t));
      showToast('✅ Task saved');
    } else {
      updated = await api.createTask(form);
      setTasks(ts => [updated, ...ts]);
      showToast('✅ Task created');
    }
    setShowTaskModal(false);
    setEditTask(null);
  };

  const handleDeleteTask = async (id) => {
    await api.deleteTask(id);
    setTasks(ts => ts.filter(t => t.id !== id));
    setShowTaskModal(false);
    setEditTask(null);
    showToast('🗑️ Task deleted');
  };

  const handleSaveProject = async (form) => {
    if (editProject?.id) {
      const p = await api.updateProject(editProject.id, form);
      setProjects(ps => ps.map(x => x.id === editProject.id ? p : x));
    } else {
      const p = await api.createProject(form);
      setProjects(ps => [...ps, p]);
    }
    setShowProjectModal(false);
    setEditProject(null);
  };

  const openEditTask = (task) => {
    setEditTask(task);
    setShowTaskModal(true);
    setSidebarOpen(false);
  };

  const currentProject = selectedProject !== 'all' ? projects.find(p => p.id === selectedProject) : null;
  const title = currentProject ? `${currentProject.icon} ${currentProject.name}` : '✦ All Tasks';

  // ── List View ──
  const renderList = () => {
    const today = new Date().toISOString().split('T')[0];
    const groups = [
      { key: 'overdue', label: '⚠ Overdue', tasks: displayTasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done') },
      { key: 'today',   label: '📅 Today',   tasks: displayTasks.filter(t => t.dueDate === today) },
      { key: 'later',   label: '📆 Upcoming', tasks: displayTasks.filter(t => t.dueDate && t.dueDate > today) },
      { key: 'nodate',  label: '📋 No Date',  tasks: displayTasks.filter(t => !t.dueDate && t.status !== 'done') },
      { key: 'done',    label: '✓ Completed', tasks: displayTasks.filter(t => t.status === 'done') }
    ].filter(g => g.tasks.length > 0);

    if (groups.length === 0) return (
      <div className="empty-state">
        <div className="icon">✦</div>
        <div>No tasks here. Add one above!</div>
      </div>
    );

    return groups.map(group => (
      <div key={group.key} className="task-group">
        <div className="task-group-header">
          <span>{group.label}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{group.tasks.length}</span>
          <div className="line" />
        </div>
        {group.tasks.map(task => {
          const proj = projects.find(p => p.id === task.projectId);
          const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
          return (
            <div key={task.id}
              className={`task-item ${task.status === 'done' ? 'done' : ''} ${isOverdue(task.dueDate) && task.status !== 'done' ? 'overdue' : ''}`}
              onClick={() => openEditTask(task)}>
              <TaskCheckbox done={task.status === 'done'} onChange={() => handleToggleDone(task)} />
              <div className="task-body">
                <div className="task-title">{task.title}</div>
                <div className="task-meta">
                  {task.dueDate && <span className="task-due">{formatDate(task.dueDate)}{task.dueTime ? ` ${task.dueTime}` : ''}</span>}
                  {selectedProject === 'all' && proj && (
                    <span className="task-project-badge" style={{ background: proj.color + '33', color: proj.color }}>
                      {proj.icon} {proj.name}
                    </span>
                  )}
                  {task.tags?.map(tag => <span key={tag} className="task-tag">#{tag}</span>)}
                  {task.recurrence && <span className="task-tag">🔁 {task.recurrence}</span>}
                  {task.subtasks?.length > 0 && (
                    <span className="task-due">{task.subtasks.filter(s=>s.done).length}/{task.subtasks.length} subtasks</span>
                  )}
                </div>
              </div>
              <div className="task-priority-dot" style={{ background: pm.color }} title={pm.label} />
            </div>
          );
        })}
      </div>
    ));
  };

  // ── Kanban View ──
  const renderKanban = () => (
    <div className="kanban">
      {STATUS_COLS.map(col => {
        const colTasks = displayTasks.filter(t => t.status === col.id);
        return (
          <div key={col.id} className="kanban-col">
            <div className="kanban-col-header">
              <div className="col-dot" style={{ background: col.color }} />
              {col.label}
              <span className="col-count">{colTasks.length}</span>
            </div>
            <div className="kanban-cards">
              {colTasks.length === 0 && (
                <div className="empty-state" style={{ height: 80, fontSize: 12 }}>
                  <div>Empty</div>
                </div>
              )}
              {colTasks.map(task => {
                const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                const proj = projects.find(p => p.id === task.projectId);
                return (
                  <div key={task.id} className="kanban-card" onClick={() => openEditTask(task)}>
                    <div className="kanban-card-title">{task.title}</div>
                    <div className="kanban-card-footer">
                      {task.dueDate && <span className="task-due" style={{ fontSize: 10 }}>{formatDate(task.dueDate)}</span>}
                      <span style={{ fontSize: 10, color: pm.color }}>{pm.dot} {pm.label}</span>
                      {proj && selectedProject === 'all' && (
                        <span className="task-project-badge" style={{ background: proj.color + '33', color: proj.color, fontSize: 9 }}>
                          {proj.icon}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      {STATUS_COLS.filter(s => s.id !== col.id).map(s => (
                        <button key={s.id} className="kanban-status-btn"
                          style={{ background: s.color + '22', color: s.color }}
                          onClick={async e => {
                            e.stopPropagation();
                            const updated = await api.updateTask(task.id, { status: s.id });
                            setTasks(ts => ts.map(t => t.id === task.id ? updated : t));
                          }}>
                          → {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {loading && <div className="loading-bar" />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div className="app">
        {/* Sidebar overlay (mobile) */}
        <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">✦ TaskFlow</div>

          <div className="sidebar-section">
            <div className="sidebar-label">Overview</div>
            <div className={`sidebar-item ${selectedProject === 'all' ? 'active' : ''}`}
              onClick={() => { setSelectedProject('all'); setSidebarOpen(false); }}>
              <span>🗂</span> All Tasks
              <span className="count">{allActiveCount}</span>
            </div>
            <div className={`sidebar-item ${selectedProject === 'today' ? 'active' : ''}`}
              onClick={() => { setSelectedProject('today'); setSidebarOpen(false); }}>
              <span>📅</span> Today
              <span className="count">{tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0] && t.status !== 'done').length}</span>
            </div>
          </div>

          <div className="sidebar-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-label">Projects</div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {projects.map(p => (
                <div key={p.id}
                  className={`sidebar-item ${selectedProject === p.id ? 'active' : ''}`}
                  onClick={() => { setSelectedProject(p.id); setSidebarOpen(false); }}>
                  <div className="dot" style={{ background: p.color }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.icon} {p.name}</span>
                  <span className="count">{projectTaskCount(p.id)}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="sidebar-add-project"
            onClick={() => { setEditProject(null); setShowProjectModal(true); }}>
            + New Project
          </div>

          <div className="sidebar-footer">
            <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12 }}
              onClick={async () => {
                const data = await api.exportAll();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'taskflow-export.json';
                a.click();
              }}>
              ⬇ Export JSON
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <span className="topbar-title">{title}</span>
            <div className="view-toggle">
              <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>≡ List</button>
              <button className={`view-btn ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>⊞ Board</button>
            </div>
            <button className="icon-btn" title="New task" onClick={() => { setEditTask(null); setShowTaskModal(true); }}>+</button>
          </div>

          <div className="quick-add-bar">
            <div className="quick-add-wrap">
              <span className="icon">✦</span>
              <input
                ref={inputRef}
                className="quick-add-input"
                value={quickInput}
                onChange={e => setQuickInput(e.target.value)}
                onKeyDown={handleQuickAdd}
                placeholder={nlpParsing ? 'Parsing...' : 'Add a task... try "Call dentist next friday at 3pm #health"'}
                disabled={nlpParsing}
              />
              {nlpParsing ? (
                <div className="nlp-dots">
                  <span /><span /><span />
                </div>
              ) : (
                <>
                  <span className="nlp-badge">AI</span>
                  <span className="quick-add-hint">↵ Enter</span>
                </>
              )}
            </div>
            {nlpResult && (
              <div className="nlp-preview">
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>Parsed:</span>
                <span className="nlp-chip">📝 {nlpResult.title}</span>
                {nlpResult.dueDate && <span className="nlp-chip">📅 {nlpResult.dueDate}</span>}
                {nlpResult.dueTime && <span className="nlp-chip">🕐 {nlpResult.dueTime}</span>}
                {nlpResult.priority !== 'medium' && <span className="nlp-chip">{PRIORITY_META[nlpResult.priority]?.dot} {nlpResult.priority}</span>}
                {nlpResult.tags?.map(t => <span key={t} className="nlp-chip">#{t}</span>)}
              </div>
            )}
          </div>

          <div className="filter-bar">
            {['active','all','done'].map(f => (
              <button key={f} className={`filter-chip ${filterStatus === f ? 'active' : ''}`}
                onClick={() => setFilterStatus(f)}>
                {f === 'active' ? '⚡ Active' : f === 'all' ? '◎ All' : '✓ Done'}
              </button>
            ))}
          </div>

          <div className="content">
            {view === 'list' ? renderList() : renderKanban()}
          </div>
        </main>
      </div>

      {showTaskModal && (
        <TaskModal
          task={editTask}
          projects={projects}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => { setShowTaskModal(false); setEditTask(null); }}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          project={editProject}
          onSave={handleSaveProject}
          onClose={() => { setShowProjectModal(false); setEditProject(null); }}
        />
      )}
    </>
  );
}
