/* ========================================================================
   mock-data.js
   Pool de contenido realista para el modo 'simulated' del social layer.
   Cuando conectes X API o Reddit, este archivo ya no se usa para datos
   reales — solo queda como fixture para tests/demos.
   ======================================================================== */

window.MOCK = {

  /* Templates de posts: el simulador rota entre estos, los rellena con
     valores dinámicos (jugador, equipo, momento) y los marca con
     sentimiento. {VAR} se reemplaza en runtime. */
  postTemplates: [
    // POSITIVO (gol, celebración, orgullo)
    { sent: 'pos', meme: false, text: 'GOOOOOL DE {PLAYER}!!! No tengo voz, no tengo vida, solo tengo tricolor 🇲🇽 #Mundial2026' },
    { sent: 'pos', meme: false, text: 'A esto vinimos. {PLAYER} acaba de meter el partido en el congelador. Vamos México.' },
    { sent: 'pos', meme: false, text: 'Cómo se siente ver al Tri jugar así? Bien bonito. Bien bonito. #VamosMexico' },
    { sent: 'pos', meme: false, text: 'Le acabo de hacer una foto a la tele cuando entró el gol y ya es mi fondo de pantalla #Mundial26' },
    { sent: 'pos', meme: false, text: '{PLAYER} hoy juega como si tuviera algo que demostrarle al mundo. Y se nota.' },

    // NEGATIVO (frustración, eliminación, errores)
    { sent: 'neg', meme: false, text: 'No mames otra vez lo mismo. Otra vez el quinto partido se nos va. #CursoDeLaSelección' },
    { sent: 'neg', meme: false, text: 'Cómo es posible que con todo lo que invertimos sigamos jugando así. Frustrante.' },
    { sent: 'neg', meme: false, text: 'Que no era penal ESO? Estoy llorando, ya bájenle al árbitro #NoEraPenal' },
    { sent: 'neg', meme: false, text: 'Apago la tele. Apago la tele. APAGO LA TELE. #Mundial26' },

    // NEUTRO (análisis, datos, expectativa)
    { sent: 'neu', meme: false, text: 'Para los que dicen que México no merecía estar aquí: hoy el Tri tuvo más posesión que sus últimos 3 partidos juntos.' },
    { sent: 'neu', meme: false, text: 'Datazo: {PLAYER} ya tiene más asistencias en este Mundial que en toda la temporada con su club.' },
    { sent: 'neu', meme: false, text: 'Llegando al estadio. La energía afuera del Azteca es de otro mundo. Reportando desde CDMX.' },

    // MEMES (alta señal cultural — los marca como meme=true)
    { sent: 'pos', meme: true,  text: '🚨 ALERTA DE MEME: Cuando ves a {PLAYER} fallar el gol más fácil del partido pero México igual va ganando' },
    { sent: 'pos', meme: true,  text: 'Todos somos Memo Ochoa cuando nos despiertan a media noche para algo importante 🥱🤲 #AtajadasIconicas' },
    { sent: 'neu', meme: true,  text: 'POV: eres mexicano y te volviste a creer que vamos a llegar a cuartos de final 😎' },
    { sent: 'pos', meme: true,  text: 'Mi mamá viendo el partido sin entender nada pero gritando como si fuera DT #MamáMexicana' },
    { sent: 'neu', meme: true,  text: 'Cuando llega el min 90 y México sigue ganando: 🧎🧎🧎 rezando como si yo fuera el portero' },
    { sent: 'neg', meme: true,  text: 'Yo cada Mundial: "esta vez SÍ es diferente" / Cada Mundial al min 70: 😐' },

    // OPORTUNIDADES SAMSUNG (mencionan tecnología/foto/pantalla)
    { sent: 'pos', meme: false, text: 'Acabo de grabar el gol con el slow motion del Galaxy y se ve INSANE 📱✨ #ShotOnGalaxy' },
    { sent: 'pos', meme: false, text: 'Mi suegra le pidió a su nieto que le ayude a configurar la TV nueva pa\' ver el partido 4K. Ya somos modernos en esta familia 😂' },
    { sent: 'neu', meme: false, text: 'Pregunta seria: cuál es el mejor celular para grabar el partido sin que se vea pixeleado en el estadio?' },

    // OPENING / CEREMONIA
    { sent: 'pos', meme: false, text: 'CHILLANDO con la inauguración del Mundial. Esto se está viendo desde el Azteca y se siente histórico 🇲🇽🇨🇦🇺🇸' },
    { sent: 'neu', meme: false, text: 'Show de inauguración largo pero con momentos hermosos. La parte de los pueblos originarios estuvo tremenda.' },
  ],

  /* Hashtags base que el simulador hace crecer/caer en el tiempo */
  hashtags: [
    { tag: '#Mundial2026',         baseVol: 8500 },
    { tag: '#WorldCup2026',        baseVol: 7200 },
    { tag: '#SeleccionMexicana',   baseVol: 4400 },
    { tag: '#VamosMexico',         baseVol: 3800 },
    { tag: '#FIFAWorldCup',        baseVol: 3500 },
    { tag: '#ElTri',               baseVol: 2900 },
    { tag: '#Mexico26',            baseVol: 2200 },
    { tag: '#NoEraPenal',          baseVol:  900 }, // emerge solo en momentos de polémica
    { tag: '#OchoaSelva',          baseVol:  600 },
    { tag: '#QuintoPartido',       baseVol:  500 },
    { tag: '#ShotOnGalaxy',        baseVol:  280 },
    { tag: '#AzteCa2026',          baseVol:  340 },
  ],

  /* Autores ficticios para que el feed se vea realista */
  authors: [
    { name: 'Andrea Reyes',     handle: '@andreareyes_',    rep: 'Sports Editor · ESPN' },
    { name: 'Memo Ramírez',     handle: '@memoramirez',     rep: 'Comentarista' },
    { name: 'Lucía 🇲🇽',         handle: '@lulu_garza',      rep: '' },
    { name: 'Diego "El Chofer"',handle: '@elchofermx',      rep: 'Pódcast Aguas Profundas' },
    { name: 'Karla Méndez',     handle: '@karlamendez_',    rep: 'Periodista' },
    { name: 'Big Mike',         handle: '@bigmikemx',       rep: '' },
    { name: 'Fer Hernández',    handle: '@ferhg',           rep: '' },
    { name: 'TUDN México',      handle: '@tudn_mx',         rep: '' },
    { name: 'César Saldaña',    handle: '@cesarsaldana',    rep: 'Analista' },
    { name: 'Mariana López',    handle: '@marianalopez',    rep: '' },
    { name: 'Pepe del Barrio',  handle: '@pepedelbarrio',   rep: '' },
    { name: 'Adriana Salas',    handle: '@asalas_mx',       rep: 'Brand Strategist' },
  ],

  /* Templates de oportunidades culturales que el detector puede emitir.
     El detector las elige según señales (velocidad, sentimiento, keywords). */
  oppTemplates: [
    {
      type: 'MEME EMERGENTE',
      icon: '🔥',
      title: 'Meme de "{PLAYER} mirando" se duplica cada 5 min',
      desc: 'Crece un formato derivado del momento del partido. Replicable visualmente con producto Samsung (foto/cámara).',
      heat: 'high',
      cta: 'Brief creativo en 10 min',
    },
    {
      type: 'NARRATIVA ASCENDENTE',
      icon: '📈',
      title: 'Conversación sobre la atajada de Ochoa supera a la del gol',
      desc: 'La gente está hablando más del momento del portero que del marcador. Oportunidad de contenido sobre "héroes silenciosos".',
      heat: 'med',
      cta: 'Sumarse con angle propio',
    },
    {
      type: 'INSIGHT CULTURAL',
      icon: '🎯',
      title: 'Mamás mexicanas viendo el partido = nuevo subtema',
      desc: 'Surge espontáneamente la conversación sobre cómo las mamás reaccionan al fútbol. Ángulo familiar muy alineado a Galaxy/TV.',
      heat: 'med',
      cta: 'Idear contenido familiar',
    },
    {
      type: 'PLAYER MOMENT',
      icon: '⚡',
      title: '{PLAYER} es el más mencionado de los últimos 10 min',
      desc: 'Volumen orgánico altísimo. Si reaccionamos en los próximos 15 min cabalgamos la ola; después se enfría.',
      heat: 'high',
      cta: 'Activar respuesta en X',
    },
    {
      type: 'TECH RELEVANCE',
      icon: '📱',
      title: 'Se viraliza video grabado en estadio comentando "está pixeleado"',
      desc: 'Conversación natural sobre calidad de cámara móvil para capturar el Mundial. Clavada para Galaxy / ProVisual.',
      heat: 'high',
      cta: 'Reactive Galaxy creative',
    },
    {
      type: 'CONTROVERSIA',
      icon: '⚠️',
      title: 'Polémica arbitral domina la conversación',
      desc: 'Sentimiento general cae a -42%. Mejor NO sumarse aquí. Esperar a que se enfríe.',
      heat: 'low',
      cta: 'No publicar / esperar',
    },
    {
      type: 'CELEBRATION',
      icon: '🎉',
      title: 'Pico de conversación positiva tras gol de {PLAYER}',
      desc: 'Volumen +340% en 3 min. Momento óptimo para reaccionar con creatividad ligada al producto o a Samsung MX como marca.',
      heat: 'high',
      cta: 'Reactive en 5 min',
    },
  ],
};
