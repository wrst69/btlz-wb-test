import env from "#config/env/env.js";
import type { WbTariffsBoxResponse } from "#types/tariffs.js";
import log4js from "log4js";

const logger = log4js.getLogger("wb-api");

const WB_BASE_URL = "https://common-api.wildberries.ru";

/**
 * Fetch box tariffs from WB API for a given date.
 * @param date - Date in YYYY-MM-DD format. Defaults to today.
 */
export async function fetchBoxTariffs(date?: string): Promise<WbTariffsBoxResponse> {
    const targetDate = date ?? new Date().toISOString().split("T")[0];
    const url = `${WB_BASE_URL}/api/v1/tariffs/box?date=${targetDate}`;

    logger.info(`Fetching box tariffs for ${targetDate}`);

    const response = await fetch(url, {
        headers: { Authorization: env.WB_API_TOKEN },
    });

    if (!response.ok) {
        throw new Error(`WB API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<WbTariffsBoxResponse>;
}
