#!/usr/bin/env tsx

/**
 * Script pour traiter les jobs en local de manière continue
 * Usage: pnpm jobs:dev
 */

const PROCESS_INTERVAL = 5000; // 5 secondes
const API_URL = "http://localhost:3000/api/cron/process-jobs";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║       🚀 Job Processor - Mode Développement               ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log(
  `⏱️  Intervalle: ${PROCESS_INTERVAL}ms (${PROCESS_INTERVAL / 1000}s)`
);
console.log(`🔗 Endpoint: ${API_URL}`);
console.log(`📊 Logs détaillés activés\n`);
console.log("Démarrage...\n");

let cycleCount = 0;
let totalJobsProcessed = 0;
let consecutiveEmptyCycles = 0;

async function processJobs() {
  cycleCount++;
  const timestamp = new Date().toLocaleTimeString("fr-FR");

  try {
    const startTime = Date.now();
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      console.error(
        `❌ [${timestamp}] Erreur HTTP: ${response.status} ${response.statusText}`
      );
      return;
    }

    const data = await response.json();

    if (data.success) {
      const { processed, succeeded, failed } = data.data;
      const total = processed || 0;

      if (total > 0) {
        consecutiveEmptyCycles = 0;
        totalJobsProcessed += total;

        console.log("\n" + "─".repeat(60));
        console.log(`⏰ [${timestamp}] Cycle #${cycleCount} (${duration}ms)`);
        console.log(`📦 Jobs traités: ${total}`);
        console.log(`   ✅ Réussis: ${succeeded}`);
        if (failed > 0) {
          console.log(`   ❌ Échecs: ${failed}`);
        }
        console.log(`📊 Total cumulé: ${totalJobsProcessed} jobs traités`);
        console.log("─".repeat(60));
      } else {
        consecutiveEmptyCycles++;

        // Afficher un point toutes les 5 itérations vides
        if (consecutiveEmptyCycles % 5 === 0) {
          process.stdout.write(
            `\r⏳ En attente de jobs... (${consecutiveEmptyCycles} cycles vides, dernier: ${timestamp})`
          );
        }
      }

      // Statistiques toutes les 20 cycles
      if (cycleCount % 20 === 0 && cycleCount > 0) {
        console.log(`\n\n📈 Statistiques (${cycleCount} cycles écoulés):`);
        console.log(`   Total jobs traités: ${totalJobsProcessed}`);
        console.log(
          `   Moyenne: ${(totalJobsProcessed / cycleCount).toFixed(
            2
          )} jobs/cycle`
        );
        console.log(
          `   Temps total: ${(
            (cycleCount * PROCESS_INTERVAL) /
            1000 /
            60
          ).toFixed(1)} minutes\n`
        );
      }
    }
  } catch (error) {
    console.error(
      `\n❌ [${timestamp}] Erreur lors du traitement:`,
      error instanceof Error ? error.message : error
    );

    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error(
        "⚠️  Le serveur Next.js n'est peut-être pas démarré. Lancez 'pnpm dev' dans un autre terminal."
      );
    }
  }
}

// Traiter immédiatement au démarrage
console.log("🔄 Premier cycle de traitement...\n");
processJobs();

// Puis à intervalle régulier
const interval = setInterval(processJobs, PROCESS_INTERVAL);

// Gérer l'arrêt propre
function shutdown() {
  clearInterval(interval);
  console.log(
    "\n\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║       👋 Arrêt du Job Processor                           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`📊 Statistiques finales:`);
  console.log(`   Cycles exécutés: ${cycleCount}`);
  console.log(`   Jobs traités: ${totalJobsProcessed}`);
  console.log(
    `   Durée totale: ${((cycleCount * PROCESS_INTERVAL) / 1000 / 60).toFixed(
      1
    )} minutes\n`
  );
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
