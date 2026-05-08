# WC26 · Samsung México — Command Center

Dashboard de monitoreo en tiempo real del Mundial 2026, pensado como **war room creativo** para el equipo de Samsung México: cruza datos deportivos en vivo con escucha cultural en X/redes y detecta oportunidades para reaccionar.

## ¿Qué hace?

- **Hero**: el partido más relevante del momento (México > inauguración > eliminatoria > otros en vivo).
- **Live Match Center**: todos los partidos del Mundial — en vivo, próximos, finalizados.
- **Social Listening**: KPIs (volumen, sentimiento, alcance, memes), curva de volumen, trends y feed.
- **Cultural Opportunities**: detector que cruza señales y emite tarjetas accionables.

## Stack

Cero frameworks. HTML + CSS + JS vanilla. Cargas rápido en GitHub Pages, modular, fácil de modificar.

```
samsung-wc-dashboard/
├── index.html
├── assets/
│   ├── css/styles.css            # tema war-room dark
│   └── js/
│       ├── config.js             # ⭐ punto único de configuración
│       ├── sports.js             # capa deportiva (TheSportsDB)
│       ├── social.js             # capa social (3 modos)
│       ├── cultural.js           # detector de oportunidades
│       ├── ui.js                 # rendering al DOM
│       └── app.js                # orquestación
├── assets/data/mock-data.js      # fixtures para modo simulado
└── README.md
```

---

## Deploy en GitHub Pages

1. Crea un repo nuevo en GitHub (ej. `wc26-command-center`).
2. Sube esta carpeta completa al `main`.
3. En el repo: **Settings → Pages → Source: Deploy from branch → main / root**.
4. Espera 1–2 minutos. Tu dashboard estará en `https://<usuario>.github.io/wc26-command-center/`.

---

## Datos deportivos — TheSportsDB

Por defecto usa la API gratuita de [TheSportsDB](https://www.thesportsdb.com/api.php) con la key pública `3` (no requiere registro):

- League ID FIFA World Cup: `4429`
- Endpoints usados: `eventsseason.php`, `livescore.php`

**Limitaciones honestas:** la versión free trae partidos y marcadores, pero los eventos minuto a minuto (goles individuales, tarjetas) son limitados. Si Samsung quiere granularidad mayor, recomiendo upgrade a [API-Football vía RapidAPI](https://rapidapi.com/api-sports/api/api-football) (free tier 100 req/día — suficiente para un dashboard de campaña, ~$15-25 USD/mes para tier productivo). Cambiar fuente solo toca `assets/js/sports.js`.

---

## Social Listening — los 3 modos

Esta es la decisión arquitectónica más importante. **La X API gratuita ya no existe** desde 2023. Edita `assets/js/config.js`, propiedad `social.mode`:

### Modo 1: `'simulated'` (default)
Genera un stream realista de posts en español/inglés con sentimiento, memes, hashtags creciendo orgánicamente, y "shocks" simulados cuando hay un gol. **Útil para:**
- Demos a stakeholders.
- Probar el comportamiento del detector cultural.
- Tener algo en pantalla durante la fase de pruebas pre-Mundial.

### Modo 2: `'reddit'` (gratis, sin auth, sin proxy)
Hace fetch directo de Reddit JSON API en `r/soccer`, `r/MexicoNT`, `r/FIFA`, `r/mexico`. CORS-friendly, funciona desde GitHub Pages.

```js
window.CONFIG.social.mode = 'reddit';
```

**Tradeoff:** Reddit no es Twitter, pero captura una conversación diferente y útil — más analítica, threads largos, menos ruido. Para detección de memes y narrativas culturales mexicanas funciona sorprendentemente bien.

### Modo 3: `'twitter'` (X API v2 — paid)
Requiere bearer token de [developer.x.com](https://developer.x.com/) (Basic tier ~$100 USD/mes).

**No pongas el token en el cliente.** Necesitas un proxy serverless mínimo. Ejemplo en Cloudflare Workers (gratis hasta 100k req/día):

```js
// wc26-twitter-proxy worker
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || 'WorldCup2026 -is:retweet';
    const apiUrl = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=50&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`;

    const r = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${env.X_BEARER_TOKEN}` },
    });
    const data = await r.json();
    const users = new Map((data.includes?.users || []).map(u => [u.id, u]));

    const posts = (data.data || []).map(t => {
      const u = users.get(t.author_id) || {};
      return {
        id: t.id,
        author: { name: u.name || 'Usuario', handle: '@' + (u.username || ''), rep: '' },
        text: t.text,
        time: t.created_at,
        metrics: {
          likes: t.public_metrics?.like_count || 0,
          retweets: t.public_metrics?.retweet_count || 0,
          reach: (t.public_metrics?.impression_count) || 0,
        },
      };
    });

    return new Response(JSON.stringify({ posts }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
```

Sube ese worker a `https://wc26-twitter.<tu-cuenta>.workers.dev` y luego:

```js
window.CONFIG.social.mode = 'twitter';
window.CONFIG.social.twitter.proxyUrl = 'https://wc26-twitter.<tu-cuenta>.workers.dev';
```

El dashboard hablará con el proxy, el proxy guarda el token. Bug-free, secure.

---

## Detector cultural — cómo funciona

`assets/js/cultural.js` cruza señales de cada snapshot social y emite tarjetas. **Reglas implementadas:**

| Detector | Trigger | Heat |
|---|---|---|
| `detectMexicoMatchProximity` | México juega ahora o en <60 min | high/med |
| `detectHotHashtags` | hashtag crece >40% y count >200 | high si >100% |
| `detectPlayerSurge` | jugador con >8 menciones recientes | high si sentimiento positivo |
| `detectMemeWave` | >5 memes y >25% del feed reciente es meme | high |
| `detectSamsungRelevance` | >3 menciones cruzando Mundial × tech/foto/TV | high si >6 |
| `detectSentimentMood` | sentimiento ≤-30% (alerta) o ≥+40% con vol alto (celebrar) | low / high |

Filosofía: **cero falsos positivos antes que volumen de tarjetas**. Si no hay señal, mostramos "Sin oportunidades ahora". Es más útil al equipo creativo que listas infladas.

---

## Personalizaciones rápidas

### Agregar un jugador / keyword nueva al radar
`config.js` → `targets.players` o `targets.cultural`.

### Cambiar sub-reddits monitoreados
`config.js` → `social.reddit.subs`.

### Acelerar/desacelerar refresco
`config.js` → `sports.pollMs`, `social.pollMs`.

### Cambiar branding
`styles.css` → `:root { --samsung: ...; --mx-green: ...; }`.

### Sentiment analysis serio (no por keywords)
Reemplaza `Social.classifySentiment` (en `social.js`) con una llamada a tu servicio preferido — Hugging Face Inference API tiene modelos en español gratis con rate limits razonables.

---

## Pre-flight checklist (antes del 11 de junio 2026)

- [ ] Confirmar que TheSportsDB ya tiene calendario Mundial 2026 cargado (revisar `https://www.thesportsdb.com/season/4429-fifa-world-cup`)
- [ ] Decidir modo social: si Samsung MX contrata X API, configurar proxy
- [ ] Customizar `targets.players` con la lista oficial del Tri post-convocatoria
- [ ] Hacer pruebas en monitor war-room (1920x1080 mínimo)
- [ ] Definir guardia: equipo creativo en standby durante partidos del Tri y eliminatorias
- [ ] Plantillas de respuesta pre-aprobadas para los 3-4 escenarios más probables (gol, polémica, eliminación, atajada épica)

---

## Limitaciones conocidas (transparencia)

1. **Sentiment por keywords** es baseline, no estado del arte. Para campaña real, recomiendo conectar Hugging Face o equivalente (cuesta centavos por mes).
2. **TheSportsDB no expone eventos minuto a minuto en free tier** — el timeline de goles/tarjetas en el hero queda vacío hasta que conectes API-Football.
3. **El detector cultural detecta patrones, no garantiza relevancia** — el equipo creativo siempre debe validar antes de publicar.
4. **El simulador es para demos** — no usarlo como dato real bajo ninguna circunstancia.

---

## Contacto / siguiente iteración

Áreas naturales de evolución cuando esté en producción:
- Push notifications cuando se detectan oportunidades HIGH.
- Export rápido a Slack del equipo creativo (webhook → POST por opportunity).
- Histórico (ahora todo es en memoria).
- Brand safety: filtros para no sumarse a temas sensibles (ya hay base con el detector de "controversia").

Buen Mundial. 🇲🇽
