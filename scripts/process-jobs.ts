#!/usr/bin/env tsx

/**
 * Script pour traiter les jobs en local de manière continue
 * Usage: pnpm jobs:dev
 */

const PROCESS_INTERVAL = 5000; // 5 secondes
const API_URL = "http://localhost:3000/api/cron/process-jobs";

console.log("🚀 Job processor démarré en mode développement");
console.log(`⏱️  Intervalle: ${PROCESS_INTERVAL}ms`);
console.log(`🔗 Endpoint: ${API_URL}\n`);

async function processJobs() {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `❌ Erreur HTTP: ${response.status} ${response.statusText}`
      );
      return;
    }

    const data = await response.json();

    if (data.success) {
      const { completed, failed, total } = data.data;

      if (total > 0) {
        console.log(
          `✅ ${new Date().toLocaleTimeString()} - Traité: ${completed} réussi, ${failed} échec (total: ${total})`
        );
      } else {
        // Ne rien afficher si aucun job
        process.stdout.write(".");
      }
    }
  } catch (error) {
    console.error(
      `❌ ${new Date().toLocaleTimeString()} - Erreur:`,
      error instanceof Error ? error.message : error
    );
  }
}

// Traiter immédiatement au démarrage
processJobs();

// Puis à intervalle régulier
setInterval(processJobs, PROCESS_INTERVAL);

// Gérer l'arrêt propre
process.on("SIGINT", () => {
  console.log("\n\n👋 Arrêt du job processor");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Arrêt du job processor");
  process.exit(0);
});
