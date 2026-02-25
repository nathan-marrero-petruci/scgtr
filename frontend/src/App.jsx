import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { SummaryChart, PrevisaoChart, HistoricoChart, TipoRotaChart } from './Charts'

const API_BASE = 'http://localhost:5151/api'

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value ?? 0),
  )

function App() {
  const today = new Date().toISOString().slice(0, 10)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'charts')
  const [transportadoras, setTransportadoras] = useState([])
  const [rotas, setRotas] = useState([])
  const [pnrs, setPnrs] = useState([])
  const [summary, setSummary] = useState(null)
  const [previsao, setPrevisao] = useState([])
  const [historico, setHistorico] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [range, setRange] = useState({ startDate: today, endDate: today })
  const [filterTransportadoraId, setFilterTransportadoraId] = useState('')
  const [filterOnlyActive, setFilterOnlyActive] = useState(true)
  const [showTransportadorasHistorico, setShowTransportadorasHistorico] = useState(false)
  const [showRotasHistorico, setShowRotasHistorico] = useState(false)
  const [showPnrsHistorico, setShowPnrsHistorico] = useState(false)

  const [transportadoraForm, setTransportadoraForm] = useState({ nome: '' })
  const [rotaForm, setRotaForm] = useState({
    transportadoraId: '',
    dataRota: today,
    valorFixo: '',
    valorPorPacote: '',
    quantidadePacotes: 0,
  })
  const [pnrForm, setPnrForm] = useState({
    rotaId: '',
    dataPnr: today,
    valorDesconto: '',
    observacao: '',
  })

  const rotasRecentes = useMemo(() => rotas.slice(0, 10), [rotas])
  const transportadorasAtivas = useMemo(() => transportadoras.filter(t => t.ativa), [transportadoras])
  const activeTransportadoraIds = useMemo(
    () => new Set(transportadorasAtivas.map(t => t.id)),
    [transportadorasAtivas]
  )
  const filteredRotasForChart = useMemo(() => {
    const start = range.startDate
    const end = range.endDate
    const selectedId = filterTransportadoraId ? Number(filterTransportadoraId) : null

    return rotas.filter((rota) => {
      if (start && rota.dataRota < start) return false
      if (end && rota.dataRota > end) return false
      if (selectedId && rota.transportadoraId !== selectedId) return false
      if (filterOnlyActive && !activeTransportadoraIds.has(rota.transportadoraId)) return false
      return true
    })
  }, [
    rotas,
    range.startDate,
    range.endDate,
    filterTransportadoraId,
    filterOnlyActive,
    activeTransportadoraIds,
  ])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const changeViewMode = (mode) => {
    setViewMode(mode)
  }

  const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'Erro ao processar requisição')
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  }

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      let query = `?startDate=${range.startDate}&endDate=${range.endDate}`
      if (filterTransportadoraId) {
        query += `&transportadoraId=${filterTransportadoraId}`
      }
      if (filterOnlyActive) {
        query += `&onlyActive=true`
      }
      const [transportadorasData, rotasData, pnrsData, summaryData, previsaoData, historicoData] = await Promise.all([
        request('/transportadoras?includeInactive=true'),
        request('/rotas'),
        request('/pnrs'),
        request(`/dashboard/summary${query}`),
        request(`/dashboard/previsao${query}`),
        request(`/dashboard/historico${query}`),
      ])

      setTransportadoras(transportadorasData)
      setRotas(rotasData)
      setPnrs(pnrsData)
      setSummary(summaryData)
      setPrevisao(previsaoData)
      setHistorico(historicoData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateTransportadora = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await request('/transportadoras', {
        method: 'POST',
        body: JSON.stringify({ nome: transportadoraForm.nome }),
      })
      setTransportadoraForm({ nome: '' })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleInativarTransportadora = async (id) => {
    setError('')
    try {
      await request(`/transportadoras/${id}/inativar`, { method: 'PATCH' })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleReativarTransportadora = async (id) => {
    setError('')
    try {
      await request(`/transportadoras/${id}/reativar`, { method: 'PATCH' })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCreateRota = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await request('/rotas', {
        method: 'POST',
        body: JSON.stringify({
          transportadoraId: Number(rotaForm.transportadoraId),
          dataRota: rotaForm.dataRota,
          valorFixo: rotaForm.valorFixo === '' ? null : Number(rotaForm.valorFixo),
          valorPorPacote:
            rotaForm.valorPorPacote === '' ? null : Number(rotaForm.valorPorPacote),
          quantidadePacotes: Number(rotaForm.quantidadePacotes || 0),
        }),
      })
      setRotaForm({
        transportadoraId: '',
        dataRota: today,
        valorFixo: '',
        valorPorPacote: '',
        quantidadePacotes: 0,
      })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCreatePnr = async (event) => {
    event.preventDefault()
    setError('')
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
      setPnrForm({ rotaId: '', dataPnr: today, valorDesconto: '', observacao: '' })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="app">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Controle de Ganhos por Transportadora</h1>
            <p>POC .NET + React para gestão de rotas, PNR e ganhos</p>
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div className="segmented-control">
              <button 
                className={viewMode === 'charts' ? 'active' : ''}
                onClick={() => changeViewMode('charts')}
                aria-label="Visualização em gráficos"
              >
                📊 Gráficos
              </button>
              <button 
                className={viewMode === 'tables' ? 'active' : ''}
                onClick={() => changeViewMode('tables')}
                aria-label="Visualização em tabelas"
              >
                📋 Tabelas
              </button>
            </div>
            <div className="theme-toggle-wrapper">
              <span className="theme-icon">☀️</span>
              <label className="theme-toggle">
                <input 
                  type="checkbox" 
                  checked={theme === 'dark'} 
                  onChange={toggleTheme}
                  aria-label="Alternar tema"
                />
                <span className="slider"></span>
              </label>
              <span className="theme-icon">🌙</span>
            </div>
          </div>
        </div>
      </header>

      <section className="card">
        <h2>Filtro do Dashboard</h2>
        <form className="row" onSubmit={(e) => e.preventDefault()}>
          <label>
            Início
            <input
              type="date"
              value={range.startDate}
              onChange={(e) => setRange((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>
          <label>
            Fim
            <input
              type="date"
              value={range.endDate}
              onChange={(e) => setRange((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>
          <label>
            Transportadora
            <select
              value={filterTransportadoraId}
              onChange={(e) => {
                const selectedId = e.target.value
                setFilterTransportadoraId(selectedId)
                if (selectedId) {
                  const selected = transportadoras.find(t => t.id === Number(selectedId))
                  if (selected && !selected.ativa) {
                    setFilterOnlyActive(false)
                  }
                }
              }}
            >
              <option value="">Todas</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}{!t.ativa ? ' (Inativa)' : ''}
                </option>
              ))}
            </select>
          </label>
          {!filterTransportadoraId && (
            <label>
              &nbsp;
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '37px' }}>
                <input
                  type="checkbox"
                  checked={filterOnlyActive}
                  onChange={(e) => setFilterOnlyActive(e.target.checked)}
                  style={{ cursor: 'pointer', margin: '0', width: 'auto' }}
                />
                <span style={{ whiteSpace: 'nowrap' }}>Apenas ativas</span>
              </div>
            </label>
          )}
          <button type="button" onClick={loadData} disabled={loading} style={{ marginLeft: 'auto' }}>
            Atualizar
          </button>
        </form>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="dashboard-grid">
        <article className="metric">
          <span>Ganhos Brutos</span>
          <strong>{formatCurrency(summary?.ganhosBrutos)}</strong>
        </article>
        <article className="metric">
          <span>Descontos PNR</span>
          <strong>{formatCurrency(summary?.descontosPnr)}</strong>
        </article>
        <article className="metric">
          <span>Ganhos Líquidos</span>
          <strong>{formatCurrency(summary?.ganhosLiquidos)}</strong>
        </article>
        <article className="metric">
          <span>Total de Rotas</span>
          <strong>{summary?.totalRotas ?? 0}</strong>
        </article>
        <article className="metric">
          <span>Total de Pacotes</span>
          <strong>{summary?.totalPacotes ?? 0}</strong>
        </article>
      </section>

      {viewMode === 'charts' && (
        <section className="card">
          <SummaryChart summary={summary} />
        </section>
      )}

      <section className="card">
        <h2>Cadastro de Transportadora</h2>
        <form className="row" onSubmit={handleCreateTransportadora}>
          <label className="grow">
            Nome
            <input
              value={transportadoraForm.nome}
              onChange={(e) =>
                setTransportadoraForm((prev) => ({ ...prev, nome: e.target.value }))
              }
              required
            />
          </label>
          <button type="submit">Cadastrar</button>
        </form>
        
        <div style={{ marginTop: '20px' }}>
          <h3 
            onClick={() => setShowTransportadorasHistorico(!showTransportadorasHistorico)}
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>{showTransportadorasHistorico ? '\u25bc' : '\u25b6'}</span>
            Histórico de Transportadoras Cadastradas ({transportadoras.length})
          </h3>
          {showTransportadorasHistorico && (
            <table style={{ marginTop: '10px', width: '100%' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {transportadoras.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.nome}</td>
                    <td>{item.ativa ? 'Ativa' : 'Inativa'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {item.ativa ? (
                        <button 
                          type="button" 
                          onClick={() => handleInativarTransportadora(item.id)}
                          style={{ fontSize: '0.9em', padding: '4px 8px' }}
                        >
                          Inativar
                        </button>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => handleReativarTransportadora(item.id)}
                          style={{ fontSize: '0.9em', padding: '4px 8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Reativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Cadastro de Rota</h2>
        <form className="row wrap" onSubmit={handleCreateRota}>
          <label>
            Transportadora
            <select
              value={rotaForm.transportadoraId}
              onChange={(e) =>
                setRotaForm((prev) => ({ ...prev, transportadoraId: e.target.value }))
              }
              required
            >
              <option value="">Selecione</option>
              {transportadorasAtivas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input
              type="date"
              value={rotaForm.dataRota}
              onChange={(e) => setRotaForm((prev) => ({ ...prev, dataRota: e.target.value }))}
              required
            />
          </label>
          <label>
            Valor Fixo
            <input
              type="number"
              step="0.01"
              value={rotaForm.valorFixo}
              onChange={(e) => setRotaForm((prev) => ({ ...prev, valorFixo: e.target.value }))}
            />
          </label>
          <label>
            Valor por Pacote
            <input
              type="number"
              step="0.01"
              value={rotaForm.valorPorPacote}
              onChange={(e) =>
                setRotaForm((prev) => ({ ...prev, valorPorPacote: e.target.value }))
              }
            />
          </label>
          <label>
            Qtde Pacotes
            <input
              type="number"
              min="0"
              value={rotaForm.quantidadePacotes}
              onChange={(e) =>
                setRotaForm((prev) => ({ ...prev, quantidadePacotes: e.target.value }))
              }
            />
          </label>
          <button type="submit">Cadastrar Rota</button>
        </form>
        
        <div style={{ marginTop: '20px' }}>
          <h3 
            onClick={() => setShowRotasHistorico(!showRotasHistorico)}
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>{showRotasHistorico ? '▼' : '▶'}</span>
            Histórico de Rotas Cadastradas ({rotasRecentes.length})
          </h3>
          {showRotasHistorico && (
            <table style={{ marginTop: '10px' }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Transportadora</th>
                  <th>Bruto</th>
                  <th>PNR</th>
                  <th>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {rotasRecentes.map((rota) => (
                  <tr key={rota.id}>
                    <td>{rota.dataRota}</td>
                    <td>{rota.transportadoraNome}</td>
                    <td>{formatCurrency(rota.valorTotalCalculado)}</td>
                    <td>{formatCurrency(rota.totalDescontosPnr)}</td>
                    <td>{formatCurrency(rota.valorLiquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Registro de PNR</h2>
        <form className="row wrap" onSubmit={handleCreatePnr}>
          <label>
            Rota
            <select
              value={pnrForm.rotaId}
              onChange={(e) => setPnrForm((prev) => ({ ...prev, rotaId: e.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {rotas.map((rota) => (
                <option key={rota.id} value={rota.id}>
                  #{rota.id} - {rota.transportadoraNome} ({rota.dataRota})
                </option>
              ))}
            </select>
          </label>
          <label>
            Data PNR
            <input
              type="date"
              value={pnrForm.dataPnr}
              onChange={(e) => setPnrForm((prev) => ({ ...prev, dataPnr: e.target.value }))}
              required
            />
          </label>
          <label>
            Valor Desconto
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={pnrForm.valorDesconto}
              onChange={(e) =>
                setPnrForm((prev) => ({ ...prev, valorDesconto: e.target.value }))
              }
              required
            />
          </label>
          <label className="grow">
            Observação
            <input
              value={pnrForm.observacao}
              onChange={(e) => setPnrForm((prev) => ({ ...prev, observacao: e.target.value }))}
            />
          </label>
          <button type="submit">Registrar PNR</button>
        </form>
        
        <div style={{ marginTop: '20px' }}>
          <h3 
            onClick={() => setShowPnrsHistorico(!showPnrsHistorico)}
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>{showPnrsHistorico ? '\u25bc' : '\u25b6'}</span>
            Histórico de PNRs Registrados ({pnrs.slice(0, 10).length})
          </h3>
          {showPnrsHistorico && (
            <table style={{ marginTop: '10px', width: '100%' }}>
              <thead>
                <tr>
                  <th>Data PNR</th>
                  <th>Transportadora</th>
                  <th>Data Rota</th>
                  <th style={{ textAlign: 'right' }}>Valor Desconto</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {pnrs.slice(0, 10).map((item) => (
                  <tr key={item.id}>
                    <td>{item.dataPnr}</td>
                    <td>{item.transportadoraNome}</td>
                    <td>{item.dataRota}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.valorDesconto)}</td>
                    <td>{item.observacao || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="grid-2">
        <article className="card">
          <h2>Previsão por Dia e Transportadora</h2>
          
          {viewMode === 'charts' && (
            <>
              <PrevisaoChart previsao={previsao} />
              <div style={{ marginTop: '20px' }}>
                <TipoRotaChart rotas={filteredRotasForChart} />
              </div>
            </>
          )}
          
          {viewMode === 'tables' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Data</th>
                    <th style={{ padding: '8px' }}>Transportadora</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Rotas</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Ganho Bruto</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Descontos PNR</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Ganho Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {previsao.map((item, index) => (
                    <tr key={`${item.dataRota}-${item.transportadoraId}-${index}`} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{item.dataRota}</td>
                      <td style={{ padding: '8px' }}>{item.transportadoraNome}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{item.totalRotas}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.ganhosBrutos)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.descontosPnr)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.ganhosLiquidos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="card">
          <h2>Histórico Diário</h2>
          
          {viewMode === 'charts' && (
            <HistoricoChart historico={historico} />
          )}
          
          {viewMode === 'tables' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Data</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Rotas</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Ganho Bruto</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Descontos PNR</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Ganho Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item, index) => (
                    <tr key={`${item.data}-${index}`} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{item.data}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{item.totalRotas}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.ganhosBrutos)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.descontosPnr)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.ganhosLiquidos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  )
}

export default App
