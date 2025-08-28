export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export type NumBoolean = 0 | 1;

export const ID_KEY = "id" as const satisfies string;
export const UNSTRUCTURED_RECORD_VALUE_KEY = "value" as const satisfies string;

export type IDKey = typeof ID_KEY;
export type UnstructuredRecordValueKey = typeof UNSTRUCTURED_RECORD_VALUE_KEY;
export type DbRecordID = number;
export type TableKey = string;
export type KvsRecordIDPrefix = `${TableKey}_`;
export type KvsRecordID = `${KvsRecordIDPrefix}${DbRecordID}`;
export type DbUnsupportedType = "Date" | "Boolean";

export type WithID<RawRecord extends object> = {
  [K in IDKey]: DbRecordID;
} & RawRecord;
export type Structured<RawRecord extends object> = Prettify<WithID<RawRecord>>;
export type Unstructured<RawRecord> = Prettify<
  WithID<{
    [K in UnstructuredRecordValueKey]: RawRecord;
  }>
>;

export type DbRecord<RawRecord> = RawRecord extends object
  ? Structured<RawRecord> | Unstructured<RawRecord>
  : Unstructured<RawRecord>;

export type RawUnstructuredRecord<T extends Unstructured<any>> = T["value"];
export type RawStructuredRecord<T extends Structured<object>> = {
  [K in keyof T]: K extends IDKey ? never : T[K];
};
