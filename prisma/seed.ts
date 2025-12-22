import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

// Configuration de la seed
const CONFIG = {
  // Organisation et utilisateurs
  NUM_ORGANIZATIONS: 3,
  USERS_PER_ORG: 5,

  // Produits/Services
  PRODUCTS_PER_WEBSITE: 120, // ~360 produits au total (3 orgs)

  // Concurrents
  COMPETITORS_PER_WEBSITE: 50, // ~150 concurrents au total

  // Historique SERP (1 an)
  SERP_HISTORY_DAYS: 365,
  SERP_CHECKS_PER_WEEK: 3, // ~156 checks par produit/an

  // Analyses de pages
  PAGE_ANALYSES_PER_WEBSITE: 100,
  COMPETITOR_PAGE_ANALYSES_PER_COMPETITOR: 10,

  // Rapports IA
  AI_REPORTS_PER_WEBSITE: 24, // 2 par mois sur 1 an

  // Suggestions IA
  SUGGESTIONS_PER_PRODUCT: 5,
};

// Données réalistes
const INDUSTRIES = [
  {
    name: "E-commerce Mode",
    domain: "fashionstore.fr",
    products: [
      "Robes été",
      "Pantalons chino",
      "Chemises lin",
      "Vestes cuir",
      "Pulls cachemire",
      "Jupes plissées",
      "T-shirts bio",
      "Shorts denim",
      "Manteaux hiver",
      "Blazers femme",
      "Jeans slim",
      "Cardigans",
      "Débardeurs",
      "Combinaisons",
      "Salopettes",
      "Leggins sport",
      "Sweats capuche",
      "Pyjamas soie",
      "Maillots bain",
      "Lingerie dentelle",
      "Chaussettes bambou",
      "Écharpes cachemire",
      "Bonnets laine",
      "Gants cuir",
      "Ceintures",
      "Sacs à main",
      "Portefeuilles",
      "Bijoux fantaisie",
      "Montres femme",
      "Lunettes soleil",
    ],
    keywords: [
      "mode",
      "vêtements",
      "fashion",
      "tendance",
      "style",
      "prêt-à-porter",
      "collection",
      "boutique",
    ],
    competitors: [
      "zalando.fr",
      "asos.fr",
      "hm.com",
      "zara.com",
      "mango.com",
      "laRedoute.fr",
      "galerieslafayette.com",
      "printemps.com",
      "uniqlo.com",
      "kiabi.com",
      "camaieu.fr",
      "promod.fr",
      "etam.com",
      "pimkie.fr",
      "jennyfer.com",
      "cache-cache.fr",
      "grain-de-malice.fr",
      "breal.net",
      "armand-thiery.fr",
      "celio.com",
    ],
  },
  {
    name: "Agence Web",
    domain: "webagency-pro.com",
    products: [
      "Création site vitrine",
      "Développement e-commerce",
      "Application mobile",
      "Refonte site web",
      "SEO technique",
      "SEO local",
      "Audit SEO",
      "Stratégie netlinking",
      "Rédaction SEO",
      "Google Ads",
      "Facebook Ads",
      "LinkedIn Ads",
      "Publicité programmatique",
      "Retargeting",
      "Community management",
      "Stratégie social media",
      "Création contenu",
      "Vidéo marketing",
      "Email marketing",
      "Marketing automation",
      "CRM intégration",
      "Analytics avancé",
      "UX design",
      "UI design",
      "Design system",
      "Prototypage",
      "Tests utilisateurs",
      "Maintenance web",
      "Hébergement",
      "Sécurité web",
      "Performance web",
      "Accessibilité",
    ],
    keywords: [
      "agence web",
      "création site",
      "développement",
      "SEO",
      "digital",
      "marketing",
      "design",
    ],
    competitors: [
      "webflow.com",
      "wix.com",
      "squarespace.com",
      "hubspot.com",
      "semrush.com",
      "ahrefs.com",
      "moz.com",
      "searchmetrics.com",
      "brightedge.com",
      "conductor.com",
      "publicis.fr",
      "havas.com",
      "dentsu.com",
      "ogilvy.com",
      "wpp.com",
      "accenture-interactive.com",
      "deloitte-digital.com",
      "capgemini.com",
      "atos.net",
      "soprasteria.com",
    ],
  },
  {
    name: "SaaS B2B",
    domain: "saas-solutions.io",
    products: [
      "CRM entreprise",
      "ERP cloud",
      "Gestion projet",
      "Facturation en ligne",
      "Comptabilité SaaS",
      "GED document",
      "Signature électronique",
      "Workflow automation",
      "RH management",
      "Paie cloud",
      "Ticketing support",
      "Live chat",
      "Base connaissances",
      "Feedback client",
      "NPS surveys",
      "Analytics dashboard",
      "Business intelligence",
      "Data visualization",
      "Reporting automatisé",
      "API management",
      "Integration platform",
      "ETL cloud",
      "Data warehouse",
      "Machine learning",
      "Collaboration équipe",
      "Visioconférence",
      "Messagerie entreprise",
      "Intranet moderne",
      "Sécurité endpoint",
      "IAM solution",
      "SIEM cloud",
      "Backup cloud",
      "Disaster recovery",
    ],
    keywords: [
      "SaaS",
      "cloud",
      "B2B",
      "entreprise",
      "solution",
      "logiciel",
      "plateforme",
      "automatisation",
    ],
    competitors: [
      "salesforce.com",
      "hubspot.com",
      "zoho.com",
      "freshworks.com",
      "pipedrive.com",
      "monday.com",
      "asana.com",
      "notion.so",
      "clickup.com",
      "trello.com",
      "slack.com",
      "teams.microsoft.com",
      "zoom.us",
      "webex.com",
      "meet.google.com",
      "zendesk.com",
      "intercom.com",
      "drift.com",
      "crisp.chat",
      "freshdesk.com",
    ],
  },
];

const SEARCH_ENGINES = ["google", "bing"];
const DEVICES = ["desktop", "mobile"];
const COUNTRIES = ["FR", "BE", "CH", "CA"];

const SUGGESTION_TYPES = ["content", "keyword", "technical", "backlink"];
const SUGGESTION_PRIORITIES = [1, 2, 3, 4, 5];
const SUGGESTION_STATUSES = ["pending", "accepted", "dismissed"];

const AI_REPORT_TYPES = [
  "periodic_recap",
  "competitor_analysis",
  "initial_analysis",
];

// Génération de données aléatoires
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(startDays: number, endDays: number = 0): Date {
  const now = new Date();
  const start = new Date(now.getTime() - startDays * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() - endDays * 24 * 60 * 60 * 1000);
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateKeywords(
  baseKeywords: string[],
  productName: string
): string[] {
  const productWords = productName.toLowerCase().split(" ");
  const allKeywords = [...baseKeywords, ...productWords];
  const shuffled = allKeywords.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, randomInt(3, 8));
}

function generateSearchQuery(productName: string, keywords: string[]): string {
  const templates = [
    `${productName}`,
    `${productName} pas cher`,
    `acheter ${productName}`,
    `meilleur ${productName}`,
    `${productName} en ligne`,
    `${productName} ${randomElement(keywords)}`,
    `comparatif ${productName}`,
    `avis ${productName}`,
    `${productName} livraison rapide`,
    `${productName} France`,
  ];
  return randomElement(templates);
}

function generatePageTitle(productName: string): string {
  const templates = [
    `${productName} - Découvrez notre sélection`,
    `${productName} | Meilleurs prix garantis`,
    `Achetez ${productName} en ligne`,
    `${productName} - Livraison gratuite`,
    `${productName} de qualité supérieure`,
  ];
  return randomElement(templates);
}

function generateMetaDescription(productName: string): string {
  const templates = [
    `Découvrez notre gamme de ${productName}. Qualité premium, prix compétitifs. Livraison en 24h.`,
    `${productName} - Large sélection disponible. Satisfait ou remboursé. Commandez maintenant !`,
    `Trouvez le ${productName} idéal parmi notre collection. Conseils d'experts et service client premium.`,
    `Achetez ${productName} au meilleur prix. Plus de 1000 avis clients. Retours gratuits sous 30 jours.`,
  ];
  return randomElement(templates);
}

function generateHeadings(productName: string): object {
  return {
    h1: [`${productName}`],
    h2: [
      `Pourquoi choisir notre ${productName}`,
      `Caractéristiques du ${productName}`,
      `Avis clients`,
      `Questions fréquentes`,
    ],
    h3: [
      "Livraison et retours",
      "Garantie qualité",
      "Guide des tailles",
      "Entretien et conseils",
    ],
  };
}

function generateKeywordsJson(
  productName: string,
  baseKeywords: string[]
): object {
  const keywords: Record<string, number> = {};
  const allWords = [...productName.toLowerCase().split(" "), ...baseKeywords];

  allWords.forEach((word) => {
    keywords[word] = randomInt(5, 50);
  });

  // Ajouter des mots-clés supplémentaires
  const additionalKeywords = [
    "qualité",
    "prix",
    "livraison",
    "avis",
    "comparatif",
    "meilleur",
    "achat",
    "promo",
  ];
  additionalKeywords.forEach((kw) => {
    if (Math.random() > 0.5) {
      keywords[kw] = randomInt(1, 20);
    }
  });

  return keywords;
}

function generateAIReportContent(
  type: string,
  websiteName: string
): { title: string; content: string } {
  const templates: Record<string, { title: string; content: string }> = {
    periodic_recap: {
      title: `Rapport mensuel SEO - ${new Date().toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      })}`,
      content: `## Résumé du mois\n\n### Performance globale\n- **Visibilité SEO**: +${randomInt(
        2,
        15
      )}% par rapport au mois précédent\n- **Positions moyennes**: ${randomFloat(
        5,
        25
      ).toFixed(1)}\n- **Trafic organique estimé**: ${randomInt(
        10000,
        100000
      ).toLocaleString()} visites\n\n### Top 5 des progressions\n1. Mot-clé A: +${randomInt(
        5,
        30
      )} positions\n2. Mot-clé B: +${randomInt(
        3,
        20
      )} positions\n3. Mot-clé C: +${randomInt(
        2,
        15
      )} positions\n4. Mot-clé D: +${randomInt(
        1,
        10
      )} positions\n5. Mot-clé E: +${randomInt(
        1,
        8
      )} positions\n\n### Actions recommandées\n- Optimiser les pages sous-performantes\n- Renforcer le maillage interne\n- Créer du contenu sur les opportunités identifiées`,
    },
    competitor_analysis: {
      title: `Analyse concurrentielle - ${websiteName}`,
      content: `## Analyse des concurrents\n\n### Synthèse\n${randomInt(
        5,
        15
      )} nouveaux concurrents identifiés ce mois.\n\n### Menaces principales\n- Concurrent A gagne du terrain sur les mots-clés principaux\n- Nouveau entrant avec stratégie agressive de contenu\n\n### Opportunités\n- ${randomInt(
        10,
        50
      )} mots-clés où les concurrents sont absents\n- Gaps de contenu identifiés sur ${randomInt(
        5,
        20
      )} thématiques\n\n### Stratégies concurrentes observées\n- Focus sur le content marketing\n- Investissement SEA important\n- Développement présence sociale`,
    },
    initial_analysis: {
      title: `Audit SEO initial - ${websiteName}`,
      content: `## Audit SEO complet\n\n### État des lieux\n- **Score SEO global**: ${randomInt(
        40,
        85
      )}/100\n- **Pages indexées**: ${randomInt(
        50,
        500
      )}\n- **Backlinks**: ${randomInt(
        100,
        5000
      )}\n\n### Points forts\n- Structure technique solide\n- Temps de chargement correct\n- Bon maillage interne\n\n### Points d'amélioration\n- Optimisation des balises title\n- Meta descriptions manquantes (${randomInt(
        10,
        40
      )}%)\n- Images sans alt text\n\n### Plan d'action prioritaire\n1. Corriger les erreurs techniques critiques\n2. Optimiser les pages principales\n3. Développer la stratégie de contenu`,
    },
  };

  return templates[type] || templates.periodic_recap;
}

function generateAISuggestion(
  type: string,
  productName: string
): { title: string; content: string } {
  const templates: Record<string, { title: string; content: string }[]> = {
    content: [
      {
        title: `Créer un guide d'achat pour ${productName}`,
        content: `Rédiger un guide complet de 2000+ mots couvrant les critères de choix, les différentes gammes de prix, et des conseils d'experts pour aider les utilisateurs à choisir le bon ${productName}.`,
      },
      {
        title: `Ajouter une FAQ sur ${productName}`,
        content: `Créer une section FAQ avec les 10 questions les plus fréquentes des clients concernant ${productName}. Utiliser le schema markup FAQ pour améliorer la visibilité SERP.`,
      },
      {
        title: `Enrichir la description de ${productName}`,
        content: `La page actuelle manque de contenu. Ajouter au moins 500 mots de contenu unique décrivant les avantages, caractéristiques et cas d'usage de ${productName}.`,
      },
    ],
    keyword: [
      {
        title: `Cibler "${productName} pas cher"`,
        content: `Ce mot-clé longue traîne a un volume de ${randomInt(
          500,
          5000
        )} recherches/mois avec une difficulté faible. Créer une page dédiée ou optimiser la page existante.`,
      },
      {
        title: `Opportunité: "meilleur ${productName}"`,
        content: `Mot-clé à fort intent d'achat. Volume: ${randomInt(
          1000,
          10000
        )}/mois. Créer un comparatif ou un guide "Top 10" pour capturer ce trafic.`,
      },
      {
        title: `Optimiser pour "avis ${productName}"`,
        content: `Intégrer des avis clients et un système de notation pour apparaître sur ces requêtes informationnelles à fort potentiel de conversion.`,
      },
    ],
    technical: [
      {
        title: `Améliorer le temps de chargement`,
        content: `La page ${productName} charge en ${randomFloat(3, 8).toFixed(
          1
        )}s. Optimiser les images, activer la compression, et implémenter le lazy loading pour passer sous les 2s.`,
      },
      {
        title: `Corriger les données structurées`,
        content: `Le schema Product est incomplet. Ajouter les propriétés: aggregateRating, offers, brand pour améliorer l'affichage dans les SERP.`,
      },
      {
        title: `Optimiser pour mobile`,
        content: `Score mobile: ${randomInt(
          50,
          75
        )}/100. Améliorer la taille des éléments cliquables et réduire le CLS pour une meilleure expérience mobile.`,
      },
    ],
    backlink: [
      {
        title: `Opportunité de backlink - Blog partenaire`,
        content: `Le blog ${randomElement([
          "expert-mode.fr",
          "conseils-digital.com",
          "guide-achat.net",
        ])} accepte les articles invités. Proposer un article sur ${productName} avec lien retour.`,
      },
      {
        title: `Récupérer les mentions non liées`,
        content: `${randomInt(
          3,
          15
        )} mentions de votre marque sans lien trouvées. Contacter les webmasters pour transformer ces mentions en backlinks.`,
      },
      {
        title: `Stratégie de linkbaiting`,
        content: `Créer une étude originale ou une infographie sur ${productName} pour attirer naturellement des backlinks de qualité.`,
      },
    ],
  };

  const suggestions = templates[type] || templates.content;
  return randomElement(suggestions);
}

async function seed() {
  console.log("🌱 Démarrage de la seed...\n");

  // Nettoyer la base de données
  console.log("🧹 Nettoyage de la base de données...");
  await prisma.aISuggestion.deleteMany();
  await prisma.aIReport.deleteMany();
  await prisma.serpResult.deleteMany();
  await prisma.competitorPageAnalysis.deleteMany();
  await prisma.pageAnalysis.deleteMany();
  await prisma.analysisJob.deleteMany();
  await prisma.product.deleteMany();
  await prisma.competitor.deleteMany();
  await prisma.website.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.userAuthCode.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ Base de données nettoyée\n");

  let totalProducts = 0;
  let totalCompetitors = 0;
  let totalSerpResults = 0;
  let totalPageAnalyses = 0;
  let totalAIReports = 0;
  let totalSuggestions = 0;

  // Créer les organisations
  for (let orgIndex = 0; orgIndex < INDUSTRIES.length; orgIndex++) {
    const industry = INDUSTRIES[orgIndex];
    console.log(`\n📁 Création de l'organisation: ${industry.name}`);

    // Créer l'organisation
    const organization = await prisma.organization.create({
      data: {
        name: industry.name,
        slug: generateSlug(industry.name),
        serpFrequencyHours: 24,
        competitorFrequencyHours: 168,
        aiReportFrequencyHours: 720,
      },
    });

    // Créer les utilisateurs et membres
    console.log(`  👥 Création de ${CONFIG.USERS_PER_ORG} utilisateurs...`);
    for (let userIndex = 0; userIndex < CONFIG.USERS_PER_ORG; userIndex++) {
      const user = await prisma.user.create({
        data: {
          email: `user${userIndex + 1}@${industry.domain}`,
          name: `Utilisateur ${userIndex + 1}`,
          emailVerified: new Date(),
        },
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: userIndex === 0 ? "owner" : userIndex < 3 ? "admin" : "member",
        },
      });
    }

    // Créer le website
    const website = await prisma.website.create({
      data: {
        organizationId: organization.id,
        url: `https://www.${industry.domain}`,
        name: industry.name,
        status: "active",
        sitemapUrl: `https://www.${industry.domain}/sitemap.xml`,
        lastSitemapFetch: new Date(),
      },
    });

    // Créer les produits
    console.log(`  📦 Création de ${CONFIG.PRODUCTS_PER_WEBSITE} produits...`);
    const products: { id: string; name: string; keywords: string[] }[] = [];

    for (let i = 0; i < CONFIG.PRODUCTS_PER_WEBSITE; i++) {
      // Utiliser les produits prédéfinis puis générer des variations
      const baseProduct = industry.products[i % industry.products.length];
      const productName =
        i < industry.products.length
          ? baseProduct
          : `${baseProduct} ${
              ["Premium", "Basic", "Pro", "Lite", "Plus", "Max"][
                Math.floor(i / industry.products.length) % 6
              ]
            }`;

      const keywords = generateKeywords(industry.keywords, productName);

      const product = await prisma.product.create({
        data: {
          websiteId: website.id,
          name: productName,
          description: `Description complète de ${productName}. Produit de haute qualité avec les meilleures caractéristiques du marché.`,
          keywords: keywords,
          sourceUrl: `https://www.${industry.domain}/produits/${generateSlug(
            productName
          )}`,
          confidence: randomFloat(0.7, 0.99),
          isActive: Math.random() > 0.1,
        },
      });

      products.push({ id: product.id, name: productName, keywords });
      totalProducts++;
    }

    // Créer les concurrents
    console.log(
      `  🏢 Création de ${CONFIG.COMPETITORS_PER_WEBSITE} concurrents...`
    );
    const competitors: { id: string; url: string; name: string }[] = [];

    for (let i = 0; i < CONFIG.COMPETITORS_PER_WEBSITE; i++) {
      const competitorDomain =
        i < industry.competitors.length
          ? industry.competitors[i]
          : `concurrent-${i + 1}-${generateSlug(industry.name)}.com`;

      const competitor = await prisma.competitor.create({
        data: {
          websiteId: website.id,
          url: `https://www.${competitorDomain}`,
          name: competitorDomain
            .replace(".com", "")
            .replace(".fr", "")
            .replace(".io", ""),
          description: `Concurrent dans le secteur ${industry.name}`,
          isActive: Math.random() > 0.15,
        },
      });

      competitors.push({
        id: competitor.id,
        url: competitor.url,
        name: competitor.name,
      });
      totalCompetitors++;
    }

    // Créer l'historique SERP (1 an)
    console.log(
      `  📊 Création de l'historique SERP (${CONFIG.SERP_HISTORY_DAYS} jours)...`
    );
    const serpBatchSize = 500;
    let serpBatch: {
      productId: string | null;
      competitorId: string | null;
      query: string;
      position: number | null;
      url: string | null;
      title: string | null;
      snippet: string | null;
      searchEngine: string;
      country: string;
      device: string;
      createdAt: Date;
    }[] = [];

    // Calculer le nombre de checks SERP par produit
    const totalWeeks = Math.floor(CONFIG.SERP_HISTORY_DAYS / 7);
    const checksPerProduct = totalWeeks * CONFIG.SERP_CHECKS_PER_WEEK;

    for (const product of products) {
      // Position initiale pour ce produit (pour simuler une évolution)
      let basePosition = randomInt(10, 80);

      for (let checkIndex = 0; checkIndex < checksPerProduct; checkIndex++) {
        const daysAgo = Math.floor(
          (checkIndex / checksPerProduct) * CONFIG.SERP_HISTORY_DAYS
        );
        const createdAt = randomDate(
          CONFIG.SERP_HISTORY_DAYS - daysAgo,
          CONFIG.SERP_HISTORY_DAYS - daysAgo - 7
        );

        // Simuler une amélioration progressive du positionnement
        const progressFactor = checkIndex / checksPerProduct;
        const positionVariation = randomInt(-5, 5);
        const trendImprovement = Math.floor(progressFactor * randomInt(5, 20));
        const position = Math.max(
          1,
          Math.min(100, basePosition - trendImprovement + positionVariation)
        );

        const query = generateSearchQuery(product.name, product.keywords);
        const searchEngine = randomElement(SEARCH_ENGINES);
        const device = randomElement(DEVICES);
        const country = randomElement(COUNTRIES);

        serpBatch.push({
          productId: product.id,
          competitorId: null,
          query,
          position: Math.random() > 0.1 ? position : null, // 10% non trouvé
          url:
            position <= 10
              ? `https://www.${industry.domain}/produits/${generateSlug(
                  product.name
                )}`
              : null,
          title: position <= 10 ? generatePageTitle(product.name) : null,
          snippet:
            position <= 10 ? generateMetaDescription(product.name) : null,
          searchEngine,
          country,
          device,
          createdAt,
        });

        // Insérer par batch
        if (serpBatch.length >= serpBatchSize) {
          await prisma.serpResult.createMany({ data: serpBatch });
          totalSerpResults += serpBatch.length;
          serpBatch = [];
        }
      }
    }

    // SERP pour les concurrents - suivi de leurs positions sur les mêmes mots-clés
    console.log(`    📈 Génération des positions concurrents...`);

    // Pour chaque concurrent, générer un historique de positions
    for (const competitor of competitors) {
      // Chaque concurrent a une "force SEO" de base qui influence ses positions
      const competitorStrength = randomFloat(0.3, 1.2); // < 1 = plus faible, > 1 = plus fort

      // Suivre les positions du concurrent sur une sélection de produits/mots-clés
      const trackedProducts = products.slice(0, Math.min(30, products.length)); // Top 30 produits suivis
      const checksPerKeyword = Math.floor(
        (totalWeeks * CONFIG.SERP_CHECKS_PER_WEEK) / 2
      ); // ~78 checks par keyword/an

      for (const product of trackedProducts) {
        // Position de base du concurrent pour ce mot-clé
        const baseCompetitorPosition = Math.floor(
          randomInt(5, 60) / competitorStrength
        );

        for (let checkIndex = 0; checkIndex < checksPerKeyword; checkIndex++) {
          const daysAgo = Math.floor(
            (checkIndex / checksPerKeyword) * CONFIG.SERP_HISTORY_DAYS
          );
          const createdAt = randomDate(
            CONFIG.SERP_HISTORY_DAYS - daysAgo,
            CONFIG.SERP_HISTORY_DAYS - daysAgo - 7
          );

          // Variation de position avec tendance (certains concurrents s'améliorent, d'autres déclinent)
          const trend =
            (Math.random() > 0.5 ? -1 : 1) *
            (checkIndex / checksPerKeyword) *
            randomInt(0, 10);
          const variation = randomInt(-3, 3);
          const position = Math.max(
            1,
            Math.min(
              100,
              Math.floor(baseCompetitorPosition + trend + variation)
            )
          );

          const query = generateSearchQuery(product.name, product.keywords);

          serpBatch.push({
            productId: null,
            competitorId: competitor.id,
            query,
            position: Math.random() > 0.05 ? position : null, // 5% non trouvé
            url: `${competitor.url}/${generateSlug(product.name)}`,
            title: `${product.name} - ${competitor.name}`,
            snippet: `Découvrez ${product.name} chez ${competitor.name}. Large sélection disponible.`,
            searchEngine: randomElement(SEARCH_ENGINES),
            country: randomElement(COUNTRIES),
            device: randomElement(DEVICES),
            createdAt,
          });

          if (serpBatch.length >= serpBatchSize) {
            await prisma.serpResult.createMany({ data: serpBatch });
            totalSerpResults += serpBatch.length;
            serpBatch = [];
          }
        }
      }
    }

    // Insérer le reste
    if (serpBatch.length > 0) {
      await prisma.serpResult.createMany({ data: serpBatch });
      totalSerpResults += serpBatch.length;
    }

    console.log(`    ✅ ${totalSerpResults} résultats SERP créés au total`);

    // Créer les analyses de pages
    console.log(
      `  📄 Création de ${CONFIG.PAGE_ANALYSES_PER_WEBSITE} analyses de pages...`
    );
    const pageAnalysesBatch = [];

    for (let i = 0; i < CONFIG.PAGE_ANALYSES_PER_WEBSITE; i++) {
      const product = products[i % products.length];
      pageAnalysesBatch.push({
        websiteId: website.id,
        url: `https://www.${industry.domain}/produits/${generateSlug(
          product.name
        )}`,
        title: generatePageTitle(product.name),
        metaDescription: generateMetaDescription(product.name),
        headings: generateHeadings(product.name),
        keywords: generateKeywordsJson(product.name, industry.keywords),
        wordCount: randomInt(500, 3000),
        createdAt: randomDate(CONFIG.SERP_HISTORY_DAYS, 0),
      });
    }

    await prisma.pageAnalysis.createMany({ data: pageAnalysesBatch });
    totalPageAnalyses += pageAnalysesBatch.length;

    // Créer les analyses de pages concurrentes
    console.log(`  📄 Création des analyses de pages concurrentes...`);
    const competitorPagesBatch = [];

    for (const competitor of competitors) {
      for (let i = 0; i < CONFIG.COMPETITOR_PAGE_ANALYSES_PER_COMPETITOR; i++) {
        const product = randomElement(products);
        competitorPagesBatch.push({
          competitorId: competitor.id,
          url: `${competitor.url}/${generateSlug(product.name)}`,
          title: `${product.name} | ${competitor.name}`,
          metaDescription: `${product.name} disponible chez ${competitor.name}. Livraison rapide et prix bas.`,
          headings: generateHeadings(product.name),
          keywords: generateKeywordsJson(product.name, industry.keywords),
          wordCount: randomInt(400, 2500),
          createdAt: randomDate(CONFIG.SERP_HISTORY_DAYS, 0),
        });
      }
    }

    await prisma.competitorPageAnalysis.createMany({
      data: competitorPagesBatch,
    });
    totalPageAnalyses += competitorPagesBatch.length;

    // Créer les rapports IA
    console.log(
      `  🤖 Création de ${CONFIG.AI_REPORTS_PER_WEBSITE} rapports IA...`
    );
    const aiReportsBatch = [];

    for (let i = 0; i < CONFIG.AI_REPORTS_PER_WEBSITE; i++) {
      const type = randomElement(AI_REPORT_TYPES);
      const reportContent = generateAIReportContent(type, industry.name);
      const daysAgo = Math.floor(
        (i / CONFIG.AI_REPORTS_PER_WEBSITE) * CONFIG.SERP_HISTORY_DAYS
      );

      aiReportsBatch.push({
        websiteId: website.id,
        type,
        title: reportContent.title,
        content: reportContent.content,
        metadata: {
          generatedBy: "mistral-large",
          processingTime: randomInt(5, 30),
          dataPoints: randomInt(100, 1000),
        },
        createdAt: randomDate(daysAgo + 1, daysAgo),
      });
    }

    await prisma.aIReport.createMany({ data: aiReportsBatch });
    totalAIReports += aiReportsBatch.length;

    // Créer les suggestions IA
    console.log(`  💡 Création des suggestions IA...`);
    const suggestionsBatch = [];

    for (const product of products) {
      for (let i = 0; i < CONFIG.SUGGESTIONS_PER_PRODUCT; i++) {
        const type = randomElement(SUGGESTION_TYPES);
        const suggestion = generateAISuggestion(type, product.name);

        suggestionsBatch.push({
          productId: product.id,
          type,
          title: suggestion.title,
          content: suggestion.content,
          priority: randomElement(SUGGESTION_PRIORITIES),
          status: randomElement(SUGGESTION_STATUSES),
          createdAt: randomDate(90, 0), // 90 derniers jours
        });
      }
    }

    await prisma.aISuggestion.createMany({ data: suggestionsBatch });
    totalSuggestions += suggestionsBatch.length;

    console.log(`  ✅ Organisation "${industry.name}" créée avec succès`);
  }

  // Résumé final
  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ DE LA SEED");
  console.log("=".repeat(60));
  console.log(`  📁 Organisations:           ${INDUSTRIES.length}`);
  console.log(
    `  👥 Utilisateurs:            ${INDUSTRIES.length * CONFIG.USERS_PER_ORG}`
  );
  console.log(`  🌐 Websites:                ${INDUSTRIES.length}`);
  console.log(`  📦 Produits/Services:       ${totalProducts}`);
  console.log(`  🏢 Concurrents:             ${totalCompetitors}`);
  console.log(
    `  📊 Résultats SERP:          ${totalSerpResults.toLocaleString()}`
  );
  console.log(
    `  📄 Analyses de pages:       ${totalPageAnalyses.toLocaleString()}`
  );
  console.log(`  🤖 Rapports IA:             ${totalAIReports}`);
  console.log(
    `  💡 Suggestions IA:          ${totalSuggestions.toLocaleString()}`
  );
  console.log("=".repeat(60));
  console.log("\n✅ Seed terminée avec succès!");
}

seed()
  .catch((e) => {
    console.error("❌ Erreur lors de la seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
