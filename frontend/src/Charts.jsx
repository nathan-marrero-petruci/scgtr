import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

// Gráfico de resumo: Ganhos brutos vs ganhos liquidos
export function SummaryChart({ summary }) {
  if (!summary) return null

  const data = {
    labels: ['Resumo Geral'],
    datasets: [
      {
        label: 'Ganhos Brutos',
        data: [summary.ganhosBrutos],
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: 'Ganhos Liquidos',
        data: [summary.ganhosLiquidos],
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Resumo Financeiro',
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return context.dataset.label + ': ' + formatCurrency(context.parsed.y)
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return formatCurrency(value)
          },
        },
      },
    },
  }

  return (
    <div style={{ height: '300px', marginBottom: '20px' }}>
      <Bar data={data} options={options} />
    </div>
  )
}

// Gráfico de previsão: Distribuição por transportadora
export function PrevisaoChart({ previsao }) {
  if (!previsao || previsao.length === 0) return null

  // Agrupar por transportadora
  const groupedData = previsao.reduce((acc, item) => {
    const nome = item.transportadoraNome
    if (!acc[nome]) {
      acc[nome] = 0
    }
    acc[nome] += item.ganhosLiquidos || 0
    return acc
  }, {})

  const labels = Object.keys(groupedData)
  const values = Object.values(groupedData)

  const data = {
    labels,
    datasets: [
      {
        label: 'Valor Previsto',
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Previsão por Transportadora',
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return context.label + ': ' + formatCurrency(context.parsed.y)
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return formatCurrency(value)
          },
        },
      },
    },
  }

  return (
    <div style={{ height: '350px', marginBottom: '20px' }}>
      <Bar data={data} options={options} />
    </div>
  )
}

// Gráfico de histórico: Linha do tempo dos PNRs
export function HistoricoChart({ historico }) {
  if (!historico || historico.length === 0) return null

  // Agrupar por data
  const groupedData = historico.reduce((acc, item) => {
    // O formato pode ser 'data' (dashboard) ou 'dataPnr' (PNRs diretos)
    const date = item.data || item.dataPnr?.split('T')[0]
    if (!acc[date]) {
      acc[date] = {
        bruto: 0,
        liquido: 0,
      }
    }
    // Usar ganhosLiquidos se existir, senão valorFinal
    acc[date].bruto += item.ganhosBrutos || 0
    acc[date].liquido += item.ganhosLiquidos || item.valorFinal || 0
    return acc
  }, {})

  // Ordenar por data
  const sortedDates = Object.keys(groupedData).sort()
  const valuesBruto = sortedDates.map((date) => groupedData[date].bruto)
  const valuesLiquido = sortedDates.map((date) => groupedData[date].liquido)

  // Calcular acumulado
  const accumulatedLiquido = valuesLiquido.reduce((acc, value, index) => {
    acc.push((acc[index - 1] || 0) + value)
    return acc
  }, [])

  const data = {
    labels: sortedDates.map((date) => {
      const [year, month, day] = date.split('-')
      return `${day}/${month}`
    }),
    datasets: [
      {
        label: 'Ganho Líquido Diário',
        data: valuesLiquido,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Acumulado',
        data: accumulatedLiquido,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Evolução dos Recebimentos',
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return context.dataset.label + ': ' + formatCurrency(context.parsed.y)
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return formatCurrency(value)
          },
        },
      },
    },
  }

  return (
    <div style={{ height: '350px', marginBottom: '20px' }}>
      <Line data={data} options={options} />
    </div>
  )
}

// Gráfico de distribuição tipo de rota (pizza)
export function TipoRotaChart({ rotas }) {
  if (!rotas || rotas.length === 0) return null

  const valorFixo = rotas.filter((r) => (r.valorFixo ?? 0) > 0 && (r.valorPorPacote ?? 0) <= 0).length
  const valorPorPacote = rotas.filter((r) => (r.valorPorPacote ?? 0) > 0 && (r.valorFixo ?? 0) <= 0).length
  const ambos = rotas.filter((r) => (r.valorFixo ?? 0) > 0 && (r.valorPorPacote ?? 0) > 0).length
  const total = valorFixo + valorPorPacote + ambos

  if (total === 0) return null

  const data = {
    labels: ['Valor Fixo', 'Por Pacote', 'Ambos'],
    datasets: [
      {
        data: [valorFixo, valorPorPacote, ambos],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Distribuição por Tipo de Rota',
        font: { size: 16 },
      },
    },
  }

  return (
    <div style={{ height: '300px', marginBottom: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <Doughnut data={data} options={options} />
    </div>
  )
}
