import knex from "#postgres/knex.js";
import { fetchBoxTariffs } from "#services/wb-api.js";
import type { BoxTariffRow, WbTariffsBoxResponse } from "#types/tariffs.js";
import log4js from "log4js";

const logger = log4js.getLogger("tariffs");

/** Convert API string value to a number-safe value. WB uses "-" for missing tariffs and comma as decimal separator. */
function toNumeric(value: string): string | null {
    if (value === "-") return null;
    return value.replace(",", ".");
}

/**
 * Map WB API response to DB rows and upsert into box_tariffs table.
 * Uses ON CONFLICT (date, warehouse_name) DO UPDATE to overwrite
 * intra-day fetches while accumulating data per day.
 */
export async function saveTariffs(data: WbTariffsBoxResponse): Promise<void> {
    const { dtNextBox, dtTillMax, warehouseList } = data.response.data;

    if (!warehouseList || warehouseList.length === 0) {
        logger.warn("No warehouse tariffs received from API");
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    const rows: BoxTariffRow[] = warehouseList.map((wh) => ({
        date: today,
        warehouse_name: wh.warehouseName,
        geo_name: wh.geoName,
        box_delivery_base: toNumeric(wh.boxDeliveryBase),
        box_delivery_liter: toNumeric(wh.boxDeliveryLiter),
        box_delivery_coef_expr: toNumeric(wh.boxDeliveryCoefExpr),
        box_delivery_marketplace_base: toNumeric(wh.boxDeliveryMarketplaceBase),
        box_delivery_marketplace_liter: toNumeric(wh.boxDeliveryMarketplaceLiter),
        box_delivery_marketplace_coef_expr: toNumeric(wh.boxDeliveryMarketplaceCoefExpr),
        box_storage_base: toNumeric(wh.boxStorageBase),
        box_storage_liter: toNumeric(wh.boxStorageLiter),
        box_storage_coef_expr: toNumeric(wh.boxStorageCoefExpr),
        dt_next_box: dtNextBox,
        dt_till_max: dtTillMax,
    }));

    await knex("box_tariffs")
        .insert(rows)
        .onConflict(["date", "warehouse_name"])
        .merge({
            ...Object.fromEntries(
                Object.keys(rows[0]).filter((k) => k !== "date" && k !== "warehouse_name").map((k) => [k, knex.raw("EXCLUDED.??", [k])])
            ),
            updated_at: knex.fn.now(),
        });

    logger.info(`Upserted ${rows.length} tariff rows for ${today}`);
}

/** Fetch tariffs from WB API and save to DB */
export async function updateTariffs(): Promise<void> {
    logger.info("Fetching tariffs from WB API...");
    const data = await fetchBoxTariffs();
    await saveTariffs(data);
    logger.info("Tariffs updated successfully");
}