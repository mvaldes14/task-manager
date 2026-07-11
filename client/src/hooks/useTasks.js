import { useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../context/AppContext'

// Number of task mutations currently in flight. Shared across all useTasks
// consumers so a background refresh (useRefreshOnFocus) can avoid clobbering
// optimistic writes with a stale full-list refetch.
let pendingMutations = 0
export const isMutating = () => pendingMutations > 0

export function useTasks() {
  const { state, dispatch, toast } = useApp()

  const loadAll = useCallback(async () => {
    const [projects, tasks] = await Promise.all([
      api.getProjects(),
      api.getTasks(),
    ])
    if (projects) dispatch({ type: 'SET_PROJECTS', payload: projects })
    if (tasks)    dispatch({ type: 'SET_TASKS',    payload: tasks })
    dispatch({ type: 'SET_TASKS_LOADED' })
  }, [dispatch])

  const loadSettings = useCallback(async () => {
    const s = await api.getSettings().catch(() => null)
    if (s) dispatch({ type: 'SET_SETTINGS', payload: s })
  }, [dispatch])

  const createTask = useCallback(async (data) => {
    pendingMutations++
    try {
      const task = await api.createTask(data)
      if (task) {
        dispatch({ type: 'ADD_TASK', payload: task })
        toast(task.ai_webhook_fired ? 'Task added · AI webhook dispatched' : 'Task added')
      }
      return task
    } catch (e) {
      toast('Failed to add task')
      return null
    } finally {
      pendingMutations--
    }
  }, [dispatch, toast])

  const updateTask = useCallback(async (id, data) => {
    pendingMutations++
    try {
      const task = await api.updateTask(id, data)
      if (task) {
        dispatch({ type: 'UPDATE_TASK', payload: task })
        if (task.ai_webhook_fired) toast('AI webhook dispatched')
      }
      return task
    } catch (e) {
      toast('Failed to update task')
      return null
    } finally {
      pendingMutations--
    }
  }, [dispatch, toast])

  const deleteTask = useCallback(async (id) => {
    pendingMutations++
    try {
      await api.deleteTask(id)
      dispatch({ type: 'DELETE_TASK', payload: id })
      toast('Task deleted')
    } catch (e) {
      toast('Failed to delete task')
    } finally {
      pendingMutations--
    }
  }, [dispatch, toast])

  const toggleTask = useCallback(async (id, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    const task = state.tasks.find(t => t.id === id)
    if (!task) return
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, status: newStatus } })
    pendingMutations++
    try {
      const updated = await api.updateTask(id, { status: newStatus })
      dispatch({ type: 'UPDATE_TASK', payload: updated })
      if (updated.recurrence_next) {
        dispatch({ type: 'ADD_TASK', payload: updated.recurrence_next })
      }
    } catch (e) {
      dispatch({ type: 'UPDATE_TASK', payload: task })
      toast('Failed to update task')
    } finally {
      pendingMutations--
    }
  }, [state.tasks, dispatch, toast])

  return { loadAll, loadSettings, createTask, updateTask, deleteTask, toggleTask }
}
