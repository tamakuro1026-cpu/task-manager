import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const LS_KEY = 'tasks'

function loadFromLocalStorage() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function saveToLocalStorage(tasks) {
  localStorage.setItem(LS_KEY, JSON.stringify(tasks))
}

// Map Supabase snake_case row → app camelCase object
function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    startDate: row.start_date ?? '',
    dueDate: row.due_date ?? '',
    completed: row.completed,
    createdAt: row.created_at,
  }
}

// Map app object → Supabase row
function taskToRow(task) {
  return {
    id: task.id,
    title: task.title,
    category: task.category,
    start_date: task.startDate || null,
    due_date: task.dueDate || null,
    completed: task.completed,
    
  }
}

export function useTasks() {
  const [tasks, setTasks] = useState(loadFromLocalStorage)
  const [syncStatus, setSyncStatus] = useState(isConfigured ? 'loading' : 'local')
  const [syncError, setSyncError] = useState(null)

  // Initial fetch from Supabase
  useEffect(() => {
    if (!isConfigured) return

    async function fetchTasks() {
      setSyncStatus('loading')
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setSyncError(error.message)
        setSyncStatus('error')
        return
      }

      const fetched = data.map(rowToTask)
      setTasks(fetched)
      saveToLocalStorage(fetched)
      setSyncStatus('synced')
      setSyncError(null)
    }

    fetchTasks()
  }, [])

  // Real-time subscription
  useEffect(() => {
    if (!isConfigured) return

    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        // Re-fetch on any change from other devices
        supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) {
              const updated = data.map(rowToTask)
              setTasks(updated)
              saveToLocalStorage(updated)
            }
          })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const addTask = useCallback(async (task) => {
    setTasks(prev => {
      const next = [task, ...prev]
      saveToLocalStorage(next)
      return next
    })

    if (!isConfigured) return

    setSyncStatus('syncing')
    const { error } = await supabase.from('tasks').insert(taskToRow(task))
    if (error) { setSyncError(error.message); setSyncStatus('error') }
    else { setSyncStatus('synced'); setSyncError(null) }
  }, [])

  const toggleTask = useCallback(async (id) => {
    let updatedTask = null
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t
        updatedTask = { ...t, completed: !t.completed }
        return updatedTask
      })
      saveToLocalStorage(next)
      return next
    })

    if (!isConfigured || !updatedTask) return

    setSyncStatus('syncing')
    const { error } = await supabase
      .from('tasks')
      .update({ completed: updatedTask.completed })
      .eq('id', id)
    if (error) { setSyncError(error.message); setSyncStatus('error') }
    else { setSyncStatus('synced'); setSyncError(null) }
  }, [])

  const deleteTask = useCallback(async (id) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id)
      saveToLocalStorage(next)
      return next
    })

    if (!isConfigured) return

    setSyncStatus('syncing')
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { setSyncError(error.message); setSyncStatus('error') }
    else { setSyncStatus('synced'); setSyncError(null) }
  }, [])

  return { tasks, syncStatus, syncError, addTask, toggleTask, deleteTask }
}
