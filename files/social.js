/* ========================================================================
   social.js
   Capa de social listening. Tres modos:

     1. 'simulated' (default): genera una stream de posts realistas,
        basada en MOCK + estado del partido. Útil para demos y desarrollo.

     2. 'reddit': usa Reddit JSON API (gratis, CORS-friendly).
        Trae top posts/comments de subs configurados.

     3. 'twitter': llama a un proxy serverless que tú configures
        (por seguridad NO expone el bearer token al cliente).
        Ver README para deployment.

   Sin importar el modo, expone la misma interfaz:

     window.Social.subscribe(callback)
       callback recibe { posts, hashtags, sentiment, volumeSeries, kpis }

   Esto significa que la UI nunca cambia: solo la fuente de datos.
   ======================================================================== */

(function () {
  'use strict';

  const C  = window.CONFIG.social;
  const T  = window.CONFIG.targets;
  const MK = window.MOCK;

  /* ====================================================================
     UTILIDADES COMPARTIDAS
     ==================================================================== */

  /** Estima sentimiento simple por keywords (es/en).
   *  Para producción: reemplazar con un servicio (HuggingFace inference,
   *  AWS Comprehend, etc.) o un modelo local. Esto es suficiente como
   *  baseline accionable. */
  const SENT_POS = ['gol', 'goal', 'goooo', 'increíble', 'increible', 'amo', 'love', 'genial', 'épico', 'epico', 'grande', 'orgullo', 'vamos', 'mejor', 'tremendo', 'historico', 'histórico', 'ganamos', 'gana', 'campeon', 'campeón', '🇲🇽', '❤️', '🔥', 'bonito', 'magia'];
  const SENT_NEG = ['perdimos', 'perdemos', 'horrible', 'malísimo', 'malisimo', 'pésimo', 'pesimo', 'cursed', 'frustrante', 'no era penal', 'apago', 'me voy', 'eliminados', 'lloro', 'odio', 'mediocre', 'vergüenza', 'verguenza', 'no mames'];

  function classifySentiment(text) {
    const t = (text || '').toLowerCase();
    let pos = 0, neg = 0;
    SENT_POS.forEach(k => { if (t.includes(k)) pos++; });
    SENT_NEG.forEach(k => { if (t.includes(k)) neg++; });
    if (pos === 0 && neg === 0) return 'neu';
    return pos > neg ? 'pos' : neg > pos ? 'neg' : 'neu';
  }

  /** Detecta si un post es candidato a "meme" por patrones */
  function isMemeyText(text) {
    const t = (text || '').toLowerCase();
    if (/\bpov:|cuando|me explican|nadie:|literally me\b/.test(t)) return true;
    if (/🥲|🥹|💀|🗿|🤡|😭/.test(t)) return true;
    if ((t.match(/[A-Z]{4,}/g) || []).length >= 2) return true; // gritos en mayúsculas
    return false;
  }

  /** Extrae hashtags del texto */
  function extractHashtags(text) {
    return (text.match(/#[\w\dáéíóúüñÁÉÍÓÚÜÑ]+/g) || []).map(t => t);
  }

  /** Detecta si un post menciona un jugador del Tri */
  function mentionsMxPlayer(text) {
    const t = (text || '').toLowerCase();
    return T.players.some(p => t.includes(p));
  }
  function mentionsMexico(text) {
    const t = (text || '').toLowerCase();
    return T.teams.some(p => t.includes(p));
  }
  function mentionsSamsungRelevant(text) {
    const t = (text || '').toLowerCase();
    return T.samsungRelevant.some(p => t.includes(p));
  }

  /** Calcula KPIs agregados a partir de un set de posts */
  function buildKpis(posts) {
    const total = posts.length;
    if (!total) return { volume: 0, sentiment: 0, reach: 0, memes: 0, sentimentBreakdown: { pos: 0, neu: 0, neg: 0 } };

    let pos = 0, neg = 0, neu = 0, memes = 0, reach = 0;
    posts.forEach(p => {
      if (p.sentiment === 'pos') pos++;
      else if (p.sentiment === 'neg') neg++;
      else neu++;
      if (p.isMeme) memes++;
      reach += (p.estReach || 0);
    });

    // Score de sentimiento entre -100 y +100
    const sentimentScore = Math.round(((pos - neg) / total) * 100);

    return {
      volume: total,
      sentiment: sentimentScore,
      reach,
      memes,
      sentimentBreakdown: { pos, neu, neg },
    };
  }

  /* ====================================================================
     MODO 1 — SIMULADO
     Genera un stream realista. Tiene memoria: los hashtags evolucionan,
     el sentimiento ondea, y aparecen "shocks" (gol, polémica) ligados
     a eventos del partido en vivo.
     ==================================================================== */

  const Sim = (() => {
    const posts = [];                    // buffer cronológico
    const volumeByMin = new Array(C.pollMs ? 60 : 60).fill(0);
    const hashtagCounts = new Map();     // tag → { count, lastCount, history[] }
    const trackedAuthors = MK.authors;

    // Iniciar contadores de hashtags con su volumen base
    MK.hashtags.forEach(h => hashtagCounts.set(h.tag, {
      count: h.baseVol + Math.floor(Math.random() * 200),
      lastCount: h.baseVol,
      history: [],
    }));

    // Estado del "evento dramático": cuando hay gol/polémica el simulador
    // bumpea el volumen por unos segundos. La UI lo va a percibir como
    // un pico real.
    let shock = null; // { type: 'goal'|'controversy', expires: ts, player?: string }

    function triggerShock(type, opts = {}) {
      shock = {
        type,
        player: opts.player || pickPlayer(),
        expires: Date.now() + (opts.durationMs || 60_000),
      };
    }

    function pickPlayer() {
      const list = T.players;
      return list[Math.floor(Math.random() * list.length)];
    }

    function pickTemplate() {
      // Si hay shock, sesgamos a templates compatibles
      const templates = MK.postTemplates;
      if (shock && shock.type === 'goal') {
        const goalish = templates.filter(t => t.sent === 'pos' && /gol|goal|goo+l/i.test(t.text));
        if (goalish.length) return goalish[Math.floor(Math.random() * goalish.length)];
      }
      if (shock && shock.type === 'controversy') {
        const ctrl = templates.filter(t => t.sent === 'neg');
        if (ctrl.length) return ctrl[Math.floor(Math.random() * ctrl.length)];
      }
      return templates[Math.floor(Math.random() * templates.length)];
    }

    function fillTemplate(tpl) {
      const player = pickPlayer();
      const text = tpl.text.replace(/\{PLAYER\}/g, player.replace(/\b\w/g, c => c.toUpperCase()));
      const author = trackedAuthors[Math.floor(Math.random() * trackedAuthors.length)];
      // estReach: simulamos alcance con distribución log
      const estReach = Math.round(Math.exp(6 + Math.random() * 5)); // 400 a 60000

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author,
        text,
        time: new Date(),
        sentiment: tpl.sent,
        isMeme: tpl.meme || isMemeyText(text),
        mentionsMx: mentionsMexico(text) || mentionsMxPlayer(text),
        mentionsSamsung: mentionsSamsungRelevant(text),
        hashtags: extractHashtags(text),
        estReach,
        likes: Math.round(estReach * (0.02 + Math.random() * 0.05)),
        retweets: Math.round(estReach * (0.005 + Math.random() * 0.02)),
      };
    }

    /** Genera entre N y M posts por tick, más cuando hay shock */
    function generateBatch() {
      const baseRate = shock ? 8 : 3;
      const variance = shock ? 6 : 4;
      const n = baseRate + Math.floor(Math.random() * variance);
      const batch = [];
      for (let i = 0; i < n; i++) {
        batch.push(fillTemplate(pickTemplate()));
      }
      // bumpea hashtags
      batch.forEach(p => {
        p.hashtags.forEach(tag => {
          if (!hashtagCounts.has(tag)) {
            hashtagCounts.set(tag, { count: 0, lastCount: 0, history: [] });
          }
          const h = hashtagCounts.get(tag);
          h.count += Math.round(p.estReach / 50);
        });
      });
      // si no había hashtag explícito, bumpeamos los base
      if (Math.random() < 0.5) {
        const base = MK.hashtags[Math.floor(Math.random() * MK.hashtags.length)];
        const h = hashtagCounts.get(base.tag);
        h.count += Math.floor(20 + Math.random() * 80);
      }
      return batch;
    }

    function rollMinute() {
      // shifts vol series
      volumeByMin.shift();
      const minTotal = posts.filter(p => Date.now() - p.time.getTime() < 60_000).length;
      volumeByMin.push(minTotal);
      // history de hashtags (para tendencia)
      hashtagCounts.forEach((h) => {
        h.history.push(h.count);
        if (h.history.length > 30) h.history.shift();
        h.lastCount = h.count;
      });
      // expirar shock
      if (shock && Date.now() > shock.expires) shock = null;
    }

    let lastMinuteRoll = Date.now();

    function tick(matchContext) {
      // Si el contexto de partido sugiere evento (gol reciente, etc.) shock
      if (matchContext && matchContext.lastEvent) {
        const e = matchContext.lastEvent;
        if (e.type === 'GOAL' && (!shock || shock.type !== 'goal')) {
          triggerShock('goal', { player: e.player });
        }
      }

      const batch = generateBatch();
      posts.push(...batch);
      // mantenemos buffer manejable (últimas 200 publicaciones)
      while (posts.length > 200) posts.shift();

      if (Date.now() - lastMinuteRoll > 60_000) {
        rollMinute();
        lastMinuteRoll = Date.now();
      }

      return buildSnapshot();
    }

    function buildSnapshot() {
      const recent = posts.slice(-window.CONFIG.ui.feedMaxItems).reverse();

      // Hashtags ordenados por velocidad (delta) si tienen historia
      const trends = [...hashtagCounts.entries()]
        .map(([tag, h]) => {
          const last = h.history[h.history.length - 2] || h.lastCount || h.count;
          const delta = h.count - last;
          const pct = last > 0 ? (delta / last) * 100 : 0;
          return { tag, count: h.count, delta, pct };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const kpis = buildKpis(posts.slice(-100));

      return {
        posts: recent,
        allPosts: posts,
        hashtags: trends,
        volumeSeries: [...volumeByMin],
        kpis,
        shock,
      };
    }

    return { tick, triggerShock, buildSnapshot };
  })();

  /* ====================================================================
     MODO 2 — REDDIT (gratis, sin auth)
     ==================================================================== */

  const Reddit = {
    async fetch() {
      const all = [];
      for (const sub of C.reddit.subs) {
        try {
          const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${C.reddit.maxPosts || 25}`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          (data.data.children || []).forEach(({ data: d }) => {
            const text = `${d.title}\n${d.selftext || ''}`.slice(0, 600);
            all.push({
              id: d.id,
              author: { name: `u/${d.author}`, handle: `r/${sub}`, rep: '' },
              text,
              time: new Date(d.created_utc * 1000),
              sentiment: classifySentiment(text),
              isMeme: isMemeyText(text) || /meme|funny/i.test(d.link_flair_text || ''),
              mentionsMx: mentionsMexico(text) || mentionsMxPlayer(text),
              mentionsSamsung: mentionsSamsungRelevant(text),
              hashtags: extractHashtags(text),
              estReach: d.ups * 30,
              likes: d.ups,
              retweets: d.num_comments,
            });
          });
        } catch (e) {
          console.warn(`[social] reddit r/${sub} failed`, e);
        }
      }
      // ordenar por tiempo desc
      all.sort((a, b) => b.time - a.time);
      return all;
    },

    state: { posts: [], volumeByMin: new Array(60).fill(0) },

    async tick() {
      const fresh = await this.fetch();
      // dedupe vs cache
      const known = new Set(this.state.posts.map(p => p.id));
      const newOnes = fresh.filter(p => !known.has(p.id));
      this.state.posts = [...newOnes, ...this.state.posts].slice(0, 300);

      // hashtags
      const map = new Map();
      this.state.posts.forEach(p => {
        p.hashtags.forEach(tag => {
          map.set(tag, (map.get(tag) || 0) + 1);
        });
      });
      const trends = [...map.entries()]
        .map(([tag, count]) => ({ tag, count, delta: 0, pct: 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // volumen por minuto (aprox)
      this.state.volumeByMin.shift();
      this.state.volumeByMin.push(newOnes.length);

      return {
        posts: this.state.posts.slice(0, window.CONFIG.ui.feedMaxItems),
        allPosts: this.state.posts,
        hashtags: trends,
        volumeSeries: [...this.state.volumeByMin],
        kpis: buildKpis(this.state.posts.slice(0, 100)),
        shock: null,
      };
    },
  };

  /* ====================================================================
     MODO 3 — TWITTER vía proxy serverless del usuario
     ==================================================================== */

  const Twitter = {
    state: { posts: [], volumeByMin: new Array(60).fill(0) },

    async tick() {
      try {
        const res = await fetch(C.twitter.proxyUrl + '?q=' + encodeURIComponent(C.twitter.query));
        if (!res.ok) throw new Error('twitter proxy failed');
        const data = await res.json();
        // Esperamos shape: { posts: [{ id, author{name,handle}, text, time, metrics{likes, retweets, reach} }] }
        const fresh = (data.posts || []).map(p => ({
          ...p,
          time: new Date(p.time),
          sentiment: classifySentiment(p.text),
          isMeme: isMemeyText(p.text),
          mentionsMx: mentionsMexico(p.text) || mentionsMxPlayer(p.text),
          mentionsSamsung: mentionsSamsungRelevant(p.text),
          hashtags: extractHashtags(p.text),
          estReach: (p.metrics && p.metrics.reach) || 0,
          likes:    (p.metrics && p.metrics.likes) || 0,
          retweets: (p.metrics && p.metrics.retweets) || 0,
        }));

        const known = new Set(this.state.posts.map(p => p.id));
        const newOnes = fresh.filter(p => !known.has(p.id));
        this.state.posts = [...newOnes, ...this.state.posts].slice(0, 300);

        const map = new Map();
        this.state.posts.forEach(p => p.hashtags.forEach(t => map.set(t, (map.get(t) || 0) + 1)));
        const trends = [...map.entries()].map(([tag, count]) => ({ tag, count, delta: 0, pct: 0 })).sort((a, b) => b.count - a.count).slice(0, 10);

        this.state.volumeByMin.shift();
        this.state.volumeByMin.push(newOnes.length);

        return {
          posts: this.state.posts.slice(0, window.CONFIG.ui.feedMaxItems),
          allPosts: this.state.posts,
          hashtags: trends,
          volumeSeries: [...this.state.volumeByMin],
          kpis: buildKpis(this.state.posts.slice(0, 100)),
          shock: null,
        };
      } catch (err) {
        console.error('[social] twitter mode failed', err);
        // fallback a simulado para no romper el dashboard
        return Sim.tick();
      }
    },
  };

  /* ====================================================================
     ORQUESTACIÓN PÚBLICA
     ==================================================================== */

  function getCurrentTick() {
    if (C.mode === 'reddit')  return Reddit.tick.bind(Reddit);
    if (C.mode === 'twitter') return Twitter.tick.bind(Twitter);
    return (ctx) => Sim.tick(ctx);
  }

  function subscribe(callback, getMatchContext) {
    let stop = false;
    const tickFn = getCurrentTick();

    async function loop() {
      if (stop) return;
      try {
        const ctx = getMatchContext ? getMatchContext() : null;
        const snap = await tickFn(ctx);
        callback(snap);
      } catch (e) {
        console.error('[social] subscribe loop error', e);
      }
      if (!stop) setTimeout(loop, C.pollMs);
    }

    loop();
    return () => { stop = true; };
  }

  /** Permite que sports.js notifique eventos relevantes
   *  para que el simulador reaccione (volumen sube ante un gol). */
  function reportMatchEvent(event) {
    if (C.mode === 'simulated') {
      if (event.type === 'GOAL') Sim.triggerShock('goal', { player: event.player });
      if (event.type === 'CONTROVERSY') Sim.triggerShock('controversy');
    }
  }

  window.Social = { subscribe, reportMatchEvent, classifySentiment };
})();
