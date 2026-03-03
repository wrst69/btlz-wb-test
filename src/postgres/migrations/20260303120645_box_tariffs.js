/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.createTable("box_tariffs", (table) => {
        table.increments("id").primary();
        table.date("date").notNullable();
        table.string("warehouse_name").notNullable();
        table.string("geo_name").notNullable();

        // Delivery (FBW)
        table.decimal("box_delivery_base", 10, 2);
        table.decimal("box_delivery_liter", 10, 2);
        table.decimal("box_delivery_coef_expr", 10, 2);

        // Delivery (FBS/Marketplace)
        table.decimal("box_delivery_marketplace_base", 10, 2);
        table.decimal("box_delivery_marketplace_liter", 10, 2);
        table.decimal("box_delivery_marketplace_coef_expr", 10, 2);

        // Storage
        table.decimal("box_storage_base", 10, 2);
        table.decimal("box_storage_liter", 10, 2);
        table.decimal("box_storage_coef_expr", 10, 2);

        // Tariff period metadata
        table.string("dt_next_box");
        table.string("dt_till_max");
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.unique(["date", "warehouse_name"]);
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.dropTable("box_tariffs");
}
