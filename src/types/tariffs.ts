/** Single warehouse tariff entry from WB API response */
export interface WbWarehouseTariff {
    warehouseName: string;
    geoName: string;
    boxDeliveryBase: string;
    boxDeliveryLiter: string;
    boxDeliveryCoefExpr: string;
    boxDeliveryMarketplaceBase: string;
    boxDeliveryMarketplaceLiter: string;
    boxDeliveryMarketplaceCoefExpr: string;
    boxStorageBase: string;
    boxStorageLiter: string;
    boxStorageCoefExpr: string;
}

/** WB API /api/v1/tariffs/box response */
export interface WbTariffsBoxResponse {
    response: {
        data: {
            dtNextBox: string;
            dtTillMax: string;
            warehouseList: WbWarehouseTariff[] | null;
        };
    };
}

/** Row shape for box_tariffs table */
export interface BoxTariffRow {
    date: string;
    warehouse_name: string;
    geo_name: string;
    box_delivery_base: string | null;
    box_delivery_liter: string | null;
    box_delivery_coef_expr: string | null;
    box_delivery_marketplace_base: string | null;
    box_delivery_marketplace_liter: string | null;
    box_delivery_marketplace_coef_expr: string | null;
    box_storage_base: string | null;
    box_storage_liter: string | null;
    box_storage_coef_expr: string | null;
    dt_next_box: string;
    dt_till_max: string;
}
