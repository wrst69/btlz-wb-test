import knex, { migrate, seed } from "#postgres/knex.js";
import { updateTariffs } from "#services/tariffs.js";
import cron from "node-cron";
import log4js from "log4js";

const logger = log4js.getLogger("app");
log4js.configure({
    appenders: { console: { type: "console" } },
    categories: { default: { appenders: ["console"], level: "info" } },
});

// Run migrations and seeds
await migrate.latest();
await seed.run();

// Initial fetch on startup
try {
    await updateTariffs();
} catch (err) {
    logger.error("Failed to fetch/save tariffs:", err);
}

// Schedule hourly updates (every hour at :00)
const task = cron.schedule("0 * * * *", async () => {
    try {
        await updateTariffs();
    } catch (err) {
        logger.error("Scheduled tariff update failed:", err);
    }
});

logger.info("Cron scheduled: tariff update every hour");

// Graceful shutdown
function shutdown() {
    logger.info("Shutting down...");
    task.stop();
    knex.destroy().then(() => {
        logger.info("Database connection closed");
        process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);