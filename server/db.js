const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const adapter = new FileSync(dbPath);
const db = low(adapter);

db.defaults({
  projects: [
    { id: 'inbox', name: 'Inbox', color: '#6366f1', icon: '📥', createdAt: new Date().toISOString() },
    { id: 'personal', name: 'Personal', color: '#10b981', icon: '🏠', createdAt: new Date().toISOString() },
    { id: 'work', name: 'Work', color: '#f59e0b', icon: '💼', createdAt: new Date().toISOString() }
  ],
  tasks: [],
  meta: { version: '1.0', lastUpdated: new Date().toISOString() }
}).write();

module.exports = {
  db,
  getProjects: () => db.get('projects').value(),
  getProject: (id) => db.get('projects').find({ id }).value(),
  createProject: ({ name, color = '#6366f1', icon = '📁' }) => {
    const project = { id: uuidv4(), name, color, icon, createdAt: new Date().toISOString() };
    db.get('projects').push(project).write();
    return project;
  },
  updateProject: (id, updates) => {
    db.get('projects').find({ id }).assign(updates).write();
    return db.get('projects').find({ id }).value();
  },
  deleteProject: (id) => {
    db.get('projects').remove({ id }).write();
    db.get('tasks').remove({ projectId: id }).write();
  },
  getTasks: (filters = {}) => {
    let items = db.get('tasks').value();
    if (filters.projectId) items = items.filter(t => t.projectId === filters.projectId);
    if (filters.status) items = items.filter(t => t.status === filters.status);
    return items;
  },
  getTask: (id) => db.get('tasks').find({ id }).value(),
  createTask: (taskData) => {
    const task = {
      id: uuidv4(),
      title: '',
      description: '',
      projectId: 'inbox',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      dueTime: null,
      tags: [],
      subtasks: [],
      recurrence: null,
      naturalInput: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      ...taskData
    };
    db.get('tasks').push(task).write();
    db.set('meta.lastUpdated', new Date().toISOString()).write();
    return task;
  },
  updateTask: (id, updates) => {
    updates.updatedAt = new Date().toISOString();
    if (updates.status === 'done' && !updates.completedAt) updates.completedAt = new Date().toISOString();
    db.get('tasks').find({ id }).assign(updates).write();
    db.set('meta.lastUpdated', new Date().toISOString()).write();
    return db.get('tasks').find({ id }).value();
  },
  deleteTask: (id) => { db.get('tasks').remove({ id }).write(); },
  exportAll: () => db.getState()
};
