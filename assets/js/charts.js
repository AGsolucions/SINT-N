import { parseBool } from './utils.min.js';

let charts = {};

// === NUEVO: helpers ===
function ensureWrapped(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const slide = canvas.closest('.slide');
  if (!slide) return canvas.parentElement;

  let wrapper = slide.querySelector('.chart');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'chart';
    slide.replaceChild(wrapper, canvas);
    wrapper.appendChild(canvas);
  }
  return wrapper;
}

async function attachCopyButton(canvasId) {
  const wrapper = ensureWrapped(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!wrapper || !canvas) return;
  if (wrapper.querySelector('.icon-btn.copy')) return;

  const btn = document.createElement('button');
  btn.className = 'icon-btn copy';
  btn.type = 'button';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2"></rect>
      <path d="M5 15V5a2 2 0 0 1 2-2h10"></path>
    </svg>
  `;
  wrapper.appendChild(btn);

  btn.addEventListener('click', async () => {
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${canvasId}.png`;
        a.click();
      }
    } catch {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${canvasId}.png`;
      a.click();
    }
  });
}

// Paleta suave (dejas la tuya)
function palette(n) {
  const base = [
    '#93c5fd','#fbcfe8','#fde68a','#a7f3d0','#c7d2fe','#fca5a5','#fcd34d','#99f6e4'
  ];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

// === NUEVO: regresión lineal y trendline sobre años reales ===
function linearRegression(xs, ys) {
  const n = xs.length;
  if (!n) return { a: 0, b: 0 };
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const meanX = sumX / n, meanY = sumY / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }
  const b = den ? (num / den) : 0;
  const a = meanY - b * meanX;
  return { a, b };
}

function buildTrendline(xs, ys) {
  const { a, b } = linearRegression(xs, ys);
  return xs.map(x => a + b * x);
}

/**
 * Inicializa los gráficos (añadimos el Timeline para que esté SIEMPRE)
 */
export function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    layout: { padding: 6 }
  };

  if (charts.status) charts.status.destroy();
  if (charts.rubro) charts.rubro.destroy();
  if (charts.timeline) charts.timeline.destroy();

  // 1) Dona — Estatus
  const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    charts.status = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderWidth: 1,
        backgroundColor: ['#2563eb', '#f59e0b', '#ef4444']
      }]
    },
    options: {
      ...commonOptions,
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: 'Estatus del negocio',
          font: { size: 14, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              const ds = ctx.chart.data.datasets[0];
              const total = ds.data.reduce((sum, v) => sum + v, 0);
              const pct = total ? ((val / total) * 100).toFixed(1) : '0.0';
              return ` ${ctx.label}: ${val} (${pct}%)`;
            }
          }
        }
      }
    }
  });
 // attachCopyButton('chartStatus');

  // 2) Pastel — Rubro
  const ctxRubro = document.getElementById('chartRubro').getContext('2d');
  charts.rubro = new Chart(ctxRubro, {
    type: 'doughnut', // ya cambiado de pie a doughnut
    data: {
      labels: [],
      datasets: [{
        label: 'Negocios por rubro',
        data: [],
        borderWidth: 1,
        backgroundColor: []
      }]
    },
    options: {
      ...commonOptions,
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: 'Tipo de rubro',
          font: { size: 14, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              const ds = ctx.chart.data.datasets[0];
              const total = ds.data.reduce((sum, v) => sum + v, 0);
              const pct = total ? ((val / total) * 100).toFixed(1) : '0.0';
              return ` ${ctx.label}: ${val} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  //attachCopyButton('chartRubro');

  // 3) Timeline — SIEMPRE presente y listo para actualizar
  const ctxTimeline = document.getElementById('chartTimeline').getContext('2d');
  charts.timeline = new Chart(ctxTimeline, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: {
          top: 24,      // 👈 ESPACIO entre el gráfico y lo que está arriba (leyendas, bordes, etc.)
          left: 6,
          right: 6,
          bottom: 6
        }
      },
      scales: {
        x: { title: { display: true,} },
        y: { title: { display: true,}, beginAtZero: true }
      },
      plugins: {
        display: true,
        position: 'top',
          labels: {
          padding: 20 // 🔥 Este valor separa la leyenda del gráfico
        },
        tooltip: {
          callbacks: {
            // Muestra cantidad + % sobre el total del rango visible
            label: (ctx) => {
              const val = ctx.parsed.y || 0;
              const ds = ctx.chart.data.datasets[0];
              const total = (ds?.data || []).reduce((s, v) => s + (v || 0), 0);
              const pct = total ? ((val / total) * 100).toFixed(1) : '0.0';
              return ` ${val} (${pct}%)`;
            }
          }
        }
      },
    }
  });
  //attachCopyButton('chartTimeline');

  // construir navegación del carrusel (flechas, dots, swipe)
  chartsBuildNav();
}

/**
 * Actualiza KPI y gráficos con los datos actuales
 * (añadimos actualización del timeline para mantenerlo dinámico)
 */
export function updateKPIs(fc) {
  const total = fc.features.length;
  const counts = { formal: 0, informal: 0, irregular: 0 };
  const porRubro = {};
  let ruc = 0, pat = 0;

  for (const f of fc.features) {
    const p = f.properties;
    counts[p.estatus] = (counts[p.estatus] || 0) + 1;
    if (parseBool(p.tiene_ruc)) ruc++;
    if (parseBool(p.tiene_patente)) pat++;
    if (p.rubro) porRubro[p.rubro] = (porRubro[p.rubro] || 0) + 1;
  }

  // KPIs
  const pctFormal = total ? Math.round((counts.formal / total) * 100) : 0;
  document.getElementById('kpi_total').textContent = total.toString();
  document.getElementById('kpi_formal').textContent = pctFormal + '%';
  document.getElementById('kpi_ruc').textContent = total ? Math.round((ruc / total) * 100) + '%' : '—';
  document.getElementById('kpi_pat').textContent = total ? Math.round((pat / total) * 100) + '%' : '—';

  // ✅ Timeline SIEMPRE que exista (refleja lo filtrado globalmente)
  if (charts.timeline) drawTimelineChart(fc);

  // Dona — Estatus (si existe)
  if (charts.status) {
    charts.status.data.labels = ['Formal', 'Informal', 'Irregular'];
    charts.status.data.datasets[0].data = [
      counts.formal || 0,
      counts.informal || 0,
      counts.irregular || 0
    ];
    charts.status.update();
  }

  // Pastel — Rubro (si existe)
  if (charts.rubro) {
    const rubros = Object.keys(porRubro);
    const rubrosVals = Object.values(porRubro);
    charts.rubro.data.labels = rubros;
    charts.rubro.data.datasets[0].data = rubrosVals;
    charts.rubro.data.datasets[0].backgroundColor = palette(rubros.length);
    charts.rubro.update();
  }
}

/**
 * Redibuja el Timeline con:
 * - últimos 5 años por defecto
 * - filtro de año (dropdown)
 * - color turquesa
 * - línea de tendencia (regresión lineal)
 * - click en barra muestra cantidad + %
 */
export function drawTimelineChart(fc) {
  if (!charts.timeline) return;

  // Guardas
  if (!fc || !Array.isArray(fc.features)) {
    charts.timeline.data.labels = [];
    charts.timeline.data.datasets = [];
    charts.timeline.update();
    return;
  }

  // Conteo por año (anio_min) usando SOLO los datos visibles (ya filtrados)
  const countsByYear = {};
  for (const f of fc.features) {
    const y = parseInt(f?.properties?.anio);
    if (Number.isFinite(y)) countsByYear[y] = (countsByYear[y] || 0) + 1;
  }
  const allYears = Object.keys(countsByYear).map(n => parseInt(n, 10)).sort((a, b) => a - b);

  // Si no hay años, limpiar
  if (!allYears.length) {
    charts.timeline.data.labels = [];
    charts.timeline.data.datasets = [];
    charts.timeline.update();
    return;
  }

  // Últimos 5 años con datos
  const years = allYears.slice(-5);
  const values = years.map(y => countsByYear[y] || 0);

  // Línea de tendencia (manteniendo tu estilo actual)
  const trend = buildTrendline(years, values);
  const TURQ = '#14b8a6';
  const TURQ_LINE = '#0f766e';

  charts.timeline.data.labels = years;
  charts.timeline.data.datasets = [
    {
      label: 'Negocios por año',
      data: values,
      backgroundColor: TURQ,
      borderColor: TURQ,
      borderWidth: 1
    },
    {
      label: 'Línea de tendencia',
      data: trend,
      type: 'line',
      fill: false,
      borderColor: TURQ_LINE,
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 0,
      borderDash: [6, 4], 
      order: 2   
    }
  ];
  charts.timeline.update();
}


// === Carrusel Charts (igual que ya lo tenías) ===
let carIndex = 0;
function chartsElems() {
  return {
    track: document.getElementById('chartsTrack'),
    slides: Array.from(document.querySelectorAll('#chartsTrack .slide')),
    dotsWrap: document.getElementById('chartsDots'),
    prev: document.querySelector('.car-btn.prev'),
    next: document.querySelector('.car-btn.next')
  };
}
function chartsGo(i) {
  const { track, slides, dotsWrap } = chartsElems();
  if (!track || !slides.length) return;
  carIndex = (i + slides.length) % slides.length;
  track.style.transform = `translateX(-${carIndex * 100}%)`;
  Array.from(dotsWrap.children).forEach((b, idx) => {
    b.classList.toggle('active', idx === carIndex);
  });
}
function chartsBuildNav() {
  const { slides, dotsWrap, prev, next } = chartsElems();
  if (!slides.length) return;

  dotsWrap.innerHTML = '';
  slides.forEach((_, idx) => {
    const b = document.createElement('button');
    b.addEventListener('click', () => chartsGo(idx));
    dotsWrap.appendChild(b);
  });

  prev.addEventListener('click', () => chartsGo(carIndex - 1));
  next.addEventListener('click', () => chartsGo(carIndex + 1));

  const track = document.getElementById('chartsTrack');
  let startX = 0, dx = 0, dragging = false;
  const onStart = (x) => { dragging = true; startX = x; };
  const onMove  = (x) => { if (!dragging) return; dx = x - startX; };
  const onEnd   = () => {
    if (!dragging) return;
    if (dx < -50) chartsGo(carIndex + 1);
    else if (dx > 50) chartsGo(carIndex - 1);
    dx = 0; dragging = false;
  };
  track.addEventListener('pointerdown', e => { track.setPointerCapture(e.pointerId); onStart(e.clientX); });
  track.addEventListener('pointermove',  e => onMove(e.clientX));
  track.addEventListener('pointerup',    onEnd);
  track.addEventListener('pointercancel',onEnd);

  chartsGo(0);
}
