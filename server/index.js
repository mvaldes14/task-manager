require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { parseNaturalLanguageTask } = require('./nlp');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

// Projects
app.get('/api/projects', (req, res) => res.json(db.getProjects()));
app.post('/api/projects', (req, res) => res.json(db.createProject(req.body)));
app.put('/api/projects/:id', (req, res) => res.json(db.updateProject(req.params.id, req.body)));
app.delete('/api/projects/:id', (req, res) => {
  if (req.params.id === 'inbox') return res.status(400).json({ error: 'Cannot delete Inbox' });
  db.deleteProject(req.params.id);
  res.json({ ok: true });
});

// Tasks
app.get('/api/tasks', (req, res) => res.json(db.getTasks(req.query)));
app.post('/api/tasks', (req, res) => res.json(db.createTask(req.body)));

app.post('/api/tasks/nlp', async (req, res) => {
  const { input, projectId } = req.body;
  if (!input) return res.status(400).json({ error: 'input required' });
  const projects = db.getProjects();
  const parsed = await parseNaturalLanguageTask(input);
  let resolvedProjectId = projectId || 'inbox';
  if (parsed.projectHint && !projectId) {
    const match = projects.find(p => p.name.toLowerCase().includes(parsed.projectHint.toLowerCase()) || parsed.projectHint.toLowerCase().includes(p.name.toLowerCase()));
    if (match) resolvedProjectId = match.id;
  }
  const task = db.createTask({
    title: parsed.title, description: parsed.description || '',
    projectId: resolvedProjectId, dueDate: parsed.dueDate, dueTime: parsed.dueTime,
    priority: parsed.priority || 'medium', tags: parsed.tags || [],
    recurrence: parsed.recurrence,
    subtasks: (parsed.subtasks || []).map(s => ({ id: uuidv4(), title: s, done: false })),
    naturalInput: parsed.naturalInput
  });
  res.json({ task, parsed });
});

app.put('/api/tasks/:id', (req, res) => res.json(db.updateTask(req.params.id, req.body)));
app.delete('/api/tasks/:id', (req, res) => { db.deleteTask(req.params.id); res.json({ ok: true }); });
app.get('/api/export', (req, res) => res.json(db.exportAll()));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✦ TaskFlow running at http://localhost:${PORT}`);
  console.log(`📱 Local network: http://YOUR_IP:${PORT}`);
  console.log(`💾 Data: ./data/db.json\n`);
});
