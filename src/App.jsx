import { useState } from 'react'
import { useTasks } from './hooks/useTasks'
import './App.css'

const CATEGORIES = ['仕事', 'プライベート', '副業']
const CATEGORY_COLORS = {
  '仕事': '#3b82f6',
  'プライベート': '#10b981',
  '副業': '#f59e0b',
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function isOverdue(task) {
  if (task.completed || !task.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(task.dueDate) < today
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const SYNC_LABELS = {
  local:   { text: 'ローカル保存', cls: 'sync-local' },
  loading: { text: '読み込み中…', cls: 'sync-loading' },
  syncing: { text: '同期中…',     cls: 'sync-loading' },
  synced:  { text: '同期済み ✓',  cls: 'sync-ok' },
  error:   { text: '同期エラー',  cls: 'sync-error-badge' },
}

function SyncBadge({ status }) {
  const { text, cls } = SYNC_LABELS[status] ?? SYNC_LABELS.local
  return <span className={`sync-badge ${cls}`}>{text}</span>
}

function TaskForm({ onAdd }) {
  const today = new Date().toISOString().split('T')[0]
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('仕事')
  const [startDate, setStartDate] = useState(today)
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('タスク名を入力してください'); return }
    if (dueDate && startDate && dueDate < startDate) {
      setError('期限日は開始日以降にしてください')
      return
    }
    onAdd({ id: generateId(), title: title.trim(), category, startDate, dueDate, completed: false, createdAt: Date.now() })
    setTitle('')
    setDueDate('')
    setError('')
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <h2 className="form-title">タスクを追加</h2>
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <input
          className="input-title"
          type="text"
          placeholder="タスク名を入力..."
          value={title}
          onChange={e => { setTitle(e.target.value); setError('') }}
          maxLength={100}
        />
      </div>
      <div className="form-row form-row--grid">
        <select className="select-category" value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="date-label">
          <span className="date-label-text">開始日</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </label>
        <label className="date-label">
          <span className="date-label-text">期限日</span>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </label>
      </div>
      <button type="submit" className="btn-add">＋ タスクを追加</button>
    </form>
  )
}

function TaskItem({ task, onToggle, onDelete }) {
  const overdue = isOverdue(task)
  return (
    <div className={`task-item${task.completed ? ' task-item--done' : ''}${overdue ? ' task-item--overdue' : ''}`}>
      <label className="task-checkbox-label">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
        />
        <span className="checkmark" />
      </label>
      <div className="task-info">
        <span className="task-title">{task.title}</span>
        <div className="task-meta">
          <span className="task-category-badge" style={{ backgroundColor: CATEGORY_COLORS[task.category] }}>
            {task.category}
          </span>
          {task.startDate && <span className="task-date">開始: {formatDate(task.startDate)}</span>}
          {task.dueDate && (
            <span className={`task-date${overdue ? ' task-date--overdue' : ''}`}>
              期限: {formatDate(task.dueDate)}
              {overdue && <span className="overdue-badge">期限切れ</span>}
            </span>
          )}
        </div>
      </div>
      <button className="btn-delete" onClick={() => onDelete(task.id)} aria-label="削除">✕</button>
    </div>
  )
}

function CategoryStats({ tasks }) {
  return (
    <div className="stats-section">
      <h2 className="stats-title">カテゴリ別達成率</h2>
      <div className="stats-grid">
        {CATEGORIES.map(cat => {
          const catTasks = tasks.filter(t => t.category === cat)
          const done = catTasks.filter(t => t.completed).length
          const total = catTasks.length
          const pct = total === 0 ? 0 : Math.round((done / total) * 100)
          return (
            <div key={cat} className="stat-card">
              <div className="stat-header">
                <span className="stat-name" style={{ color: CATEGORY_COLORS[cat] }}>{cat}</span>
                <span className="stat-fraction">{done} / {total} 件</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] }}
                />
              </div>
              <span className="stat-pct" style={{ color: CATEGORY_COLORS[cat] }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const { tasks, syncStatus, syncError, addTask, toggleTask, deleteTask: deleteFromDB } = useTasks()
  const [filterCategory, setFilterCategory] = useState('すべて')
  const [filterStatus, setFilterStatus] = useState('すべて')

  function deleteTask(id) {
    if (!window.confirm('このタスクを削除しますか？')) return
    deleteFromDB(id)
  }

  const filtered = tasks.filter(t => {
    if (filterCategory !== 'すべて' && t.category !== filterCategory) return false
    if (filterStatus === '未完了') return !t.completed
    if (filterStatus === '完了') return t.completed
    if (filterStatus === '期限切れ') return isOverdue(t)
    return true
  })

  const overdueCount = tasks.filter(isOverdue).length
  const totalDone = tasks.filter(t => t.completed).length

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1 className="app-title">📋 タスク管理</h1>
          <div className="header-right">
            <SyncBadge status={syncStatus} />
            <div className="header-summary">{totalDone} / {tasks.length} 件完了</div>
          </div>
        </div>
        {syncError && <div className="sync-error">同期エラー: {syncError}</div>}
        {overdueCount > 0 && (
          <div className="overdue-alert">⚠️ 期限切れのタスクが {overdueCount} 件あります</div>
        )}
      </header>

      <main className="app-main">
        <TaskForm onAdd={addTask} />
        <CategoryStats tasks={tasks} />

        <section className="task-section">
          <div className="filter-bar">
            <div className="filter-group">
              <span className="filter-label">カテゴリ</span>
              <div className="filter-btns">
                {['すべて', ...CATEGORIES].map(c => (
                  <button
                    key={c}
                    className={`filter-btn${filterCategory === c ? ' filter-btn--active' : ''}`}
                    style={filterCategory === c && CATEGORY_COLORS[c] ? {
                      backgroundColor: CATEGORY_COLORS[c],
                      borderColor: CATEGORY_COLORS[c],
                      color: '#fff'
                    } : {}}
                    onClick={() => setFilterCategory(c)}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">状態</span>
              <div className="filter-btns">
                {['すべて', '未完了', '完了', '期限切れ'].map(s => (
                  <button
                    key={s}
                    className={`filter-btn${filterStatus === s ? ' filter-btn--active' : ''}`}
                    onClick={() => setFilterStatus(s)}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="task-count">{filtered.length} 件のタスク</div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>タスクがありません</p>
            </div>
          ) : (
            <div className="task-list">
              {filtered.map(task => (
                <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
