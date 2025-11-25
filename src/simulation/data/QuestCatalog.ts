import type { Quest } from "../../domain/types/simulation/quests";

/**
 * Catálogo estático de todas las misiones (Quests) disponibles en el juego.
 * Actúa como una base de datos en memoria de las definiciones de misiones.
 *
 * Contiene:
 * - Misiones de historia principal (`main_story`)
 * - Misiones secundarias (`side_quest`)
 * - Misiones diarias (`daily`)
 * - Misiones de exploración (`exploration`)
 */
export class QuestCatalog {
  private static readonly quests: Quest[] = [
    {
      id: "main_awakening",
      title: "El Despertar de la Resonancia",
      description:
        "Isa y Stev han despertado en un mundo extraño. Deben encontrarse y descubrir qué les ha sucedido.",
      loreText:
        "En un momento de quietud, dos almas conectadas se encuentran separadas por fuerzas desconocidas. La resonancia entre ellas vibra débilmente, como un hilo invisible que los une a través de la distancia. Es hora de que se reencuentren y comprendan su nuevo destino.",
      category: "main_story",
      difficulty: "easy",
      status: "available",
      version: 0,

      objectives: [
        {
          id: "find_partner",
          type: "interact_with_entity",
          description: "Encuentra a tu compañero de alma",
          targetEntity: "partner_entity",
          isCompleted: false,
          isOptional: false,
          hints: [
            "Siente la resonancia en tu corazón",
            "Los vínculos del alma trascienden la distancia",
            "Camina hacia donde sientes mayor calidez",
          ],
        },
      ],

      requirements: [],
      isRepeatable: false,

      dialogues: [
        {
          stage: "intro",
          speaker: "narrator",
          text: "El viento susurra secretos antiguos mientras dos almas despiertan en tierras desconocidas. La resonancia late débilmente, como un corazón que busca a su par...",
        },
        {
          stage: "progress",
          speaker: "isa",
          text: "¿Dónde estoy? Siento... siento algo familiar cerca. Como si una parte de mí estuviera llamándome.",
        },
        {
          stage: "completion",
          speaker: "stev",
          text: "¡Isa! Por fin te encuentro. Sabía que nuestra conexión nos guiaría de vuelta el uno al otro.",
        },
      ],

      introText:
        "El despertar en un mundo nuevo puede ser aterrador, pero algunos vínculos son más fuertes que el miedo.",
      progressTexts: [
        "La resonancia se intensifica...",
        "Puedes sentir una presencia familiar cerca",
        "El vínculo se fortalece con cada paso",
      ],
      completionText:
        "La resonancia florece como una sinfonía cuando las almas se reencuentran. Ahora pueden enfrentar juntos los misterios de este nuevo mundo.",
      rewards: [
        {
          type: "experience",
          amount: 100,
          description: "Experiencia del primer reencuentro",
        },
        {
          type: "unlock_feature",
          unlockId: "resonance_tracking",
          description: "Desbloqueado: Seguimiento de Resonancia",
        },
      ],

      estimatedDuration: 5,
      tags: ["tutorial", "resonance", "meeting"],
      isHidden: false,
    },

    {
      id: "main_first_meal",
      title: "El Banquete de los Recuerdos",
      description:
        "Compartir una comida juntos puede despertar memorias del pasado y fortalecer los lazos del presente.",
      loreText:
        "Dicen que los sabores tienen el poder de despertar recuerdos dormidos. En este nuevo mundo, quizás una comida compartida pueda revelar fragmentos de quiénes eran antes y quiénes están destinados a ser.",
      category: "main_story",
      difficulty: "easy",
      status: "not_started",
      version: 0,

      objectives: [
        {
          id: "gather_food",
          type: "collect_resource",
          description:
            "Recolecta ingredientes para preparar una comida especial",
          requiredAmount: 3,
          currentAmount: 0,
          isCompleted: false,
          isOptional: false,
          hints: [
            "Busca frutas en los árboles cercanos",
            "Algunas hierbas aromáticas crecen cerca del agua",
            "Los hongos suelen esconderse bajo la sombra",
          ],
        },
        {
          id: "cook_together",
          type: "complete_activity",
          description: "Cocinen juntos la comida recolectada",
          target: "cooking",
          isCompleted: false,
          isOptional: false,
        },
        {
          id: "share_meal",
          type: "complete_activity",
          description: "Compartan la comida en un momento de intimidad",
          target: "eating",
          isCompleted: false,
          isOptional: false,
        },
      ],

      requirements: [{ type: "quest_completed", questId: "main_awakening" }],
      isRepeatable: false,

      dialogues: [
        {
          stage: "intro",
          speaker: "isa",
          text: "Tengo hambre, pero más que eso... siento que cocinar juntos podría traer algo especial. ¿Te gustaría buscar ingredientes conmigo?",
        },
        {
          stage: "progress",
          speaker: "stev",
          text: "Estos sabores... despiertan algo en mí. Como ecos de comidas pasadas, de momentos que creía perdidos.",
          conditions: { objectiveCompleted: "gather_food" },
        },
        {
          stage: "completion",
          speaker: "narrator",
          text: "Con cada bocado compartido, las memorias fluyen como un río cálido. No son solo recuerdos de sabores, sino de momentos juntos, de risas y sussurros bajo las estrellas.",
        },
      ],

      introText:
        "El hambre del cuerpo palidece ante el hambre del alma por conexión y recuerdos.",
      progressTexts: [
        "Los ingredientes susurran secretos de la tierra",
        "El aroma de la cocina despierta algo profundo",
        "Cada sabor es una llave a memorias olvidadas",
      ],
      completionText:
        "La comida compartida se convierte en un ritual de reconexión. Los sabores han despertado fragmentos del pasado y fortalecido los lazos del presente.",
      rewards: [
        {
          type: "stats_boost",
          statsBoost: { happiness: 20, energy: 15 },
          description:
            "Incremento de felicidad y energía por la comida compartida",
        },
        {
          type: "unlock_feature",
          unlockId: "cooking_recipes",
          description: "Desbloqueado: Recetas Especiales",
        },
        {
          type: "experience",
          amount: 150,
          description: "Experiencia culinaria y emocional",
        },
      ],

      estimatedDuration: 15,
      tags: ["cooking", "memories", "bonding", "food"],
      isHidden: false,
    },
    {
      id: "side_garden_mystery",
      title: "El Jardín de los Susurros",
      description:
        "Un extraño jardín ha aparecido durante la noche. Sus flores brillan con una luz etérea y parecen susurrar secretos antiguos.",
      loreText:
        "En las fronteras entre los sueños y la realidad crecen jardines que no siguen las leyes naturales. Se dice que estos lugares están tocados por magia antigua y que quienes se acercan con corazón puro pueden escuchar los secretos que las flores guardan.",
      category: "side_quest",
      difficulty: "medium",
      status: "not_started",
      version: 0,

      objectives: [
        {
          id: "find_garden",
          type: "reach_location",
          description: "Encuentra el jardín misterioso",
          targetLocation: { x: 800, y: 400, radius: 50 },
          isCompleted: false,
          isOptional: false,
          hints: [
            "Las flores brillantes se ven mejor al amanecer",
            "Sigue el aroma de flores nocturnas",
            "Los susurros se oyen mejor en silencio",
          ],
        },
        {
          id: "listen_whispers",
          type: "complete_activity",
          description: "Escucha atentamente los susurros de las flores",
          target: "meditating",
          isCompleted: false,
          isOptional: false,
        },
        {
          id: "collect_essence",
          type: "find_item",
          description: "Recolecta la esencia floral que revelan los susurros",
          target: "flower_essence",
          isCompleted: false,
          isOptional: false,
        },
      ],

      requirements: [
        { type: "stats_threshold", statsRequired: { happiness: 30 } },
      ],
      isRepeatable: false,

      dialogues: [
        {
          stage: "intro",
          speaker: "narrator",
          text: "El viento nocturno trae consigo un aroma desconocido, dulce y misterioso. En algún lugar, flores que no deberían existir han florecido bajo la luna.",
        },
        {
          stage: "progress",
          speaker: "isa",
          text: "¿Escuchas eso? Las flores... están susurrando. Es como si trataran de contarnos algo importante sobre este lugar.",
          conditions: { objectiveCompleted: "find_garden" },
        },
        {
          stage: "completion",
          speaker: "stev",
          text: "La esencia que guardaban... puedo sentir su poder. Es como si lleváramos un pedacito de magia antigua con nosotros.",
        },
      ],

      introText:
        "Los misterios florecen cuando menos los esperamos, como jardines que aparecen en la noche.",
      progressTexts: [
        "Un aroma extraño flota en el aire",
        "Los susurros se vuelven más claros",
        "La magia antigua despierta a tu toque",
      ],
      completionText:
        "La esencia floral palpita con poder ancestral. Has ganado una conexión con las fuerzas mágicas que moldean este mundo.",
      rewards: [
        {
          type: "stats_boost",
          statsBoost: { creativity: 25, energy: 10 },
          description: "La magia floral despierta tu creatividad",
        },
        {
          type: "title",
          title: "Susurrador de Flores",
          description:
            "Título otorgado a quien escucha los secretos del jardín",
        },
        {
          type: "experience",
          amount: 200,
          description: "Experiencia mística del jardín",
        },
      ],

      estimatedDuration: 20,
      tags: ["mystery", "magic", "nature", "exploration"],
      isHidden: false,
    },

    {
      id: "side_memory_fragments",
      title: "Fragmentos del Ayer",
      description:
        "Objetos extraños aparecen por el mundo, cada uno conteniendo fragmentos de memorias. Recolectarlos podría revelar verdades sobre el pasado.",
      loreText:
        "Cuando dos almas están profundamente conectadas, sus memorias pueden manifestarse físicamente en momentos de gran transición. Estos fragmentos cristalizados guardan ecos de días felices, promesas susurradas y sueños compartidos.",
      category: "side_quest",
      difficulty: "medium",
      status: "not_started",
      version: 0,

      objectives: [
        {
          id: "find_memory_fragments",
          type: "collect_resource",
          description: "Encuentra fragmentos de memoria dispersos por el mundo",
          requiredAmount: 7,
          currentAmount: 0,
          isCompleted: false,
          isOptional: false,
          hints: [
            "Los fragmentos brillan con luz cálida al atardecer",
            "Busca en lugares que despierten nostalgia",
            "Los recuerdos felices se esconden en rincones acogedores",
          ],
        },
        {
          id: "piece_together_memory",
          type: "complete_activity",
          description:
            "Ensambla los fragmentos para reconstruir una memoria perdida",
          target: "contemplating",
          isCompleted: false,
          isOptional: false,
        },
      ],

      requirements: [{ type: "quest_completed", questId: "main_first_meal" }],
      isRepeatable: false,

      dialogues: [
        {
          stage: "intro",
          speaker: "stev",
          text: "Estos cristales... cuando los toco, veo imágenes borrosas. Son nuestros recuerdos, ¿verdad? Están esparcidos por todas partes.",
        },
        {
          stage: "progress",
          speaker: "isa",
          text: "Cada fragmento que encontramos hace que la imagen se vuelva más clara. Es como armar un rompecabezas de nuestras propias vidas.",
          conditions: { objectiveCompleted: "find_memory_fragments" },
        },
        {
          stage: "completion",
          speaker: "narrator",
          text: "Los fragmentos se unen como piezas de un mosaico dorado. La memoria reconstituida pulsa con la calidez de días mejores: una tarde de verano, risas bajo los cerezos, y la promesa de estar siempre juntos.",
        },
      ],

      introText:
        "Los recuerdos son tesoros que el tiempo no puede robar, solo esconder temporalmente.",
      progressTexts: [
        "Cada fragmento susurra una historia",
        "Las piezas del pasado se revelan lentamente",
        "La memoria cobra vida entre tus manos",
      ],
      completionText:
        "La memoria reconstruida late con vida propia. Ahora recuerdas: una promesa hecha bajo las estrellas, un amor que trasciende el tiempo y el espacio.",
      rewards: [
        {
          type: "stats_boost",
          statsBoost: { happiness: 30, resonance: 20 },
          description: "Los recuerdos restaurados fortalecen su vínculo",
        },
        {
          type: "unlock_feature",
          unlockId: "memory_palace",
          description: "Desbloqueado: Palacio de la Memoria",
        },
        {
          type: "experience",
          amount: 250,
          description: "Experiencia de reconexión con el pasado",
        },
      ],

      estimatedDuration: 25,
      tags: ["memories", "exploration", "mystery", "romance"],
      isHidden: false,
    },
    {
      id: "daily_resonance_meditation",
      title: "Meditación de Resonancia Diaria",
      description:
        "Dedica tiempo cada día a meditar juntos para fortalecer vuestro vínculo espiritual.",
      loreText:
        "La resonancia entre almas gemelas requiere cuidado constante, como una llama que debe ser alimentada. La meditación compartida es el combustible que mantiene viva esta conexión sagrada.",
      category: "daily",
      difficulty: "easy",
      status: "not_started",
      version: 0,

      objectives: [
        {
          id: "meditate_together",
          type: "complete_activity",
          description: "Mediten juntos durante al menos 5 minutos",
          target: "meditating",
          requiredAmount: 300,
          currentAmount: 0,
          isCompleted: false,
          isOptional: false,
        },
      ],

      requirements: [],
      isRepeatable: true,

      dialogues: [
        {
          stage: "intro",
          speaker: "isa",
          text: "Siento que nuestra conexión necesita atención diaria. ¿Meditamos juntos? Solo unos minutos pueden hacer la diferencia.",
        },
        {
          stage: "completion",
          speaker: "stev",
          text: "Puedo sentir cómo nuestra resonancia se fortalece. Es como si nuestras almas se sincronizaran en armonía perfecta.",
        },
      ],

      introText:
        "La práctica diaria fortalece incluso los vínculos más profundos.",
      progressTexts: [
        "La calma los envuelve",
        "Sus respiraciones se sincronizan",
        "La resonancia pulsa en armonía",
      ],
      completionText:
        "La meditación compartida ha fortalecido vuestro vínculo. La resonancia fluye más pura y poderosa.",
      rewards: [
        {
          type: "stats_boost",
          statsBoost: { resonance: 5, stress: -10 },
          description: "Beneficios diarios de la meditación",
        },
        {
          type: "experience",
          amount: 50,
          description: "Experiencia espiritual diaria",
        },
      ],

      estimatedDuration: 5,
      tags: ["daily", "meditation", "resonance", "spiritual"],
      isHidden: false,
    },
    {
      id: "explore_ancient_ruins",
      title: "Ecos de Civilizaciones Perdidas",
      description:
        "Unas ruinas antiguas han sido descubiertas. Explorarlas podría revelar secretos sobre quienes habitaron estas tierras antes.",
      loreText:
        "En las piedras antiguas yacen grabados los sueños y lágrimas de civilizaciones que una vez florecieron bajo estos mismos cielos. Cada piedra tallada es una ventana al pasado, cada símbolo una historia esperando ser descifrada.",
      category: "exploration",
      difficulty: "hard",
      status: "not_started",
      version: 0,

      objectives: [
        {
          id: "find_ruins_entrance",
          type: "reach_location",
          description: "Encuentra la entrada a las ruinas antiguas",
          targetLocation: { x: 1200, y: 600, radius: 30 },
          isCompleted: false,
          isOptional: false,
          hints: [
            "Las ruinas están marcadas por pilares de piedra tallada",
            "Busca símbolos antiguos en las rocas",
            "La entrada está orientada hacia el este",
          ],
        },
        {
          id: "decipher_inscriptions",
          type: "complete_activity",
          description: "Descifra las inscripciones de las paredes",
          target: "studying",
          isCompleted: false,
          isOptional: false,
        },
        {
          id: "find_artifact",
          type: "find_item",
          description: "Encuentra el artefacto guardián de las ruinas",
          target: "ancient_artifact",
          isCompleted: false,
          isOptional: false,
        },
        {
          id: "survive_trial",
          type: "survive_time",
          description: "Supera la prueba de los antiguos (opcional)",
          requiredAmount: 600,
          currentAmount: 0,
          isCompleted: false,
          isOptional: true,
        },
      ],

      requirements: [
        { type: "stats_threshold", statsRequired: { energy: 50, courage: 40 } },
      ],
      isRepeatable: false,
      timeLimit: 3600,

      dialogues: [
        {
          stage: "intro",
          speaker: "narrator",
          text: "Las piedras milenarias emergen de la tierra como dientes de gigantes dormidos. Cada grieta cuenta una historia, cada símbolo guarda un secreto.",
        },
        {
          stage: "progress",
          speaker: "isa",
          text: "Estos símbolos... hablan de un amor que trascendió la muerte. Una civilización que entendía la resonancia entre almas.",
          conditions: { objectiveCompleted: "decipher_inscriptions" },
        },
        {
          stage: "completion",
          speaker: "stev",
          text: "El artefacto pulsa con poder ancestral. Siento que los antiguos nos han juzgado dignos de su sabiduría.",
        },
      ],

      introText:
        "Los ecos del pasado resuenan en piedras que han resistido el paso de milenios.",
      progressTexts: [
        "Las ruinas revelan sus secretos lentamente",
        "Los símbolos antiguos cobran significado",
        "El poder ancestral despierta a tu presencia",
      ],
      completionText:
        "Los antiguos han reconocido la pureza de vuestra conexión. Su sabiduría ahora vive en vosotros.",
      failureText:
        "Las ruinas se sellan de nuevo, esperando a quienes sean más dignos de sus secretos.",

      rewards: [
        {
          type: "stats_boost",
          statsBoost: { creativity: 35, resonance: 25, energy: -20 },
          description: "Sabiduría ancestral obtenida de las ruinas",
        },
        {
          type: "title",
          title: "Heredero de los Antiguos",
          description:
            "Título otorgado a quien descifra los secretos ancestrales",
        },
        {
          type: "unlock_feature",
          unlockId: "ancient_knowledge",
          description: "Desbloqueado: Conocimiento Ancestral",
        },
        {
          type: "experience",
          amount: 400,
          description: "Experiencia arqueológica y mística",
        },
      ],

      estimatedDuration: 45,
      tags: ["exploration", "ancient", "mystery", "challenge"],
      isHidden: false,
    },
  ];

  /**
   * Obtiene todas las misiones disponibles en el catálogo.
   * @returns Una copia del array de misiones.
   */
  public static getAllQuests(): Quest[] {
    return [...this.quests];
  }

  /**
   * Busca una misión por su ID.
   * @param questId ID único de la misión.
   * @returns La misión encontrada o null si no existe.
   */
  public static getQuestById(questId: string): Quest | null {
    return this.quests.find((quest) => quest.id === questId) || null;
  }

  /**
   * Filtra las misiones por categoría.
   * @param category Categoría de la misión (ej. 'main_story', 'side_quest').
   * @returns Array de misiones que coinciden con la categoría.
   */
  public static getQuestsByCategory(category: string): Quest[] {
    return this.quests.filter((quest) => quest.category === category);
  }

  /**
   * Filtra las misiones por dificultad.
   * @param difficulty Dificultad de la misión (ej. 'easy', 'medium', 'hard').
   * @returns Array de misiones que coinciden con la dificultad.
   */
  public static getQuestsByDifficulty(difficulty: string): Quest[] {
    return this.quests.filter((quest) => quest.difficulty === difficulty);
  }

  /**
   * Busca misiones que contengan al menos uno de los tags proporcionados.
   * @param tags Array de tags a buscar.
   * @returns Array de misiones que tienen alguno de los tags.
   */
  public static getQuestsByTags(tags: string[]): Quest[] {
    return this.quests.filter((quest) =>
      tags.some((tag) => quest.tags?.includes(tag)),
    );
  }

  /**
   * Obtiene todas las misiones de la historia principal, ordenadas por ID.
   * @returns Array de misiones de historia principal ordenadas.
   */
  public static getMainStoryQuests(): Quest[] {
    return this.quests
      .filter((quest) => quest.category === "main_story")
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Obtiene todas las misiones que son repetibles.
   * @returns Array de misiones repetibles.
   */
  public static getRepeatableQuests(): Quest[] {
    return this.quests.filter((quest) => quest.isRepeatable);
  }

  /**
   * Busca misiones cuyo título, descripción, lore o tags coincidan con el término de búsqueda.
   * @param searchTerm Término a buscar (case-insensitive).
   * @returns Array de misiones que coinciden con la búsqueda.
   */
  public static searchQuests(searchTerm: string): Quest[] {
    const term = searchTerm.toLowerCase();
    return this.quests.filter(
      (quest) =>
        quest.title.toLowerCase().includes(term) ||
        quest.description.toLowerCase().includes(term) ||
        quest.loreText?.toLowerCase().includes(term) ||
        quest.tags?.some((tag) => tag.toLowerCase().includes(term)),
    );
  }
}
