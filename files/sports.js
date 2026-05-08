/* ========================================================================
   sports.js
   Capa de datos deportivos. Aísla TheSportsDB del resto del dashboard:
   si mañana cambias a API-Football u otra fuente, solo tocas este archivo.

   Expone window.Sports con:
     - getMatches()          → próximos + recientes + en vivo (normalizados)
     - getLiveMatch()        → el partido prioritario (México > inauguración > eliminatoria > otros en vivo)
     - subscribe(callback)   → polling automático
   ======================================================================== */

(function () {
  'use strict';

  const C = window.CONFIG.sports;

  /* ----- helpers de normalización ----------------------------------- */

  /** Normaliza el "country/team" para detectar México y badge */
  function isMexico(name) {
    if (!name) return false;
    const n = name.toLowerCase();
    return n === 'mexico' || n === 'méxico' || n.includes('mexico');
  }

  /** Convierte un evento de TheSportsDB a nuestro formato interno */
  function normalizeEvent(e) {
    if (!e) return null;
    const isLive = e.strStatus && /(\d+|halftime|in play|live)/i.test(e.strStatus) && e.strStatus !== 'Match Finished' && e.strStatus !== 'Not Started';
    const isFinished = e.strStatus === 'Match Finished' || e.strStatus === 'FT';
    const isUpcoming = !isLive && !isFinished;

    return {
      id: e.idEvent,
      stage: e.strSeasonRound || e.strRound || '',
      homeName: e.strHomeTeam || '',
      awayName: e.strAwayTeam || '',
      homeBadge: e.strHomeTeamBadge || '',
      awayBadge: e.strAwayTeamBadge || '',
      homeScore: e.intHomeScore != null ? Number(e.intHomeScore) : null,
      awayScore: e.intAwayScore != null ? Number(e.intAwayScore) : null,
      dateUtc: e.strTimestamp || `${e.dateEvent}T${e.strTime || '00:00:00'}Z`,
      venue: e.strVenue || '',
      status: isLive ? 'LIVE' : isFinished ? 'FT' : 'UPCOMING',
      minute: e.strProgress || null,
      // Eventos detallados (goles, tarjetas) — TheSportsDB no siempre los da
      // free; aquí dejamos array vacío y lo enriquecemos si hay otra fuente
      events: [],
      isMxMatch: isMexico(e.strHomeTeam) || isMexico(e.strAwayTeam),
    };
  }

  /** Detecta si un partido es "fase final" (eliminatoria) por strRound */
  function isKnockout(m) {
    const r = (m.stage || '').toLowerCase();
    return /(round of 16|octavos|cuartos|quarter|semi|final|3rd place)/.test(r);
  }

  /** Score de prioridad para elegir el partido del HERO.
   *  Más alto = más relevante para Samsung MX. */
  function priorityScore(m) {
    let s = 0;
    if (m.isMxMatch)   s += 100;
    if (m.status === 'LIVE')     s += 50;
    if (isKnockout(m))           s += 30;
    // Inauguración: primer partido del torneo (round = "Group Stage" + earliest date)
    // Esto se maneja en getLiveMatch comparando fechas
    if (m.status === 'UPCOMING') s += 5;
    return s;
  }

  /* ----- fetchers ---------------------------------------------------- */

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
  }

  async function fetchSeasonEvents() {
    /* eventsseason.php → todos los partidos del torneo */
    const url = `${C.baseUrl}/eventsseason.php?id=${C.leagueId}&s=${C.season}`;
    const data = await fetchJson(url);
    const events = (data.events || []).map(normalizeEvent).filter(Boolean);
    return events;
  }

  async function fetchLiveScores() {
    /* livescore.php → partidos en vivo de soccer
       Filtramos por liga del Mundial en el cliente. */
    try {
      const url = `${C.baseUrl}/livescore.php?l=Soccer`;
      const data = await fetchJson(url);
      const events = (data.events || data.livescore || []).map(normalizeEvent).filter(Boolean);
      return events.filter(e => /world cup/i.test(e.stage) || true /* ser permisivo */);
    } catch (err) {
      console.warn('[sports] livescore unavailable, falling back to season data', err);
      return [];
    }
  }

  /* ----- API pública ------------------------------------------------- */

  let _cache = { matches: [], updatedAt: 0 };

  async function refresh() {
    try {
      const [season, live] = await Promise.all([
        fetchSeasonEvents(),
        fetchLiveScores(),
      ]);

      // Merge: prioriza datos del livescore para partidos en vivo
      const byId = new Map();
      season.forEach(m => byId.set(m.id, m));
      live.forEach(m => {
        if (byId.has(m.id)) {
          // sobreescribe con datos en vivo
          byId.set(m.id, { ...byId.get(m.id), ...m });
        } else {
          byId.set(m.id, m);
        }
      });

      const matches = [...byId.values()].sort((a, b) => new Date(a.dateUtc) - new Date(b.dateUtc));
      _cache = { matches, updatedAt: Date.now() };
      return matches;
    } catch (err) {
      console.error('[sports] refresh failed', err);
      // Si todo falla, devolvemos cache aunque sea viejo
      return _cache.matches;
    }
  }

  /** Devuelve todos los partidos (cache + refresh on demand) */
  async function getMatches({ force = false } = {}) {
    if (force || Date.now() - _cache.updatedAt > C.pollMs) {
      await refresh();
    }
    return _cache.matches;
  }

  /** Elige el "main match" para el hero.
   *  Reglas (en orden):
   *    1. Si hay un partido de México en vivo → ese.
   *    2. Si hay otro partido en vivo de fase final → ese.
   *    3. Si hay otro partido en vivo cualquiera → ese.
   *    4. Próximo partido de México.
   *    5. Próximo partido del Mundial.
   */
  async function getLiveMatch() {
    const ms = await getMatches();
    if (!ms.length) return null;

    // Inauguración: el primer partido del torneo por fecha
    const sorted = [...ms].sort((a, b) => new Date(a.dateUtc) - new Date(b.dateUtc));
    const opening = sorted[0];

    const live = ms.filter(m => m.status === 'LIVE');
    const liveMx = live.find(m => m.isMxMatch);
    if (liveMx) return liveMx;

    const liveKO = live.find(isKnockout);
    if (liveKO) return liveKO;

    if (live.length) return live.sort((a, b) => priorityScore(b) - priorityScore(a))[0];

    // Sin partidos en vivo: próximo de México, o próximo en general
    const upcoming = ms
      .filter(m => m.status === 'UPCOMING')
      .sort((a, b) => new Date(a.dateUtc) - new Date(b.dateUtc));
    const upcomingMx = upcoming.find(m => m.isMxMatch);
    if (upcomingMx) return upcomingMx;

    // Si todavía no comienza el torneo, mostrar la inauguración
    if (opening && opening.status === 'UPCOMING') return opening;

    return upcoming[0] || ms[ms.length - 1];
  }

  /** Suscribe un callback al polling. Devuelve función para cancelar. */
  function subscribe(cb) {
    let stop = false;
    let timer = null;

    async function tick() {
      if (stop) return;
      try {
        await refresh();
        const live = _cache.matches.find(m => m.status === 'LIVE');
        cb({ matches: _cache.matches, live: live || null });
        // si hay partido en vivo, polleamos más rápido
        const next = live ? C.livePollMs : C.pollMs;
        timer = setTimeout(tick, next);
      } catch (e) {
        console.error('[sports] tick error', e);
        timer = setTimeout(tick, C.pollMs);
      }
    }
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }

  window.Sports = { getMatches, getLiveMatch, subscribe, _cache };
})();
