import { google } from "googleapis";
import env from "#config/env/env.js";
import knex from "#postgres/knex.js";
import log4js from "log4js";

const logger = log4js.getLogger("google-sheets");

const SHEET_NAME = "stocks_coefs";

/** Column headers for the Google Sheet */
const HEADERS = [
    "Date",
    "Warehouse",
    "Region",
    "Delivery Base",
    "Delivery Liter",
    "Delivery Coef %",
    "FBS Delivery Base",
    "FBS Delivery Liter",
    "FBS Delivery Coef %",
    "Storage Base",
    "Storage Liter",
    "Storage Coef %",
    "Next Tariff Date",
    "Tariff End Date",
];

/** Create authenticated Google Sheets client */
function getGoogleSheetsClient() {
    const auth = new google.auth.JWT(
        env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        undefined,
        env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
    );

    return google.sheets({ version: "v4", auth });
}

/** Get all spreadsheet IDs from the database */
async function getSpreadsheetIds(): Promise<string[]> {
    const rows = await knex("spreadsheets").select("spreadsheet_id");
    return rows.map((r) => r.spreadsheet_id);
}

/**
 * Sync spreadsheet IDs from env variable to database.
 * Env is the source of truth: new IDs are inserted, removed IDs are deleted.
 */
export async function syncSpreadsheets(): Promise<void> {
    const ids = env.GOOGLE_SPREADSHEET_IDS
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

    if (ids.length === 0) {
        logger.warn("No spreadsheet IDs configured in GOOGLE_SPREADSHEET_IDS");
        return;
    }

    // Remove IDs no longer in env
    await knex("spreadsheets").whereNotIn("spreadsheet_id", ids).del();

    // Insert new IDs
    await knex("spreadsheets")
        .insert(ids.map((id) => ({ spreadsheet_id: id })))
        .onConflict(["spreadsheet_id"])
        .ignore();

    logger.info(`Synced ${ids.length} spreadsheet(s)`);
}

/** Get today's tariffs from DB sorted by delivery coefficient ascending */
async function getTodayTariffs(): Promise<string[][]> {
    const today = new Date().toISOString().split("T")[0];

    const rows = await knex("box_tariffs")
        .where({ date: today })
        .orderByRaw("box_delivery_coef_expr ASC NULLS LAST");

    return rows.map((r) => [
        new Date(r.date).toISOString().split("T")[0],
        r.warehouse_name,
        r.geo_name,
        r.box_delivery_base ?? "",
        r.box_delivery_liter ?? "",
        r.box_delivery_coef_expr ?? "",
        r.box_delivery_marketplace_base ?? "",
        r.box_delivery_marketplace_liter ?? "",
        r.box_delivery_marketplace_coef_expr ?? "",
        r.box_storage_base ?? "",
        r.box_storage_liter ?? "",
        r.box_storage_coef_expr ?? "",
        r.dt_next_box ?? "",
        r.dt_till_max ?? "",
    ]);
}

/** Ensure the target sheet exists, create it if missing. Returns numeric sheetId. */
async function ensureSheet(sheets: ReturnType<typeof getGoogleSheetsClient>, spreadsheetId: string): Promise<number> {
    const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties",
    });

    const existing = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
    const existingId = existing?.properties?.sheetId;

    if (existingId !== undefined && existingId !== null) {
        return existingId;
    }

    // Sheet doesn't exist — create it
    const res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [{
                addSheet: { properties: { title: SHEET_NAME } },
            }],
        },
    });

    const sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;

    if (sheetId === undefined || sheetId === null) {
        throw new Error(`Failed to create sheet "${SHEET_NAME}" in ${spreadsheetId}`);
    }

    logger.info(`Created sheet "${SHEET_NAME}" in spreadsheet ${spreadsheetId}`);
    return sheetId;
}

/** Update a single Google Sheet with tariff data */
async function updateSheet(sheets: ReturnType<typeof getGoogleSheetsClient>, spreadsheetId: string, data: string[][]): Promise<void> {
    const sheetId = await ensureSheet(sheets, spreadsheetId);

    // Clear existing data
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: SHEET_NAME,
    });

    // Write headers + data, then freeze the header row in a single batchUpdate
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: {
            values: [HEADERS, ...data],
        },
    });

    // Freeze the header row so it stays visible when scrolling
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [{
                updateSheetProperties: {
                    properties: {
                        sheetId,
                        gridProperties: { frozenRowCount: 1 },
                    },
                    fields: "gridProperties.frozenRowCount",
                },
            }],
        },
    });
}

/** Export today's tariffs to all Google Sheets from the spreadsheets table */
export async function exportToGoogleSheets(): Promise<void> {
    const spreadsheetIds = await getSpreadsheetIds();

    if (spreadsheetIds.length === 0) {
        logger.warn("No spreadsheets configured in database");
        return;
    }

    const data = await getTodayTariffs();

    if (data.length === 0) {
        logger.warn("No tariff data for today to export");
        return;
    }

    const sheets = getGoogleSheetsClient();

    for (const id of spreadsheetIds) {
        try {
            await updateSheet(sheets, id, data);
            logger.info(`Updated spreadsheet ${id} with ${data.length} rows`);
        } catch (err) {
            logger.error(`Failed to update spreadsheet ${id}:`, err);
        }
    }
}
