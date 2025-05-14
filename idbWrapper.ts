type Indexes = {
  indexName: string;
  keyPath: string | string[];
  unique?: boolean;
}[];
type OnUpgradeActions = {
  createObjectStore: (
    name: string,
    keyPath: string | string[],
    autoIncrement?: boolean | undefined,
  ) => {
    createIndexes: ((indexes: Indexes) => void) | null;
    error: string | Error | null;
  };
};
type AddElement = (storeName: string, element: object) => Promise<IDBValidKey | DOMException | null>;
type GetElementByIndex = <T>(storeName: string, indexName: string, value: (string | number | boolean)) => Promise<T[]>;

type OnSuccessActions = {
  add: AddElement,
  get: GetElementByIndex
};

export function indexedDbWrapper(
  name: string,
  version: number,
  {
    onUpgrade,
    onSuccess,
    onError,
  }: {
    onUpgrade?: (actions: OnUpgradeActions) => void;
    onSuccess?: (db: IDBDatabase, actions: OnSuccessActions) => void;
    onError?: (error: DOMException) => void;
  },
) {
  const request = indexedDB.open(name, version ?? 1);

  request.onerror = (event) => {
    const error = (event.target as IDBRequest).error;
    onError?.(error!);
  };

  request.onupgradeneeded = () => {
    const db = request.result;
    onUpgrade?.({
      createObjectStore: createObjectStore.bind(null, db),
    });
  };

  request.onsuccess = () => {
    const db = request.result;
    const add = addElement.bind(null, db);
    const get = getElementByIndex.bind(null, db);
    onSuccess?.(db, {
      add: add as AddElement,
      get: get as GetElementByIndex
    });
  };

  function createObjectStore(
    db: IDBDatabase,
    name: string,
    keyPath: string | string[],
    autoIncrement?: boolean,
  ) {
    let createIndexes: ((indexes: Indexes) => void) | null = null;
    let error: Error | string | null = null;
    try {
      const objectStore = db.createObjectStore(name, {
        keyPath: keyPath,
        autoIncrement: autoIncrement ?? false,
      });

      createIndexes = createIndex.bind(null, objectStore);
    } catch (e) {
      if (e instanceof Error) {
        error = e;
      } else {
        error = `unexpected error: ${error}`;
      }
    }

    return { createIndexes, error };
  }

  function createIndex(objectStore: IDBObjectStore, indexes: Indexes) {
    indexes.forEach((index) => {
      objectStore.createIndex(index.indexName, index.keyPath, { unique: index.unique });
    });
  }

  function addElement(db: IDBDatabase, storeName: string, element: object): Promise<IDBValidKey | DOMException | null> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(element);

      request.onsuccess = () => {
        resolve(request.result)
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  function getElementByIndex<T>(db: IDBDatabase, storeName: string, indexName: string, value: string | number | boolean): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.openCursor(IDBKeyRange.only(value));

      const results: T[] = [];
      request.onsuccess = function() {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value as T);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        reject(request.error);
      }
    });
  }
}
