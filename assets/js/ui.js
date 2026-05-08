/* ========================================================================
   ui.js
   Capa de presentación. Toma estados ya computados (sports, social,
   cultural) y los pinta en el DOM. Sin fetch ni lógica de negocio aquí.

   Toda función renderX(...) es idempotente: puede llamarse N veces
   con el mismo dato y produce el mismo HTML. Esto facilita debugging.
   ======================================================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ===== formatters =================================================== */

  function fmtNum(n) {
    if (n == null) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  }

  function fmtSigned(n) {
    if (n == null || isNaN(n)) return '—';
    const sign = n > 0 ? '+' : '';
    return `${sign}${Math.round(n)}`;
  }

  function fmtTimeAgo(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)        return `${diff}s`;
    if (diff < 3600)      return `${Math.floor(diff / 60)}m`;
    if (diff < 86400)     return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  }

  function fmtMatchTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).replace('.', '').toUpperCase();
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ===== Top Bar ====================================================== */

  function setStatus(state, label) {
    const pill = $('#globalStatus');
    pill.dataset.status = state;
    pill.querySelector('.status-pill__label').textContent = label;
  }

  function tickClock() {
    const now = new Date();
    $('#liveClock').textContent = now.toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  }
  setInterval(tickClock, 1000);
  tickClock();

  function setMatchDay(label) {
    $('#matchDayLabel').textContent = label;
  }

  /* ===== HERO ========================================================= */

  function teamCode(name) {
    if (!name) return '—';
    return name.toUpperCase().slice(0, 3);
  }

  function teamCrestHtml(badgeUrl, name) {
    if (badgeUrl) {
      return `<img src="${escapeHtml(badgeUrl)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${teamCode(name)}'))" />`;
    }
    return teamCode(name);
  }

  function isMx(name) {
    if (!name) return false;
    const n = name.toLowerCase();
    return n === 'mexico' || n === 'méxico' || n.includes('mexico');
  }

  function renderHero(match) {
    const tag = $('#heroLiveTag');
    const teams = $('#heroTeams');
    const events = $('#heroEvents');
    const kicker = $('#heroKicker');

    if (!match) {
      teams.innerHTML = `<div class="hero__placeholder">Sin partido disponible.</div>`;
      tag.style.display = 'none';
      events.innerHTML = '';
      return;
    }

    const isLive = match.status === 'LIVE';
    const isFt   = match.status === 'FT';

    // Kicker contextual
    if (match.isMxMatch) kicker.textContent = '🇲🇽 PARTIDO DE MÉXICO';
    else if (/group stage|grupo/i.test(match.stage)) kicker.textContent = `FASE GRUPOS · ${match.stage || ''}`.trim();
    else if (match.stage) kicker.textContent = match.stage.toUpperCase();
    else kicker.textContent = 'PARTIDO DESTACADO';

    // Live tag
    if (isLive) {
      tag.style.display = '';
      tag.classList.remove('live-tag--off');
      tag.innerHTML = `<span class="live-tag__pulse"></span>EN VIVO`;
    } else if (isFt) {
      tag.style.display = '';
      tag.classList.add('live-tag--off');
      tag.innerHTML = `<span class="live-tag__pulse"></span>FINAL`;
    } else {
      tag.style.display = '';
      tag.classList.add('live-tag--off');
      tag.innerHTML = `<span class="live-tag__pulse"></span>${fmtMatchTime(match.dateUtc)}`;
    }

    // Score
    const showScore = match.homeScore != null && match.awayScore != null;
    const scoreHtml = showScore
      ? `<span>${match.homeScore}</span><span class="hero__score-sep">—</span><span>${match.awayScore}</span>`
      : `<span style="color:var(--text-3)">VS</span>`;

    const minHtml = isLive
      ? `<div class="hero__minute">${match.minute || 'EN JUEGO'}</div>`
      : isFt
      ? `<div class="hero__minute hero__minute--ft">TIEMPO COMPLETO</div>`
      : `<div class="hero__minute hero__minute--ft">${fmtMatchTime(match.dateUtc)}</div>`;

    teams.innerHTML = `
      <div class="hero-team hero-team--home" data-mx="${isMx(match.homeName)}">
        <div class="hero-team__crest">${teamCrestHtml(match.homeBadge, match.homeName)}</div>
        <div class="hero-team__meta">
          <div class="hero-team__name">${escapeHtml(match.homeName)}</div>
          <div class="hero-team__code">HOME · ${teamCode(match.homeName)}</div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; align-items:center;">
        <div class="hero__score">${scoreHtml}</div>
        ${minHtml}
      </div>

      <div class="hero-team hero-team--away" data-mx="${isMx(match.awayName)}">
        <div class="hero-team__crest">${teamCrestHtml(match.awayBadge, match.awayName)}</div>
        <div class="hero-team__meta">
          <div class="hero-team__name">${escapeHtml(match.awayName)}</div>
          <div class="hero-team__code">AWAY · ${teamCode(match.awayName)}</div>
        </div>
      </div>
    `;

    // Eventos (si los hay)
    events.innerHTML = (match.events || []).slice(-8).map(e => `
      <div class="event-chip" data-type="${e.type}">
        <span class="event-chip__min">${e.minute}'</span>
        <span>${escapeHtml(e.label)}</span>
      </div>
    `).join('') || '<span class="muted" style="font-size:11px">Sin eventos detallados disponibles para este partido.</span>';
  }

  function renderMomentum(homePct, awayPct, label) {
    $('.momentum-bar__home').style.width = `${homePct}%`;
    $('.momentum-bar__away').style.width = `${awayPct}%`;
    $('#momentumScore').textContent = label || `${Math.round(homePct)}% — ${Math.round(awayPct)}%`;
  }

  /* ===== MATCH LIST =================================================== */

  let _matchTab = 'live';

  function renderMatchList(matches) {
    const list = $('#matchList');
    if (!matches || !matches.length) {
      list.innerHTML = `<div class="muted">Sin partidos disponibles. La temporada 2026 empieza el 11 de junio.</div>`;
      return;
    }

    let filtered = matches;
    if (_matchTab === 'live')      filtered = matches.filter(m => m.status === 'LIVE');
    if (_matchTab === 'upcoming')  filtered = matches.filter(m => m.status === 'UPCOMING').slice(0, 12);
    if (_matchTab === 'finished')  filtered = matches.filter(m => m.status === 'FT').slice(-8).reverse();

    if (!filtered.length) {
      const emptyMessages = {
        live:     'No hay partidos en vivo en este momento.',
        upcoming: 'Sin próximos partidos en el calendario.',
        finished: 'Sin partidos finalizados aún.',
      };
      list.innerHTML = `<div class="muted">${emptyMessages[_matchTab]}</div>`;
      return;
    }

    list.innerHTML = filtered.map(m => {
      const status = m.status === 'LIVE' ? (m.minute || 'LIVE')
                  : m.status === 'FT'   ? 'FT'
                  : fmtMatchTime(m.dateUtc).split(' ').slice(0, 2).join(' ');

      const score = (m.status === 'LIVE' || m.status === 'FT')
        ? `<div class="match-row__score">${m.homeScore ?? 0} — ${m.awayScore ?? 0}</div>`
        : `<div class="match-row__score match-row__score--upcoming">VS</div>`;

      const tag = m.isMxMatch ? '🇲🇽 TRI'
                : /(final|semi|quarter|round of 16)/i.test(m.stage) ? 'FASE FINAL'
                : '';

      return `
        <div class="match-row" data-mx="${m.isMxMatch}" data-id="${m.id}">
          <div class="match-row__status" data-state="${m.status}">${status}</div>
          <div class="match-row__team match-row__team--home">${escapeHtml(m.homeName)}</div>
          ${score}
          <div class="match-row__team match-row__team--away">${escapeHtml(m.awayName)}</div>
          <div class="match-row__tag">${tag}</div>
        </div>
      `;
    }).join('');
  }

  function bindMatchTabs(onChange) {
    $$('.card--matches .tab').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.card--matches .tab').forEach(b => b.classList.remove('tab--active'));
        btn.classList.add('tab--active');
        _matchTab = btn.dataset.tab;
        if (onChange) onChange(_matchTab);
      });
    });
  }

  /* ===== KPIs + CHART ================================================ */

  function renderKpis(kpis, prevKpis) {
    $('#kpiVolume').textContent     = fmtNum(kpis.volume);
    $('#kpiSentiment').textContent  = `${kpis.sentiment > 0 ? '+' : ''}${kpis.sentiment}%`;
    $('#kpiReach').textContent      = fmtNum(kpis.reach);
    $('#kpiMemes').textContent      = fmtNum(kpis.memes);

    if (prevKpis) {
      const dV = kpis.volume - prevKpis.volume;
      const dS = kpis.sentiment - prevKpis.sentiment;
      const dR = kpis.reach - prevKpis.reach;
      const dM = kpis.memes - prevKpis.memes;

      const set = (id, delta, suffix = '') => {
        const el = $(id);
        el.textContent = `${fmtSigned(delta)}${suffix}`;
        el.className = 'kpi__delta ' + (delta > 0 ? 'kpi__delta--up' : delta < 0 ? 'kpi__delta--down' : '');
      };
      set('#kpiVolumeDelta', dV);
      set('#kpiSentimentDelta', dS, '%');
      set('#kpiReachDelta', dR);
      set('#kpiMemesDelta', dM);
    }

    // pintamos el sentimiento con color según signo
    const sentEl = $('#kpiSentiment');
    sentEl.style.color = kpis.sentiment > 15 ? 'var(--pos)'
                       : kpis.sentiment < -15 ? 'var(--neg)'
                       : 'var(--text-1)';
  }

  /** Mini chart de volumen — canvas vanilla, sin libs */
  function renderVolumeChart(series) {
    const canvas = $('#volumeChart');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight || 130;
    if (!w) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (!series.length) return;
    const max = Math.max(...series, 1);
    const stepX = w / (series.length - 1 || 1);

    // Grid lines horizontales
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Gradiente bajo la curva
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0)');

    // Área
    ctx.beginPath();
    ctx.moveTo(0, h);
    series.forEach((v, i) => {
      const x = i * stepX;
      const y = h - (v / max) * (h - 8) - 4;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Línea
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = i * stepX;
      const y = h - (v / max) * (h - 8) - 4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Punto final pulsante
    const lastX = (series.length - 1) * stepX;
    const lastY = h - (series[series.length - 1] / max) * (h - 8) - 4;
    ctx.beginPath();
    ctx.fillStyle = '#00E5FF';
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ===== TRENDS ====================================================== */

  function renderTrends(trends) {
    const list = $('#trendsList');
    if (!trends.length) {
      list.innerHTML = `<li class="muted">Sin trends detectados todavía.</li>`;
      return;
    }
    const max = Math.max(...trends.map(t => t.count));
    list.innerHTML = trends.slice(0, 8).map((t, i) => {
      const trendType = t.pct > 50 ? 'hot' : t.pct > 5 ? 'up' : t.pct < -5 ? 'down' : '';
      const deltaLabel = t.pct ? `${t.pct > 0 ? '↑' : '↓'} ${Math.abs(Math.round(t.pct))}%` : `${fmtNum(t.count)}`;
      return `
        <li class="trend-item" data-trend="${trendType}">
          <span class="trend-item__rank">${(i + 1).toString().padStart(2, '0')}</span>
          <span class="trend-item__tag">${escapeHtml(t.tag)}</span>
          <span class="trend-item__delta">${deltaLabel}</span>
          <span class="trend-item__bar"><span class="trend-item__bar-fill" style="width:${(t.count / max) * 100}%"></span></span>
        </li>
      `;
    }).join('');
  }

  /* ===== LIVE FEED =================================================== */

  let _feedFilter = 'all';

  function renderFeed(posts) {
    const wrap = $('#liveFeed');
    if (!posts.length) {
      wrap.innerHTML = `<div class="muted">Sin posts capturados todavía.</div>`;
      return;
    }

    let filtered = posts;
    if (_feedFilter === 'memes')   filtered = posts.filter(p => p.isMeme);
    if (_feedFilter === 'mexico')  filtered = posts.filter(p => p.mentionsMx);
    if (_feedFilter === 'players') filtered = posts.filter(p => p.text && /[A-Z]/.test(p.text));

    if (!filtered.length) {
      wrap.innerHTML = `<div class="muted">Sin posts del filtro seleccionado.</div>`;
      return;
    }

    wrap.innerHTML = filtered.slice(0, window.CONFIG.ui.feedMaxItems).map(p => `
      <article class="post" data-sentiment="${p.sentiment}" data-meme="${p.isMeme}">
        <header class="post__head">
          <span class="post__author">${escapeHtml(p.author.name)}</span>
          <span class="post__handle">${escapeHtml(p.author.handle)}</span>
          <span class="post__time">${fmtTimeAgo(p.time)}</span>
        </header>
        <div class="post__text">${escapeHtml(p.text)}</div>
        <footer class="post__meta">
          <span><strong>${fmtNum(p.likes)}</strong> ♥</span>
          <span><strong>${fmtNum(p.retweets)}</strong> ↻</span>
          <span><strong>${fmtNum(p.estReach)}</strong> alcance</span>
          ${p.mentionsSamsung ? '<span style="color:var(--samsung)">📱 Samsung-relevant</span>' : ''}
          ${p.isMeme ? '<span style="color:var(--gold)">🔥 Meme</span>' : ''}
        </footer>
      </article>
    `).join('');
  }

  function bindFeedTabs(onChange) {
    $$('.card--feed .tab').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.card--feed .tab').forEach(b => b.classList.remove('tab--active'));
        btn.classList.add('tab--active');
        _feedFilter = btn.dataset.feed;
        if (onChange) onChange(_feedFilter);
      });
    });
  }

  /* ===== CULTURAL OPPORTUNITIES ====================================== */

  function renderOpps(opps) {
    const grid = $('#oppsGrid');
    if (!opps.length) {
      grid.innerHTML = `
        <div class="opp" style="border-color:var(--border); background:transparent; cursor:default; max-width:480px">
          <div class="opp__head">
            <div class="opp__icon" style="background:rgba(166,173,190,0.08)">○</div>
            <span class="opp__type" style="color:var(--text-3)">SIN OPORTUNIDADES AHORA</span>
          </div>
          <div class="opp__title">Sin señales suficientes</div>
          <div class="opp__desc">El detector espera que la conversación crezca o que aparezcan patrones nuevos. Mejor no forzar publicaciones cuando no hay tracción orgánica.</div>
        </div>
      `;
      return;
    }
    grid.innerHTML = opps.map(o => `
      <article class="opp" data-heat="${o.heat}">
        <header class="opp__head">
          <div class="opp__icon">${o.icon}</div>
          <span class="opp__type">${escapeHtml(o.type)}</span>
        </header>
        <div class="opp__title">${escapeHtml(o.title)}</div>
        <div class="opp__desc">${escapeHtml(o.desc)}</div>
        <div class="opp__metrics">
          <span>Heat<strong>${o.heat.toUpperCase()}</strong></span>
          <span>Score<strong>${Math.round(o.score)}</strong></span>
          <span>Source<strong>${o.source}</strong></span>
        </div>
        <span class="opp__cta">${escapeHtml(o.cta)}</span>
      </article>
    `).join('');
  }

  /* ===== EXPORT ======================================================= */

  window.UI = {
    setStatus, setMatchDay,
    renderHero, renderMomentum,
    renderMatchList, bindMatchTabs,
    renderKpis, renderVolumeChart,
    renderTrends,
    renderFeed, bindFeedTabs,
    renderOpps,
  };
})();
