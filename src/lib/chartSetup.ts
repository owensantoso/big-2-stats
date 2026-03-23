import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type Plugin,
} from 'chart.js'

const hoverValueLabelsPlugin: Plugin<'bar'> = {
  id: 'hoverValueLabels',
  afterDatasetsDraw(chart) {
    const activeElements = chart.getActiveElements()

    if (activeElements.length === 0) {
      return
    }

    const { ctx } = chart
    const isHorizontal = chart.options.indexAxis === 'y'

    ctx.save()
    ctx.font = '700 14px "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(22, 50, 79, 0.45)'
    ctx.lineWidth = 3

    for (const activeElement of activeElements) {
      const dataset = chart.data.datasets[activeElement.datasetIndex]
      const rawValue = dataset.data[activeElement.index]
      const value =
        typeof rawValue === 'number' || typeof rawValue === 'string'
          ? String(rawValue)
          : ''

      if (!value) {
        continue
      }

      const element = activeElement.element
      const props = element.getProps(['x', 'y', 'base'], true)
      const centerX = isHorizontal ? (props.x + props.base) / 2 : props.x
      const centerY = isHorizontal ? props.y : (props.y + props.base) / 2

      ctx.strokeText(value, centerX, centerY)
      ctx.fillText(value, centerX, centerY)
    }

    ctx.restore()
  },
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  hoverValueLabelsPlugin,
)
