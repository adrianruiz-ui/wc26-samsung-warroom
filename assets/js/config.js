/* ========================================================================
   config.js
   Punto único de configuración. Cambia aquí endpoints, claves y
   parámetros de polling. Todo lo demás del dashboard lo lee desde aquí.
   ======================================================================== */

window.CONFIG = {

  /* ---------- API DE RESULTADOS DEPORTIVOS ----------
   * TheSportsDB es gratuita, sin API key requerida (key=3 es la pública).
   * Documentación: https://www.thesportsdb.com/api.php
   * IDs útiles:
   *   - FIFA World Cup league ID: 4429
   *   - Sport: "Soccer"
   *   - Temporada Mundial 2026: "2026"
   * Si más adelante quieres más detalle (lineups, eventos minuto a
   * minuto, etc.) podemos cambiar a API-Football vía RapidAPI (free tier
   * 100 req/día) — la capa sports.js está aislada para hacerlo simple.
   */
  sports: {
    baseUrl: 'https://www.thesportsdb.com/api/v1/json/3',
    leagueId: '4429',          // FIFA World Cup
    leagueName: 'FIFA World Cup',
    season: '2026',
    pollMs: 30_000,            // refresca cada 30s
    livePollMs: 15_000,        // si hay partido en vivo, cada 15s
  },

  /* ---------- CAPA SOCIAL ----------
   * IMPORTANTE: La X/Twitter API gratuita ya no existe (desde 2023).
   * Opciones:
   *   1. X API v2 Basic (~$100 USD/mes): pega tu bearer token aquí.
   *   2. Reddit JSON API (gratis, CORS-friendly): muy útil para r/soccer
   *      y r/MexicoNT — buen proxy de conversación cultural.
   *   3. Capa simulada (default): genera datos realistas para probar la
   *      arquitectura sin costo. El UI es idéntico cuando se conecte real.
   *
   * Cambia 'mode' a 'reddit' o 'twitter' cuando estés listo.
   */
  social: {
    mode: 'reddit',         // 'simulated' | 'reddit' | 'twitter'
    pollMs: 15_000,            // refresca cada 15s
    twitter: {
      bearerToken: '',         // pegar token aquí cuando se contrate API
      // Cuando se active 'twitter', el dashboard usa un endpoint serverless
      // intermedio (ver README) para evitar exponer el token al cliente.
      proxyUrl: '/api/twitter-search',
      query: '(Mundial2026 OR WorldCup2026 OR SeleccionMexicana OR FIFAWorldCup) lang:es OR lang:en -is:retweet',
    },
    reddit: {
      // Reddit JSON es público y CORS-friendly
      // Subreddits relevantes para Samsung MX
      subs: ['soccer', 'MexicoNT', 'FIFA', 'mexico'],
      maxPosts: 30,
    },
  },

  /* ---------- TARGETS CULTURALES ----------
   * El detector de oportunidades pondera más alto cualquier conversación
   * que mencione estos temas/keywords. Editar libremente con el equipo.
   */
  targets: {
    // Equipos que importan al brief Samsung MX (selección + rivales clave)
    teams: ['mexico', 'méxico', 'tri', 'el tri', 'mexican national team'],
    // Jugadores top del Tri que probablemente protagonicen narrativas
    players: [
      'santiago giménez', 'gimenez', 'edson álvarez', 'edson alvarez',
      'raúl jiménez', 'raul jimenez', 'hirving lozano', 'chucky',
      'memo ochoa', 'guillermo ochoa', 'césar montes', 'cesar montes',
      'orbelín pineda', 'orbelin pineda', 'luis chávez', 'luis chavez'
    ],
    // Sedes relevantes (Mundial 2026 es CAN-MEX-USA)
    venues: ['azteca', 'estadio azteca', 'cdmx', 'guadalajara', 'monterrey'],
    // Memes/keywords culturales que el equipo creativo quiere monitorear
    cultural: [
      'meme', 'viral', 'épico', 'epico', 'ridículo', 'ridiculo',
      'llorar', 'corazón', 'corazon', 'mexicano hasta', 'eliminados',
      'quinto partido', 'no era penal', 'cantar el himno'
    ],
    // Keywords con relevancia directa para Samsung México
    samsungRelevant: [
      'foto', 'fotografía', 'fotografia', 'celular', 'cámara', 'camara',
      'video', 'tv', 'pantalla', 'transmisión', 'transmision', 'galaxy',
      'tecnología', 'tecnologia', 'estadio', 'celebración', 'celebracion'
    ],
  },

  /* ---------- UI ----------
   * Comportamiento de presentación.
   */
  ui: {
    feedMaxItems: 14,           // tweets visibles en el live feed
    chartWindowMin: 30,         // ventana del chart de volumen (min)
    autoRotateHero: true,       // si hay varios partidos, rota cada N seg
    heroRotateMs: 20_000,
  },
};
