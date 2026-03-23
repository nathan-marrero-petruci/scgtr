import { useEffect, useState, useCallback } from 'react'
import './App.css'
import { HistoricoChart } from './Charts'

// ─── API ────────────────────────────────────────────────────────────────────

const resolveApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    const configured = envUrl.replace(/\/+$/, '')
    return /\/api$/i.test(configured) ? configured : `${configured}/api`
  }
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5151/api'
  } catch (e) { /* ignore */ }
  return 'https://scgtr-production.up.railway.app/api'
}

const API_BASE = resolveApiBase()

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const text = await response.text()
    // Try to extract message from ProblemDetails JSON {"title":"...","detail":"..."}
    try {
      const json = JSON.parse(text)
      const msg = json.detail || json.title || json.error || JSON.stringify(json)
      throw new Error(msg)
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(text || 'Erro ao processar requisição')
      }
      throw parseErr
    }
  }
  if (response.status === 204) return null
  return response.json()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))

const fmtDate = (dateStr) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const getDateLabel = (dateStr) => {
  // dateStr is "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date - today) / 86400000)
  const dayName = WEEKDAY_FULL[date.getDay()]
  const formatted = `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`

  if (diffDays < 0) return { date: `${dayName}, ${formatted}`, label: 'ATRASADO', type: 'overdue' }
  if (diffDays === 0) return { date: `${dayName}, ${formatted}`, label: 'Hoje', type: 'soon' }
  if (diffDays === 1) return { date: `${dayName}, ${formatted}`, label: 'Amanhã', type: 'soon' }
  if (diffDays <= 7) return { date: `${dayName}, ${formatted}`, label: `em ${diffDays} dias`, type: 'soon' }
  return { date: `${dayName}, ${formatted}`, label: `em ${diffDays} dias`, type: 'normal' }
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return date.toISOString().slice(0, 10)
}

const scheduleLabel = (schedule) => {
  if (!schedule) return 'Sem agendamento'
  if (schedule.frequency === 'weekly') {
    const payDay = WEEKDAY_FULL[schedule.weekday] ?? '?'
    const startDay = schedule.weekStartDay != null ? WEEKDAY_FULL[schedule.weekStartDay] : null
    if (startDay) return `Semanal • Paga na ${payDay} • Semana começa ${startDay}`
    return `Semanal • Paga na ${payDay}`
  }
  if (schedule.frequency === 'quinzena') {
    return `Quinzenal • Dia ${schedule.dayOfMonth}`
  }
  return schedule.frequency
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const IconAgenda = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const IconRegister = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
)

const IconHistory = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const IconConfig = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('agenda')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [transportadoras, setTransportadoras] = useState([])
  const [error, setError] = useState('')
  // bump this to force AgendaTab to re-fetch (e.g. after saving config)
  const [agendaRefreshKey, setAgendaRefreshKey] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const loadTransportadoras = useCallback(async () => {
    try {
      const data = await request('/transportadoras?includeInactive=true')
      setTransportadoras(data)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { loadTransportadoras() }, [loadTransportadoras])

  // Refresh transportadoras AND agenda whenever user switches to Agenda tab
  const handleTabChange = useCallback(async (newTab) => {
    setTab(newTab)
    if (newTab === 'agenda') {
      await loadTransportadoras()
      setAgendaRefreshKey(k => k + 1)
    }
  }, [loadTransportadoras])

  const transportadorasAtivas = transportadoras.filter(t => t.ativa)

  const TABS = [
    { id: 'agenda',    label: 'Agenda',    Icon: IconAgenda },
    { id: 'registrar', label: 'Registrar', Icon: IconRegister },
    { id: 'historico', label: 'Histórico', Icon: IconHistory },
    { id: 'config',    label: 'Config',    Icon: IconConfig },
  ]

  const tabTitles = {
    agenda:    'Próximos Recebimentos',
    registrar: 'Registrar Rota',
    historico: 'Histórico',
    config:    'Configurações',
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{tabTitles[tab]}</h1>
        <div className="app-header-right">
          <div className="theme-toggle-wrapper">
            <span style={{ fontSize: 16 }}>☀️</span>
            <label className="theme-toggle">
              <input type="checkbox" checked={theme === 'dark'} onChange={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
              <span className="slider" />
            </label>
            <span style={{ fontSize: 16 }}>🌙</span>
          </div>
        </div>
      </header>

      <main className="tab-content">
        {error && (
          <div className="error">
            {error}
            <button className="btn-ghost btn-small" style={{ marginLeft: 8 }} onClick={() => setError('')}>✕</button>
          </div>
        )}

        {tab === 'agenda' && (
          <AgendaTab
            key={agendaRefreshKey}
            transportadoras={transportadoras}
            onError={setError}
          />
        )}
        {tab === 'registrar' && (
          <RegistrarTab transportadorasAtivas={transportadorasAtivas} onError={setError} />
        )}
        {tab === 'historico' && (
          <HistoricoTab transportadorasAtivas={transportadorasAtivas} onError={setError} />
        )}
        {tab === 'config' && (
          <ConfigTab
            transportadoras={transportadoras}
            onRefresh={async () => { await loadTransportadoras(); setAgendaRefreshKey(k => k + 1) }}
            onError={setError}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <div className="sidebar-logo">SCGTR</div>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => handleTabChange(id)}
            aria-label={label}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Agenda Tab ─────────────────────────────────────────────────────────────

function AgendaTab({ transportadoras, onError }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  // 'pending' = tudo não pago com valor > 0 | 'upcoming' = só futuros | 'paid' = recebidos | 'all' = todos
  const [filter, setFilter] = useState('pending')
  const [confirmingId, setConfirmingId] = useState(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const today = todayStr()
      const start = addDays(today, -60) // pega atrasados dos últimos 2 meses
      const end = addDays(today, 30)    // próximos 30 dias
      const data = await request(`/payments?startDate=${start}&endDate=${end}`)
      setPayments(data)
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const handleConfirm = async (payment) => {
    const key = `${payment.transportadoraId}-${payment.scheduledDate}-${payment.periodStart}`
    setConfirmingId(key)
    try {
      await request('/payments', {
        method: 'POST',
        body: JSON.stringify({
          transportadoraId: payment.transportadoraId,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          amountReceived: payment.amountDue,
          notes: null,
        }),
      })
      await fetchPayments()
    } catch (err) {
      onError(err.message)
    } finally {
      setConfirmingId(null)
    }
  }

  const today = todayStr()

  // Transportadoras ativas sem agendamento: o backend só gera slots de pagamento
  // para transportadoras com schedule configurado, então basta checar quais não aparecem nos payments
  const carriersWithPayments = new Set(payments.map(p => p.transportadoraId))
  const semAgendamento = transportadoras.filter(t => t.ativa && !carriersWithPayments.has(t.id))

  const filtered = payments.filter(p => {
    // Nunca exibir entradas sem valor E não pagas (semanas sem rotas cadastradas)
    const temValor = Number(p.amountDue ?? 0) > 0 || p.paid
    if (!temValor) return false

    if (filter === 'pending')  return !p.paid  // tudo não pago que tem valor (inclui atrasados)
    if (filter === 'upcoming') return p.scheduledDate >= today && !p.paid  // só futuros
    if (filter === 'paid')     return p.paid
    return true
  })

  // Group by scheduledDate
  const grouped = filtered.reduce((acc, p) => {
    if (!acc[p.scheduledDate]) acc[p.scheduledDate] = []
    acc[p.scheduledDate].push(p)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort()

  const FILTERS = [
    { id: 'pending',  label: 'A receber' },
    { id: 'upcoming', label: 'Próximos' },
    { id: 'paid',     label: 'Recebidos' },
    { id: 'all',      label: 'Todos' },
  ]

  return (
    <div>
      <div className="agenda-filter">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`filter-chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Aviso de transportadoras sem agendamento */}
      {!loading && semAgendamento.length > 0 && (
        <div style={{
          background: 'var(--badge-pending-bg)',
          border: '1px solid var(--badge-pending-border)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 12,
          fontSize: 13,
          color: 'var(--badge-pending-text)',
        }}>
          <strong>Sem agendamento:</strong>{' '}
          {semAgendamento.map(t => t.nome).join(', ')}.{' '}
          Configure em <strong>Config → Agenda</strong> para aparecer aqui.
        </div>
      )}

      {loading && <div className="loading-text">Carregando...</div>}

      {!loading && sortedDates.length === 0 && (
        <div className="agenda-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div>Nenhum recebimento encontrado.</div>
          <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-muted)' }}>
            {semAgendamento.length > 0
              ? 'Configure o agendamento das transportadoras em Config.'
              : 'Nenhum pagamento pendente neste período.'}
          </div>
        </div>
      )}

      {sortedDates.map(dateStr => {
        const items = grouped[dateStr]
        const { date, label, type } = getDateLabel(dateStr)
        const totalDue = items.reduce((s, p) => s + (p.paid ? 0 : Number(p.amountDue ?? 0)), 0)
        const totalReceived = items.reduce((s, p) => s + (p.paid ? Number(p.amountReceived ?? 0) : 0), 0)
        const allPaid = items.every(p => p.paid)
        const hasMultiple = items.length > 1

        return (
          <div key={dateStr} className="payment-group">
            <div className="payment-group-header">
              <span className="payment-group-date">{date}</span>
              {!allPaid && <span className={`payment-group-label ${type}`}>{label}</span>}
            </div>

            {items.map((p, idx) => {
              const key = `${p.transportadoraId}-${p.scheduledDate}-${p.periodStart}`
              const isConfirming = confirmingId === key
              return (
                <div key={idx} className="payment-item">
                  <div className="payment-item-row">
                    <div>
                      <div className="payment-item-name">{p.transportadoraNome}</div>
                      <div className="payment-item-period">
                        {fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}
                      </div>
                    </div>
                    <div className="payment-item-amount">{fmt(p.paid ? p.amountReceived : p.amountDue)}</div>
                  </div>
                  <div className="payment-item-footer">
                    {p.paid ? (
                      <span className="badge badge-paid">Recebido</span>
                    ) : type === 'overdue' ? (
                      <span className="badge badge-overdue">Atrasado</span>
                    ) : (
                      <span className="badge badge-pending">Pendente</span>
                    )}
                    {!p.paid && (
                      <button
                        className="btn-success btn-small"
                        disabled={isConfirming}
                        onClick={() => handleConfirm(p)}
                      >
                        {isConfirming ? 'Salvando...' : 'Confirmar recebimento'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {hasMultiple && !allPaid && (
              <div className="payment-group-total">
                <span>Total do dia</span>
                <span>{fmt(totalDue > 0 ? totalDue : totalReceived)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Registrar Tab ───────────────────────────────────────────────────────────

function RegistrarTab({ transportadorasAtivas, onError }) {
  const lastTransportadoraId = localStorage.getItem('lastTransportadoraId') || ''
  const [form, setForm] = useState({
    transportadoraId: lastTransportadoraId,
    dataRota: todayStr(),
    valorFixo: '',
    valorPorPacote: '',
    quantidadePacotes: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    try {
      await request('/rotas', {
        method: 'POST',
        body: JSON.stringify({
          transportadoraId: Number(form.transportadoraId),
          dataRota: form.dataRota,
          valorFixo: form.valorFixo === '' ? null : Number(form.valorFixo),
          valorPorPacote: form.valorPorPacote === '' ? null : Number(form.valorPorPacote),
          quantidadePacotes: Number(form.quantidadePacotes || 0),
        }),
      })
      localStorage.setItem('lastTransportadoraId', form.transportadoraId)
      setForm(prev => ({
        ...prev,
        dataRota: todayStr(),
        valorFixo: '',
        valorPorPacote: '',
        quantidadePacotes: '',
      }))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Live total preview
  const previewTotal = (() => {
    const fixo = Number(form.valorFixo || 0)
    const porPacote = Number(form.valorPorPacote || 0)
    const qtd = Number(form.quantidadePacotes || 0)
    const total = fixo + porPacote * qtd
    return total > 0 ? fmt(total) : null
  })()

  return (
    <div>
      {success && <div className="success-msg">Rota cadastrada com sucesso!</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-group">
            <label>
              Transportadora
              <select
                value={form.transportadoraId}
                onChange={e => set('transportadoraId', e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {transportadorasAtivas.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-group">
            <label>
              Data da rota
              <input
                type="date"
                value={form.dataRota}
                onChange={e => set('dataRota', e.target.value)}
                required
              />
            </label>
          </div>

          <hr className="divider" />

          <div className="form-row">
            <div className="form-group">
              <label>
                Valor fixo (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.valorFixo}
                  onChange={e => set('valorFixo', e.target.value)}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Valor/pacote (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.valorPorPacote}
                  onChange={e => set('valorPorPacote', e.target.value)}
                />
              </label>
            </div>
          </div>

          {form.valorPorPacote !== '' && Number(form.valorPorPacote) > 0 && (
            <div className="form-group">
              <label>
                Qtde de pacotes
                <input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={form.quantidadePacotes}
                  onChange={e => set('quantidadePacotes', e.target.value)}
                  required
                />
              </label>
            </div>
          )}

          {previewTotal && (
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total desta rota</span>
              <strong style={{ fontSize: 18 }}>{previewTotal}</strong>
            </div>
          )}
        </div>

        <button type="submit" className="btn-full" disabled={saving}>
          {saving ? 'Salvando...' : 'Cadastrar Rota'}
        </button>
      </form>
    </div>
  )
}

// ─── Histórico Tab ───────────────────────────────────────────────────────────

function HistoricoTab({ transportadorasAtivas, onError }) {
  const [rotas, setRotas] = useState([])
  const [pnrs, setPnrs] = useState([])
  const [summary, setSummary] = useState(null)
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [showChart, setShowChart] = useState(false)
  const [days, setDays] = useState(30)
  const [editingRota, setEditingRota] = useState(null) // rota object being edited

  const load = useCallback(async (d) => {
    setLoading(true)
    try {
      const end = todayStr()
      const start = addDays(end, -d)
      const [rotasData, summaryData, historicoData, pnrsData] = await Promise.all([
        request(`/rotas?startDate=${start}&endDate=${end}`),
        request(`/dashboard/summary?startDate=${start}&endDate=${end}`),
        request(`/dashboard/historico?startDate=${start}&endDate=${end}`),
        request(`/pnrs?startDate=${start}&endDate=${end}`),
      ])
      setRotas(rotasData)
      setSummary(summaryData)
      setHistorico(historicoData)
      setPnrs(pnrsData)
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  const handleDeletePnr = async (id) => {
    try {
      await request(`/pnrs/${id}`, { method: 'DELETE' })
      load(days)
    } catch (err) {
      onError(err.message)
    }
  }

  useEffect(() => { load(days) }, [days, load])

  const RANGES = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
  ]

  return (
    <div>
      <div className="agenda-filter">
        {RANGES.map(r => (
          <button
            key={r.value}
            className={`filter-chip ${days === r.value ? 'active' : ''}`}
            onClick={() => setDays(r.value)}
          >
            {r.label}
          </button>
        ))}
        <button
          className={`filter-chip ${showChart ? 'active' : ''}`}
          onClick={() => setShowChart(v => !v)}
        >
          Gráfico
        </button>
      </div>

      {loading && <div className="loading-text">Carregando...</div>}

      {!loading && summary && (
        <>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 12 }}>
            <div className="metric-card"><span>Bruto</span><strong>{fmt(summary.ganhosBrutos)}</strong></div>
            <div className="metric-card"><span>Descontos</span><strong>{fmt(summary.descontosPnr)}</strong></div>
            <div className="metric-card"><span>Líquido</span><strong>{fmt(summary.ganhosLiquidos)}</strong></div>
            <div className="metric-card"><span>Rotas</span><strong>{summary.totalRotas}</strong></div>
            <div className="metric-card"><span>Pacotes</span><strong>{summary.totalPacotes}</strong></div>
            <div className="metric-card"><span>Média/dia</span><strong>{fmt(days > 0 ? summary.ganhosLiquidos / days : 0)}</strong></div>
          </div>

          {showChart && historico.length > 0 && (
            <div className="card">
              <div className="chart-wrapper-tall">
                <HistoricoChart historico={historico} />
              </div>
            </div>
          )}

          <div className="card">
            <p className="card-title">Rotas</p>
            {rotas.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>
                Nenhuma rota neste período.
              </div>
            )}
            {rotas.slice(0, 50).map(r => (
              <div key={r.id} className="route-item">
                <div className="route-item-left">
                  <div className="route-item-name">{r.transportadoraNome}</div>
                  <div className="route-item-meta">
                    {fmtDate(r.dataRota)}
                    {r.quantidadePacotes > 0 ? ` • ${r.quantidadePacotes} pct` : ''}
                    {r.totalDescontosPnr > 0 ? ` • PNR ${fmt(r.totalDescontosPnr)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="route-item-amount">{fmt(r.valorLiquido)}</div>
                  <button className="btn-ghost btn-small" onClick={() => setEditingRota(r)}>Editar</button>
                </div>
              </div>
            ))}
          </div>

          {pnrs.length > 0 && (
            <div className="card">
              <p className="card-title">Descontos PNR</p>
              {pnrs.map(p => (
                <div key={p.id} className="route-item">
                  <div className="route-item-left">
                    <div className="route-item-name">{p.transportadoraNome}</div>
                    <div className="route-item-meta">
                      Rota: {fmtDate(p.dataRota)} • PNR: {fmtDate(p.dataPnr)}
                      {p.observacao ? ` • ${p.observacao}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="route-item-amount" style={{ color: 'var(--color-danger, #ef4444)' }}>
                      -{fmt(p.valorDesconto)}
                    </div>
                    <button className="btn-ghost btn-small" onClick={() => handleDeletePnr(p.id)} title="Remover PNR">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal de edição de rota */}
      {editingRota && (
        <EditRotaModal
          rota={editingRota}
          transportadorasAtivas={transportadorasAtivas}
          onClose={() => setEditingRota(null)}
          onSaved={() => { setEditingRota(null); load(days) }}
          onError={onError}
        />
      )}
    </div>
  )
}

function EditRotaModal({ rota, transportadorasAtivas, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    transportadoraId: String(rota.transportadoraId),
    dataRota: rota.dataRota,
    valorFixo: rota.valorFixo != null ? String(rota.valorFixo) : '',
    valorPorPacote: rota.valorPorPacote != null ? String(rota.valorPorPacote) : '',
    quantidadePacotes: rota.quantidadePacotes > 0 ? String(rota.quantidadePacotes) : '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const previewTotal = (() => {
    const fixo = Number(form.valorFixo || 0)
    const porPacote = Number(form.valorPorPacote || 0)
    const qtd = Number(form.quantidadePacotes || 0)
    const total = fixo + porPacote * qtd
    return total > 0 ? fmt(total) : null
  })()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await request(`/rotas/${rota.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          transportadoraId: Number(form.transportadoraId),
          dataRota: form.dataRota,
          valorFixo: form.valorFixo === '' ? null : Number(form.valorFixo),
          valorPorPacote: form.valorPorPacote === '' ? null : Number(form.valorPorPacote),
          quantidadePacotes: Number(form.quantidadePacotes || 0),
        }),
      })
      onSaved()
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, padding: '0 0 env(safe-area-inset-bottom)',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: '16px 16px 0 0',
        padding: 20, width: '100%', maxWidth: 600, maxHeight: '90dvh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Editar Rota #{rota.id}</h2>
          <button className="btn-ghost btn-small" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              Transportadora
              <select value={form.transportadoraId} onChange={e => set('transportadoraId', e.target.value)} required>
                <option value="">Selecione...</option>
                {transportadorasAtivas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
          </div>
          <div className="form-group">
            <label>
              Data da rota
              <input type="date" value={form.dataRota} onChange={e => set('dataRota', e.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>
                Valor fixo (R$)
                <input type="number" step="0.01" min="0" placeholder="0,00" value={form.valorFixo} onChange={e => set('valorFixo', e.target.value)} />
              </label>
            </div>
            <div className="form-group">
              <label>
                Valor/pacote (R$)
                <input type="number" step="0.01" min="0" placeholder="0,00" value={form.valorPorPacote} onChange={e => set('valorPorPacote', e.target.value)} />
              </label>
            </div>
          </div>
          {form.valorPorPacote !== '' && Number(form.valorPorPacote) > 0 && (
            <div className="form-group">
              <label>
                Qtde de pacotes
                <input type="number" min="1" value={form.quantidadePacotes} onChange={e => set('quantidadePacotes', e.target.value)} required />
              </label>
            </div>
          )}
          {previewTotal && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total</span>
              <strong>{previewTotal}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Config Tab ──────────────────────────────────────────────────────────────

function ConfigTab({ transportadoras, onRefresh, onError }) {
  const [showAddCarrier, setShowAddCarrier] = useState(false)
  const [showPnr, setShowPnr] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(null) // transportadora object
  const [carrierForm, setCarrierForm] = useState({ nome: '' })
  const [pnrForm, setPnrForm] = useState({ rotaId: '', dataPnr: todayStr(), valorDesconto: '', observacao: '' })
  const [scheduleForm, setScheduleForm] = useState({ frequency: '', weekday: '', dayOfMonth: '', weekStartDay: '' })
  const [rotas, setRotas] = useState([])
  const [saving, setSaving] = useState(false)
  const [deletingCarrierId, setDeletingCarrierId] = useState(null)

  useEffect(() => {
    if (showPnr && rotas.length === 0) {
      request('/rotas').then(setRotas).catch(e => onError(e.message))
    }
  }, [showPnr, rotas.length, onError])

  const openSchedule = async (t) => {
    // Load existing schedule
    try {
      const s = await request(`/transportadoras/${t.id}/payment-schedule`)
      setScheduleForm({
        frequency: s.frequency || '',
        weekday: s.weekday != null ? String(s.weekday) : '',
        dayOfMonth: s.dayOfMonth != null ? String(s.dayOfMonth) : '',
        weekStartDay: s.weekStartDay != null ? String(s.weekStartDay) : '',
      })
    } catch {
      setScheduleForm({ frequency: '', weekday: '', dayOfMonth: '', weekStartDay: '' })
    }
    setShowScheduleModal(t)
  }

  const handleCreateCarrier = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await request('/transportadoras', {
        method: 'POST',
        body: JSON.stringify({ nome: carrierForm.nome }),
      })
      setCarrierForm({ nome: '' })
      setShowAddCarrier(false)
      await onRefresh()
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSchedule = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        frequency: scheduleForm.frequency,
        weekday: scheduleForm.frequency === 'weekly' && scheduleForm.weekday !== ''
          ? Number(scheduleForm.weekday) : null,
        dayOfMonth: scheduleForm.frequency === 'quinzena' && scheduleForm.dayOfMonth !== ''
          ? Number(scheduleForm.dayOfMonth) : null,
        weekStartDay: scheduleForm.frequency === 'weekly' && scheduleForm.weekStartDay !== ''
          ? Number(scheduleForm.weekStartDay) : null,
      }
      await request(`/transportadoras/${showScheduleModal.id}/payment-schedule`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setShowScheduleModal(null)
      await onRefresh()
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreatePnr = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await request('/pnrs', {
        method: 'POST',
        body: JSON.stringify({
          rotaId: Number(pnrForm.rotaId),
          dataPnr: pnrForm.dataPnr,
          valorDesconto: Number(pnrForm.valorDesconto),
          observacao: pnrForm.observacao || null,
        }),
      })
      setPnrForm({ rotaId: '', dataPnr: todayStr(), valorDesconto: '', observacao: '' })
      setShowPnr(false)
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCarrier = async (t) => {
    try {
      const action = t.ativa ? 'inativar' : 'reativar'
      await request(`/transportadoras/${t.id}/${action}`, { method: 'PATCH' })
      await onRefresh()
    } catch (err) {
      onError(err.message)
    }
  }

  const handleDeleteCarrier = async (t) => {
    try {
      await request(`/transportadoras/${t.id}`, { method: 'DELETE' })
      setDeletingCarrierId(null)
      await onRefresh()
    } catch (err) {
      setDeletingCarrierId(null)
      onError(err.message)
    }
  }

  return (
    <div>
      {/* Transportadoras */}
      <p className="section-title">Transportadoras</p>
      <div className="card">
        {transportadoras.map(t => (
          <div key={t.id} className="carrier-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="carrier-name">{t.nome}</div>
              <div className="carrier-meta">
                {t.ativa ? 'Ativa' : 'Inativa'}
                {t.paymentSchedule && ` • ${scheduleLabel(t.paymentSchedule)}`}
              </div>
            </div>
            {deletingCarrierId === t.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Excluir "{t.nome}"?</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-danger btn-small" onClick={() => handleDeleteCarrier(t)}>Confirmar</button>
                  <button className="btn-ghost btn-small" onClick={() => setDeletingCarrierId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="carrier-actions">
                <button className="btn-ghost btn-small" onClick={() => openSchedule(t)}>
                  Agenda
                </button>
                <button
                  className={`btn-small ${t.ativa ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => handleToggleCarrier(t)}
                >
                  {t.ativa ? 'Inativar' : 'Reativar'}
                </button>
                <button className="btn-ghost btn-small" onClick={() => setDeletingCarrierId(t.id)} title="Excluir">
                  🗑
                </button>
              </div>
            )}
          </div>
        ))}

        {!showAddCarrier ? (
          <button className="btn-ghost btn-small" style={{ marginTop: 8 }} onClick={() => setShowAddCarrier(true)}>
            + Adicionar transportadora
          </button>
        ) : (
          <form onSubmit={handleCreateCarrier} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <input
              value={carrierForm.nome}
              onChange={e => setCarrierForm({ nome: e.target.value })}
              placeholder="Nome da transportadora"
              required
              autoFocus
            />
            <button type="submit" disabled={saving} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              {saving ? '...' : 'Salvar'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowAddCarrier(false)} style={{ flexShrink: 0 }}>
              ✕
            </button>
          </form>
        )}
      </div>

      {/* Registro de PNR */}
      <p className="section-title">Desconto / PNR</p>
      <div className="card">
        {!showPnr ? (
          <button className="btn-ghost btn-full" onClick={() => setShowPnr(true)}>
            Registrar desconto (PNR)
          </button>
        ) : (
          <form onSubmit={handleCreatePnr}>
            <div className="form-group">
              <label>
                Rota
                <select
                  value={pnrForm.rotaId}
                  onChange={e => setPnrForm(p => ({ ...p, rotaId: e.target.value }))}
                  required
                >
                  <option value="">Selecione a rota...</option>
                  {rotas.map(r => (
                    <option key={r.id} value={r.id}>
                      #{r.id} — {r.transportadoraNome} ({fmtDate(r.dataRota)}) {fmt(r.valorTotalCalculado)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Data do PNR
                  <input
                    type="date"
                    value={pnrForm.dataPnr}
                    onChange={e => setPnrForm(p => ({ ...p, dataPnr: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <div className="form-group">
                <label>
                  Valor (R$)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={pnrForm.valorDesconto}
                    onChange={e => setPnrForm(p => ({ ...p, valorDesconto: e.target.value }))}
                    required
                  />
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>
                Observação (opcional)
                <input
                  value={pnrForm.observacao}
                  onChange={e => setPnrForm(p => ({ ...p, observacao: e.target.value }))}
                  placeholder="Ex: pacote danificado"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar PNR'}</button>
              <button type="button" className="btn-ghost" onClick={() => setShowPnr(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 100, padding: '0 0 env(safe-area-inset-bottom)',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px 16px 0 0',
            padding: 20,
            width: '100%',
            maxWidth: 600,
            maxHeight: '90dvh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Agendamento — {showScheduleModal.nome}</h2>
              <button className="btn-ghost btn-small" onClick={() => setShowScheduleModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveSchedule}>
              <div className="form-group">
                <label>
                  Tipo de pagamento
                  <select
                    value={scheduleForm.frequency}
                    onChange={e => setScheduleForm(p => ({ ...p, frequency: e.target.value }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="weekly">Semanal (toda semana)</option>
                    <option value="quinzena">Quinzenal (dia 15 / fim do mês)</option>
                  </select>
                </label>
              </div>

              {scheduleForm.frequency === 'weekly' && (
                <>
                  <div className="form-group">
                    <label>
                      Dia do pagamento
                      <select
                        value={scheduleForm.weekday}
                        onChange={e => setScheduleForm(p => ({ ...p, weekday: e.target.value }))}
                        required
                      >
                        <option value="">Selecione...</option>
                        {WEEKDAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      Dia que a semana começa (opcional)
                      <select
                        value={scheduleForm.weekStartDay}
                        onChange={e => setScheduleForm(p => ({ ...p, weekStartDay: e.target.value }))}
                      >
                        <option value="">Padrão (semana começa no sábado)</option>
                        {WEEKDAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                  </div>
                  {scheduleForm.weekday !== '' && (
                    <div style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      marginBottom: 14,
                    }}>
                      {scheduleForm.weekStartDay !== ''
                        ? `Semana de ${WEEKDAY_FULL[scheduleForm.weekStartDay]} a ${WEEKDAY_FULL[(Number(scheduleForm.weekStartDay) - 1 + 7) % 7]}, recebe toda ${WEEKDAY_FULL[scheduleForm.weekday]}.`
                        : `Recebe toda ${WEEKDAY_FULL[scheduleForm.weekday]}.`
                      }
                    </div>
                  )}
                </>
              )}

              {scheduleForm.frequency === 'quinzena' && (
                <div className="form-group">
                  <label>
                    Dia do mês
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 15"
                      value={scheduleForm.dayOfMonth}
                      onChange={e => setScheduleForm(p => ({ ...p, dayOfMonth: e.target.value }))}
                      required
                    />
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Pagamento no dia {scheduleForm.dayOfMonth || '?'} e no último dia do mês.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn-full" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
