import {
  DbRecord,
  DbRecordID,
  DbUnsupportedType,
  KvsRecordID,
  KvsRecordIDPrefix,
  NumBoolean,
  TableKey,
  WithID,
} from "./models";
import { Table } from "./table";

export const parseNum = (str: string) =>
  Number.isNaN(+str) ? undefined : +str;

export const getKvsRecordIDPrefix = (tableKey: TableKey): KvsRecordIDPrefix =>
  `${tableKey}_`;

export const getDbRecordIDFromKvsRecordID = (
  tableKey: TableKey,
  kvStoreRecordID: string
): DbRecordID | undefined => {
  const recordIDPrefix = getKvsRecordIDPrefix(tableKey);
  if (!kvStoreRecordID.startsWith(recordIDPrefix)) return;
  const recordIdStr = kvStoreRecordID.split(recordIDPrefix)[1] || "";
  return parseNum(recordIdStr);
};

export const getKvsRecordIDFromDbRecordID = (
  tableKey: TableKey,
  dbRecordID: DbRecordID
): KvsRecordID => {
  const recordIDPrefix = getKvsRecordIDPrefix(tableKey);
  return `${recordIDPrefix}${dbRecordID}`;
};

export const getJsValue = (
  dbValue: number | undefined,
  jsType: DbUnsupportedType
) => {
  // dbValue can only be one of DbUnsupportedType
  if (typeof dbValue === "number" && jsType === "Date") {
    return new Date(dbValue);
  }
  if (typeof dbValue === "number" && jsType === "Boolean") {
    return !!dbValue;
  }
  return dbValue;
};

type ReturnType<In> = In extends Date
  ? number
  : In extends boolean
  ? NumBoolean
  : In;
export const getDbValue = <ForeignDbRecord extends Date | boolean | undefined>(
  jsValue: ForeignDbRecord
): ReturnType<ForeignDbRecord> => {
  if (jsValue instanceof Date) {
    return jsValue.getTime() as ReturnType<typeof jsValue>;
  }
  if (typeof jsValue === "boolean") {
    return +jsValue as ReturnType<typeof jsValue>;
  }
  return jsValue as ReturnType<typeof jsValue>;
};

export const getExtendedValue = (
  table: Table<DbRecord<any>>,
  rawValue?: DbRecordID | DbRecordID[]
) => {
  // rawValue can only be undefined | DbRecordID | DbRecordID[]
  if (typeof rawValue === "number") return table.get(rawValue as DbRecordID);
  if (Array.isArray(rawValue)) {
    return rawValue.length ? table.get(rawValue as DbRecordID[]) : rawValue;
  }
  return rawValue;
};

export const getForeignDbRecordIdValues = <ForeignDbRecord extends object>(
  foreignTable: Table<DbRecord<any>>,
  extendedValue: WithID<ForeignDbRecord> | WithID<ForeignDbRecord>[] | undefined
) => {
  if (Array.isArray(extendedValue)) {
    return extendedValue.map((rec) => {
      if (rec.id) return rec.id;
      if (rec.id === undefined) throw "Invalid extended foreign values list";
      const newCreatedRecord = foreignTable.put(rec);
      return newCreatedRecord.id;
    });
  }
  if (typeof extendedValue === "object" && extendedValue !== null) {
    if (extendedValue.id) return extendedValue.id;
    if (extendedValue.id === undefined) throw "Invalid extended foreign value";
    const newCreatedRecord = foreignTable.put(extendedValue);
    return newCreatedRecord.id;
  }
  return extendedValue;
};

export const getMappedObject = (
  valueConverter: (value: any) => any,
  obj: Record<string, any>,
  /**
   * If the converted type is nested deep within the record (object),
   * pass the path as ["nestedLevel1", "nestedLeve2"..."nestedLevelN"]
   * for the object
   * const obj = {
   *   ...,
   *   nestedLevel1: {
   *     ...,
   *     nestedLevel2: {
   *       nestedLevel3: valueWhichNeedsConversion,
   *     }
   *   }
   * }
   */
  pathArray: string[]
): Record<string, any> => {
  if (typeof obj !== "object" || obj === null) return obj;

  if (pathArray.length === 1) {
    const key = pathArray[0];
    return { ...obj, [key]: valueConverter(obj[key]) };
  }

  const firstKey = pathArray[0];
  return {
    ...obj,
    [firstKey]: getMappedObject(
      valueConverter,
      obj[firstKey] as object,
      pathArray.slice(1)
    ),
  };
};
