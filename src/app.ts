import knex, { migrate, seed } from "#postgres/knex.js";
import { fetchBoxTariffs } from "#services/wb-api.js";
import { saveTariffs } from "#services/tariffs.js";
import log4js from "log4js";

const logger = log4js.getLogger("app");
log4js.configure({
    appenders: { console: { type: "console" } },
    categories: { default: { appenders: ["console"], level: "info" } },
});

await migrate.latest();
await seed.run();

logger.info("Fetching tariffs from WB API...");
try {
    const data = await fetchBoxTariffs();
    await saveTariffs(data);
    logger.info("Tariffs saved successfully");
} catch (err) {
    logger.error("Failed to fetch/save tariffs:", err);
}

await knex.destroy();