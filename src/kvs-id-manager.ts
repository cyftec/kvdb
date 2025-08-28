import { KvStore } from "./kv-stores";
import { DbRecordID } from "./models";

export type KvsIDManager = {
  getCurrentID: () => DbRecordID;
  useNewID: (callback: (newId: DbRecordID) => void) => DbRecordID;
};

export const getKvStoreIDManager = (kvStore: KvStore): KvsIDManager => {
  return {
    getCurrentID: function (): DbRecordID {
      let maxID = kvStore.getItem("maxID");
      if (!maxID) kvStore.setItem("maxID", "0");
      maxID = kvStore.getItem("maxID");
      if (maxID === undefined)
        throw `Error setting and getting the value for key 'maxID' in KV Store.`;
      return +maxID;
    },
    useNewID: function (callback: (newId: DbRecordID) => void): DbRecordID {
      const thisIDManager = this as KvsIDManager;
      const newID = thisIDManager.getCurrentID() + 1;
      callback(newID);
      kvStore.setItem("maxID", `${newID}`);
      return newID;
    },
  };
};
