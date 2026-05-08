/* ========================================================================
   cultural.js
   Detector de "oportunidades culturales" — el componente más editorial
   del dashboard. Cruza señales (velocidad de hashtags, sentimiento,
   menciones de jugadores, keywords Samsung-relevantes) para emitir
   tarjetas accionables que el equipo creativo pueda usar para reaccionar.

   Filosofía: pocas tarjetas, alta señal. Mejor 3 oportunidades reales
   que 20 ruidosas. Si no hay señal suficiente, mejor decir "no hay
   oportunidad ahora" que inventar una.

   Expone: window.Cultural.detect(snapshot) → array de oportunidades
   ======================================================================== */

(function () {
  'use strict';

  const T = window.CONFIG.targets;

  /* Heurísticas */

  /** Detecta hashtags "calientes" — alta velocidad de crecimiento */
  function detectHotHashtags(snapshot) {
    const out = [];
    snapshot.hashtags.forEach(h => {
      // Ignorar hashtags genéricos del Mundial (no son oportunidad)
      if (/Mundial2026|WorldCup2026|FIFAWorldCup/i.test(h.tag)) return;
      // Si crece >40% vs el slot anterior, es señal
      if (h.pct > 40 && h.count > 200) {
        out.push({
          type: 'NARRATIVA ASCENDENTE',
          icon: '📈',
          title: `${h.tag} crece ${Math.round(h.pct)}% en últimos minutos`,
          desc: 'Esta narrativa se está acelerando orgánicamente. Ventana de reacción: 10–20 min antes de saturarse.',
          heat: h.pct > 100 ? 'high' : 'med',
          cta: 'Brief creativo en 10 min',
          score: h.count * (1 + h.pct / 100),
          source: 'hashtag-velocity',
        });
      }
    });
    return out;
  }

  /** Detecta clusters de jugadores (un mismo jugador dominando el feed) */
  function detectPlayerSurge(snapshot) {
    const counts = new Map();
    snapshot.allPosts.slice(-100).forEach(p => {
      T.players.forEach(player => {
        if (p.text.toLowerCase().includes(player)) {
          counts.set(player, (counts.get(player) || 0) + 1);
        }
      });
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return [];

    const [topPlayer, topCount] = sorted[0];
    if (topCount < 8) return []; // umbral mínimo

    // Cómo es el sentimiento alrededor del jugador
    const playerPosts = snapshot.allPosts.filter(p => p.text.toLowerCase().includes(topPlayer));
    const positives = playerPosts.filter(p => p.sentiment === 'pos').length;
    const negatives = playerPosts.filter(p => p.sentiment === 'neg').length;
    const niceCase = positives > negatives;

    // Capitalize player name nicely
    const niceName = topPlayer.replace(/\b\w/g, c => c.toUpperCase());

    return [{
      type: niceCase ? 'PLAYER MOMENT' : 'PLAYER NEGATIVO',
      icon: niceCase ? '⚡' : '⚠️',
      title: `${niceName} domina la conversación (${topCount} menciones)`,
      desc: niceCase
        ? 'Jugador con tracción positiva en orgánico. Si reaccionamos en 15 min, montamos la ola; después se enfría.'
        : 'Jugador en momento polémico. Mejor NO sumarse aquí.',
      heat: niceCase ? 'high' : 'low',
      cta: niceCase ? 'Activar respuesta en X' : 'Esperar / no publicar',
      score: topCount * (niceCase ? 2 : 0.5),
      source: 'player-cluster',
    }];
  }

  /** Detecta volumen masivo de memes — formato cultural emergente */
  function detectMemeWave(snapshot) {
    const recent = snapshot.allPosts.slice(-60);
    const memes = recent.filter(p => p.isMeme);
    const ratio = memes.length / Math.max(recent.length, 1);

    if (memes.length < 5 || ratio < 0.25) return [];

    // Buscamos patrones repetidos en los memes (templates)
    const tokens = new Map();
    memes.forEach(p => {
      const t = p.text.toLowerCase();
      // Detectar "POV: ..." y "Cuando ..."
      const m1 = t.match(/^pov:?\s*(.{10,60})/);
      const m2 = t.match(/^cuando\s*(.{10,60})/);
      const m3 = t.match(/(\b[a-z]{4,15}) (mexicana?|mexicano|mexica)/i);
      [m1, m2, m3].forEach(m => {
        if (m) {
          const key = m[0].slice(0, 30);
          tokens.set(key, (tokens.get(key) || 0) + 1);
        }
      });
    });

    const topToken = [...tokens.entries()].sort((a, b) => b[1] - a[1])[0];

    return [{
      type: 'MEME EMERGENTE',
      icon: '🔥',
      title: topToken
        ? `Formato "${topToken[0]}…" se replica (${topToken[1]}x)`
        : `Ola de ${memes.length} memes en últimos minutos`,
      desc: 'Formato meme con tracción. Replicable visualmente. Considerar reactivo con producto Samsung (Galaxy/cámara).',
      heat: 'high',
      cta: 'Brief creativo en 10 min',
      score: memes.length * 3,
      source: 'meme-wave',
    }];
  }

  /** Detecta mensajes con relevancia directa para Samsung
   *  (foto, cámara, transmisión, pantalla, etc.) */
  function detectSamsungRelevance(snapshot) {
    const recent = snapshot.allPosts.slice(-80);
    const relevant = recent.filter(p => p.mentionsSamsung);
    if (relevant.length < 3) return [];

    return [{
      type: 'TECH RELEVANCE',
      icon: '📱',
      title: `${relevant.length} menciones cruzando Mundial × tech/foto/TV`,
      desc: 'La gente está hablando espontáneamente de capturar el Mundial: foto, video, pantalla, transmisión. Ángulo natural para Galaxy o productos de pantalla Samsung.',
      heat: relevant.length >= 6 ? 'high' : 'med',
      cta: 'Reactive Galaxy creative',
      score: relevant.length * 4,
      source: 'samsung-relevance',
    }];
  }

  /** Lee el sentimiento global y emite advertencia o luz verde */
  function detectSentimentMood(snapshot) {
    const s = snapshot.kpis.sentiment;
    const vol = snapshot.kpis.volume;
    if (vol < 20) return []; // no hay suficiente data

    if (s <= -30) {
      return [{
        type: 'CONTROVERSIA',
        icon: '⚠️',
        title: `Sentimiento global cae a ${s}%`,
        desc: 'La conversación está negativa. Suspender programaticidad. NO publicar contenido optimista en este momento.',
        heat: 'low',
        cta: 'Pausar publicaciones',
        score: 100,
        source: 'sentiment-warn',
      }];
    }
    if (s >= 40 && vol > 60) {
      return [{
        type: 'CELEBRATION',
        icon: '🎉',
        title: `Sentimiento positivo +${s}% con volumen alto`,
        desc: 'Ola de positividad orgánica. Momento óptimo para publicar contenido brand-positive y celebratorio. Ventana: 10–15 min.',
        heat: 'high',
        cta: 'Reactive en 5 min',
        score: 90 + s,
        source: 'sentiment-celebrate',
      }];
    }
    return [];
  }

  /** Si estamos cerca de un partido de México (en vivo o por empezar < 1 hora),
   *  emitimos una oportunidad de "preparar reactivo" */
  function detectMexicoMatchProximity() {
    if (!window.Sports) return [];
    const matches = window.Sports._cache.matches;
    if (!matches || !matches.length) return [];

    const mxMatch = matches.find(m =>
      m.isMxMatch && (
        m.status === 'LIVE' ||
        (m.status === 'UPCOMING' && new Date(m.dateUtc) - Date.now() < 60 * 60 * 1000 && new Date(m.dateUtc) - Date.now() > 0)
      )
    );
    if (!mxMatch) return [];

    if (mxMatch.status === 'LIVE') {
      return [{
        type: 'MOMENTO MÉXICO',
        icon: '🇲🇽',
        title: `México vs ${mxMatch.homeName === 'Mexico' || mxMatch.homeName === 'México' ? mxMatch.awayName : mxMatch.homeName} EN VIVO`,
        desc: 'Tri jugando. Toda la conversación va a girar en torno a este partido. Mantener equipo creativo en standby para reactivar en goles, atajadas y polémicas.',
        heat: 'high',
        cta: 'Equipo en standby',
        score: 200,
        source: 'mx-live',
      }];
    }

    const minutesToKickoff = Math.round((new Date(mxMatch.dateUtc) - Date.now()) / 60000);
    return [{
      type: 'PRE-MATCH MÉXICO',
      icon: '⏱️',
      title: `Partido del Tri en ${minutesToKickoff} min`,
      desc: 'Oportunidad de calentar el feed con contenido pre-partido. Quote tweets, predicciones, throwbacks. La conversación todavía no es masiva, podemos liderarla.',
      heat: 'med',
      cta: 'Publicar warm-up content',
      score: 150 - minutesToKickoff,
      source: 'mx-prematch',
    }];
  }

  /** Punto de entrada: dado un snapshot social, devuelve oportunidades
   *  rankeadas. Limitamos a 6 max para no saturar la UI. */
  function detect(snapshot) {
    if (!snapshot || !snapshot.allPosts) return [];

    const all = [
      ...detectMexicoMatchProximity(),
      ...detectHotHashtags(snapshot),
      ...detectPlayerSurge(snapshot),
      ...detectMemeWave(snapshot),
      ...detectSamsungRelevance(snapshot),
      ...detectSentimentMood(snapshot),
    ];

    // dedupe por source+title aproximado
    const seen = new Set();
    const unique = all.filter(o => {
      const k = `${o.source}|${o.title.slice(0, 40)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return unique.sort((a, b) => b.score - a.score).slice(0, 6);
  }

  window.Cultural = { detect };
})();
