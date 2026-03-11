import { useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../context/AppContext'

export function useTasks() {
  const { state, dispatch, toast } = useApp()

  const loadAll = useCallback(async () => {
    const [projects, tasks, settings] = await Promise.all([
      api.getProjects(),
      api.getTasks(),
      api.getSettings().catch(() => null),
    ])
    if (projects) dispatch({ type: 'SET_PROJECTS', payload: projects })
    if (tasks)    dispatch({ type: 'SET_TASKS',    payload: tasks })
    if (settings) dispatch({ type: 'SET_SETTINGS', payload: settings })
  }, [dispatch])

  const loadSettings = useCallback(async () => {
    const s = await api.getSettings().catch(() => null)
    if (s) dispatch({ type: 'SET_SETTINGS', payload: s })
  }, [dispatch])

  const createTask = useCallback(async (data) => {
    try {
      const task = await api.createTask(data)
      if (task) {
        dispatch({ type: 'ADD_TASK', payload: task })
        toast('Task added')
      }
      return task
    } catch (e) {
      toast('Failed to add task')
      return null
    }
  }, [dispatch, toast])

  const updateTask = useCallback(async (id, data) => {
    try {
      const task = await api.updateTask(id, data)
      if (task) dispatch({ type: 'UPDATE_TASK', payload: task })
      return task
    } catch (e) {
      toast('Failed to update task')
      return null
    }
  }, [dispatch, toast])

  const deleteTask = useCallback(async (id) => {
    try {
      await api.deleteTask(id)
      dispatch({ type: 'DELETE_TASK', payload: id })
      toast('Task deleted')
    } catch (e) {
      toast('Failed to delete task')
    }
  }, [dispatch, toast])

  const toggleTask = useCallback(async (id, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    const task = state.tasks.find(t => t.id === id)
    if (!task) return
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, status: newStatus } })
    try {
      await api.updateTask(id, { status: newStatus })
    } catch (e) {
      dispatch({ type: 'UPDATE_TASK', payload: task })
      toast('Failed to update task')
    }
  }, [state.tasks, dispatch, toast])

  return { loadAll, loadSettings, createTask, updateTask, deleteTask, toggleTask }
}
