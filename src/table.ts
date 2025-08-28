import { ForeignTableData } from "./db";
import { KvStore } from "./kv-stores";
import { getKvStoreIDManager } from "./kvs-id-manager";
import {
  DbRecord,
  DbRecordID,
  DbUnsupportedType,
  ID_KEY,
  RawStructuredRecord,
  Structured,
  TableKey,
  UNSTRUCTURED_RECORD_VALUE_KEY,
  Unstructured,
} from "./models";
import {
  getDbRecordIDFromKvsRecordID,
  getDbValue,
  getExtendedValue,
  getForeignDbRecordIdValues,
  getJsValue,
  getKvsRecordIDFromDbRecordID,
  getMappedObject,
} from "./transforms";
import { isRecordNew, isUnstructuredRecord, unstructuredValue } from "./utils";

type RecordMatcher<DatabaseRecord> = (record: DatabaseRecord) => boolean;

type GetResponse<ReqIDs, DatabaseRecord> = undefined extends ReqIDs
  ? DatabaseRecord[]
  : ReqIDs extends DbRecordID
  ? DatabaseRecord | undefined
  : DatabaseRecord[];

export type Table<DatabaseRecord extends DbRecord<any>> = {
  count: number;
  get: <ReqIDs extends DbRecordID | DbRecordID[] | undefined>(
    requestedIDorIDs?: ReqIDs
  ) => GetResponse<ReqIDs, DatabaseRecord>;
  put: (record: DatabaseRecord) => DatabaseRecord;
  find: (
    recordMatcher: RecordMatcher<DatabaseRecord>
  ) => DatabaseRecord | undefined;
  filter: (
    recordMatcher: RecordMatcher<DatabaseRecord>,
    count?: number
  ) => DatabaseRecord[];
  delete: (dbRecordID: DbRecordID) => void;
};

export const createTable = <DatabaseRecord extends DbRecord<any>>(
  kvStore: KvStore,
  tableKey: TableKey,
  isUnstructured: boolean,
  getForeignTableFromKey: (tableKey: TableKey) => Table<DbRecord<any>>,
  foreignKeyMappings?: Partial<{
    [k in keyof DatabaseRecord]: ForeignTableData;
  }>,
  dbToJsTypeMappings?: Partial<{
    [k in keyof DatabaseRecord]: DbUnsupportedType;
  }>
): Table<DatabaseRecord> => {
  const kvsIdManager = getKvStoreIDManager(kvStore);

  const getStructuredDbRecord = <T extends Structured<object>>(
    record: T
  ): RawStructuredRecord<T> => {
    if (foreignKeyMappings) {
      Object.keys(foreignKeyMappings).forEach((keysPath) => {
        const path = keysPath as keyof typeof foreignKeyMappings;
        const foreignTableData = foreignKeyMappings[path] as ForeignTableData;
        const foreignTable = getForeignTableFromKey(foreignTableData.tableKey);
        const keysPathArray = keysPath.split(".");
        record = getMappedObject(
          (rawValue) => getForeignDbRecordIdValues(foreignTable, rawValue),
          record,
          keysPathArray
        ) as T;
      });
    }

    if (dbToJsTypeMappings) {
      Object.keys(dbToJsTypeMappings).forEach((keysPath) => {
        const keysPathArray = keysPath.split(".");
        record = getMappedObject(getDbValue, record, keysPathArray) as T;
      });
    }

    delete (record as RawStructuredRecord<T>).id;
    return record as RawStructuredRecord<T>;
  };

  const getStructuredNormalRecord = <T extends object>(
    id: DbRecordID,
    record: T
  ): Structured<T> => {
    if (foreignKeyMappings) {
      Object.keys(foreignKeyMappings).forEach((keysPath) => {
        const path = keysPath as keyof typeof foreignKeyMappings;
        const foreignTableData = foreignKeyMappings[path] as ForeignTableData;
        const foreignTable = getForeignTableFromKey(foreignTableData.tableKey);
        const keysPathArray = keysPath.split(".");
        record = getMappedObject(
          (rawValue) => getExtendedValue(foreignTable, rawValue),
          record,
          keysPathArray
        ) as T;
      });
    }

    if (dbToJsTypeMappings) {
      Object.keys(dbToJsTypeMappings).forEach((keysPath) => {
        const path = keysPath as keyof typeof dbToJsTypeMappings;
        const jsType = dbToJsTypeMappings[path] as DbUnsupportedType;
        const keysPathArray = keysPath.split(".");
        record = getMappedObject(
          (rawValue) => getJsValue(rawValue, jsType),
          record,
          keysPathArray
        ) as T;
      });
    }

    return { id, ...record };
  };

  const getAllIDs = (): DbRecordID[] => {
    const kvStoreRecordIDs = kvStore.getAllKeys();
    const validIDs: DbRecordID[] = [];
    for (const id of kvStoreRecordIDs) {
      const validDbRecordID = getDbRecordIDFromKvsRecordID(tableKey, id);
      if (validDbRecordID === undefined) continue;
      validIDs.push(validDbRecordID);
    }
    return validIDs;
  };

  const getRawRecord = (id: DbRecordID): any => {
    if (id === 0) throw `Record with id - '0' tried to be fetched.`;
    const kvsRecordID = getKvsRecordIDFromDbRecordID(tableKey, id);
    const kvsRecordValue = kvStore.getItem(kvsRecordID);
    if (kvsRecordValue === undefined) return;
    const record = JSON.parse(kvsRecordValue);
    return record;
  };

  const getSingleRecord = (id: DbRecordID): DatabaseRecord | undefined => {
    let rawRecord = getRawRecord(id);
    if (!rawRecord) return;

    if (isUnstructured) {
      return {
        [ID_KEY]: id,
        [UNSTRUCTURED_RECORD_VALUE_KEY]: rawRecord,
      } as unknown as DatabaseRecord;
    }

    return getStructuredNormalRecord(id, rawRecord);
  };

  const getAllRecords = (ids?: DbRecordID[]): DatabaseRecord[] => {
    const validIDs: DbRecordID[] = ids?.length ? ids : getAllIDs();
    const records: DatabaseRecord[] = [];
    for (const id of validIDs) {
      const record = getSingleRecord(id);
      if (!record) continue;
      records.push(record);
    }
    return records;
  };

  const getRecord = <ReqIDs extends DbRecordID | DbRecordID[] | undefined>(
    requestedIDorIDs?: ReqIDs
  ): GetResponse<ReqIDs, DatabaseRecord> => {
    return (
      typeof requestedIDorIDs === "number"
        ? getSingleRecord(requestedIDorIDs)
        : getAllRecords(requestedIDorIDs)
    ) as GetResponse<ReqIDs, DatabaseRecord>;
  };

  const getAllWhere = (
    recordMatcher: RecordMatcher<DatabaseRecord>,
    count?: number
  ): DatabaseRecord[] => {
    const validIDs: DbRecordID[] = getAllIDs();
    const matchingRecords: DatabaseRecord[] = [];
    const idsLength = validIDs.length;
    const recordsLength = count || idsLength;
    for (const id of validIDs) {
      const record = getSingleRecord(id);
      if (!record) continue;
      const recordMatched = recordMatcher(record);
      if (recordMatched) matchingRecords.push(record);
      if (matchingRecords.length === recordsLength) break;
    }
    return matchingRecords;
  };

  const findRecord = (
    recordMatcher: RecordMatcher<DatabaseRecord>
  ): DatabaseRecord | undefined => getAllWhere(recordMatcher, 1)[0];

  const validateExistingUnstructuredRecord = (record: Unstructured<any>) => {
    const existingRecord = findRecord(
      (rec) =>
        unstructuredValue(rec as Unstructured<any>) ===
        unstructuredValue(record)
    );
    if (existingRecord)
      throw `A unstructured record with same value - ${JSON.stringify(
        record
      )} already exists.`;
  };

  const validateRecordStructure = (
    record: DbRecord<any>,
    isUnstructured: boolean
  ) => {
    if (isUnstructured !== isUnstructuredRecord(record))
      throw `Unstructured or Strucutured type is not matching with passed record. This table is defined as '${
        isUnstructured ? "Unstructured" : "Strucutured"
      }' while the record passed is of the '${
        isUnstructured ? "Strucutured" : "Unstructured"
      }' type.\n${JSON.stringify(record)}`;
  };

  const validateNewRecord = (
    record: DbRecord<any>,
    isUnstructured: boolean
  ) => {
    if (!isRecordNew(record)) throw `Not a new record`;
    validateRecordStructure(record, isUnstructured);
    if (isUnstructured)
      validateExistingUnstructuredRecord(record as Unstructured<any>);
  };

  const putRecord = (record: DatabaseRecord): DatabaseRecord => {
    let recordID: DbRecordID = record.id;
    const isNewRecord = recordID === 0;
    if (isNewRecord) validateNewRecord(record, isUnstructured);
    const newRecord: DatabaseRecord = {
      ...(isNewRecord ? {} : getRawRecord(recordID) || {}),
      ...record,
    };

    const sanitisedRecord = isUnstructuredRecord(record)
      ? unstructuredValue(newRecord as Unstructured<any>)
      : getStructuredDbRecord(newRecord as Structured<object>);
    const kvsRecordValue = JSON.stringify(sanitisedRecord);

    const kvsRecordUpdator = (id: DbRecordID) => {
      const kvsRecordID = getKvsRecordIDFromDbRecordID(tableKey, id);
      kvStore.setItem(kvsRecordID, kvsRecordValue);
    };

    if (recordID === 0) {
      recordID = kvsIdManager.useNewID(kvsRecordUpdator);
    } else {
      kvsRecordUpdator(recordID);
    }

    return getRecord(recordID) as DatabaseRecord;
  };

  const deleteRecord = (dbRecordID: DbRecordID): void => {
    const kvsRecordID = getKvsRecordIDFromDbRecordID(tableKey, dbRecordID);
    kvStore.removeItem(kvsRecordID);
  };

  return {
    get count() {
      return getAllIDs().length;
    },
    get: getRecord,
    put: putRecord,
    find: findRecord,
    filter: getAllWhere,
    delete: deleteRecord,
  };
};
