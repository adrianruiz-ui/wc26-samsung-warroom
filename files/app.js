/* ========================================================================
   app.js
   Orquesta todo. Inicializa cada capa, conecta callbacks, y mantiene
   el estado global de la app.
   ======================================================================== */

(function () {
  'use strict';

  /* ---------- estado interno ---------- */
  const state = {
    matches: [],
    liveMatch: null,
    socialSnapshot: null,
    prevKpis: null,
    eventsSeenIds: new Set(),
  };

  /* ---------- inicialización ---------- */

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    UI.setStatus('warn', 'CONECTANDO…');

    // 1. Bind de tabs UI
    UI.bindMatchTabs(() => UI.renderMatchList(state.matches));
    UI.bindFeedTabs(() => {
      if (state.socialSnapshot) UI.renderFeed(state.socialSnapshot.allPosts);
    });

    // 2. Lanzar suscripción a sports — TheSportsDB
    try {
      Sports.subscribe(handleSportsUpdate);
    } catch (err) {
      console.error('[app] sports subscribe failed', err);
      UI.setStatus('err', 'SPORTS API OFFLINE');
    }

    // 3. Lanzar suscripción a social
    try {
      Social.subscribe(handleSocialUpdate, () => ({
        liveMatch: state.liveMatch,
        lastEvent: getRecentEvent(),
      }));
    } catch (err) {
      console.error('[app] social subscribe failed', err);
    }

    // 4. Reposicionar el chart cuando cambia el viewport
    window.addEventListener('resize', () => {
      if (state.socialSnapshot) UI.renderVolumeChart(state.socialSnapshot.volumeSeries);
    });
  }

  /* ---------- handlers ---------- */

  function handleSportsUpdate({ matches, live }) {
    state.matches = matches;
    state.liveMatch = live;

    UI.setStatus('ok', live ? `LIVE · ${live.minute || 'EN VIVO'}` : `${matches.length} PARTIDOS · DATA OK`);

    // Etiqueta de match day en el top bar
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '');
    UI.setMatchDay(`MATCH DAY · ${today}`);

    // Hero: si hay live, mostrarlo; si no, próximo prioritario
    Sports.getLiveMatch().then(m => {
      UI.renderHero(m);
      // momentum heurístico: si tiene score, usar ratio; si no, 50/50
      if (m && m.homeScore != null && m.awayScore != null) {
        const total = m.homeScore + m.awayScore + 2; // +2 evita división por cero y suaviza
        const homePct = ((m.homeScore + 1) / total) * 100;
        const awayPct = 100 - homePct;
        UI.renderMomentum(homePct, awayPct);
      } else {
        UI.renderMomentum(50, 50, 'Pre-partido · sin momentum');
      }
    });

    UI.renderMatchList(matches);

    // Detectar nuevos eventos del live match para notificar al social layer
    if (live && live.events) {
      live.events.forEach(ev => {
        const k = `${live.id}-${ev.minute}-${ev.type}`;
        if (!state.eventsSeenIds.has(k)) {
          state.eventsSeenIds.add(k);
          if (ev.type === 'GOAL') Social.reportMatchEvent({ type: 'GOAL', player: ev.player });
        }
      });
    }
  }

  function handleSocialUpdate(snapshot) {
    state.socialSnapshot = snapshot;

    UI.renderKpis(snapshot.kpis, state.prevKpis);
    UI.renderVolumeChart(snapshot.volumeSeries);
    UI.renderTrends(snapshot.hashtags);
    UI.renderFeed(snapshot.allPosts);

    // Detector cultural cruzando todo lo que tenemos
    const opps = Cultural.detect(snapshot);
    UI.renderOpps(opps);

    state.prevKpis = snapshot.kpis;
  }

  function getRecentEvent() {
    if (!state.liveMatch || !state.liveMatch.events || !state.liveMatch.events.length) return null;
    return state.liveMatch.events[state.liveMatch.events.length - 1];
  }

  /* ---------- expose para debug ---------- */
  window.__APP__ = state;
})();
