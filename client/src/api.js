const BASE = '/api';
async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export const api = {
  getProjects: () => req('GET', '/projects'),
  createProject: (d) => req('POST', '/projects', d),
  updateProject: (id, d) => req('PUT', `/projects/${id}`, d),
  deleteProject: (id) => req('DELETE', `/projects/${id}`),
  getTasks: (f={}) => { const qs = new URLSearchParams(f).toString(); return req('GET', `/tasks${qs?'?'+qs:''}`); },
  createTask: (d) => req('POST', '/tasks', d),
  createTaskNLP: (input, projectId) => req('POST', '/tasks/nlp', { input, projectId }),
  updateTask: (id, d) => req('PUT', `/tasks/${id}`, d),
  deleteTask: (id) => req('DELETE', `/tasks/${id}`),
  exportAll: () => req('GET', '/export')
};
