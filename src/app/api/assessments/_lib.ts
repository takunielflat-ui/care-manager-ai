const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL の id が UUID の形か（形の違う id で DB エラーにしない） */
export const isUuid = (value: string) => UUID.test(value);
