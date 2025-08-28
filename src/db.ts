import { KvStore, LOCALSTORAGE_AS_KVSTORE } from "./kv-stores";
import { DbRecord, DbUnsupportedType, TableKey } from "./models";
import { createTable, Table } from "./table";

export type ForeignTableData = { tableKey: TableKey; owned: boolean };

export type DatabaseSchema = {
  [TableName in string]: {
    key: TableKey;
    structure: DbRecord<any>;
    unstructured: boolean;
    foreignKeyMappings?: Record<string, ForeignTableData>;
    dbToJsTypeMappings?: Record<string, DbUnsupportedType>;
  };
};

export type DB<Schema extends DatabaseSchema> = {
  [TableName in keyof Schema]: Table<Schema[TableName]["structure"]>;
};

export const createDb = <Schema extends DatabaseSchema>(
  schema: Schema,
  kvStore?: KvStore
): DB<Schema> => {
  const store: KvStore = kvStore || LOCALSTORAGE_AS_KVSTORE;
  const db: DB<Schema> = {} as DB<Schema>;

  const getTableFromTableKey = (key: TableKey) => {
    const tableName = Object.keys(schema).find(
      (tblName) => schema[tblName]["key"] === key
    );
    if (!tableName)
      throw `Invalid key '${key}' passed to find table name from schema - '${JSON.stringify(
        schema
      )}'`;
    const table = db[tableName];
    if (!table) throw `Table with key '${key}' not found in the DB`;
    return table as Table<DbRecord<any>>;
  };

  Object.entries(schema).forEach(([tableName, tableDetails]) => {
    const {
      key: tableKey,
      unstructured,
      foreignKeyMappings,
      dbToJsTypeMappings,
    } = tableDetails;
    const table = createTable(
      store,
      tableKey,
      unstructured,
      getTableFromTableKey,
      foreignKeyMappings,
      dbToJsTypeMappings
    );
    db[tableName as keyof DB<Schema>] = table;
  });

  return db as DB<Schema>;
};
