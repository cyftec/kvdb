import { UNSTRUCTURED_RECORD_VALUE_KEY, Unstructured } from "./models";

export const unstructuredValue = <T>(record: Unstructured<T>) =>
  record[UNSTRUCTURED_RECORD_VALUE_KEY];

export const newUnstructuredRecord = <T>(value: T): Unstructured<T> => ({
  id: 0,
  value,
});

export const isRecordNew = (record: any): boolean => {
  if (record?.id) return false;
  return true;
};

export const isUnstructuredRecord = (record: any): boolean => {
  if (
    typeof record === "object" &&
    record !== null &&
    Object.keys(record).length === 2 &&
    Object.keys(record).includes("id") &&
    Object.keys(record).includes("value")
  )
    return true;
  return false;
};
