import type {ObjectStoreIndex} from './types/ObjectStoreIndex';
import type {
    InsertOne,
    DeleteOne,
    FindAll,
    FindOne, InsertMany, FindMany, DeleteMany, UpdateOne, UpdateOneQuery,
} from './types/crudTypes';
import type {OnUpgradeActions} from './types/ActionsOnUpgrade';
import type {OnSuccessActions} from './types/ActionsOnSuccess';
import {DeepPartial} from "./types/DeepPartial";

export function indexedDbWrapper(
    name: string,
    version: number,
    {
        onUpgrade,
        onSuccess,
        onError,
    }: {
        onUpgrade?: (db: IDBDatabase, actions: OnUpgradeActions) => void;
        onSuccess?: (db: IDBDatabase, actions: OnSuccessActions) => void;
        onError?: (error: DOMException) => void;
    },
) {
    const request = indexedDB.open(name, version ?? 1);

    request.onupgradeneeded = () => {
        const db = request.result;
        onUpgrade?.(db, {
            createObjectStore: createObjectStore.bind(null, db),
        });
    };

    request.onsuccess = () => {
        const db = request.result;
        const insertOne = _insertOne.bind(null, db);
        const insertMany = _insertMany.bind(null, db);
        const findOne = _findOne.bind(null, db);
        const findMany = _findMany.bind(null, db);
        const findAll = _findAll.bind(null, db);
        const deleteOne = _deleteOne.bind(null, db);
        const deleteMany = _deleteMany.bind(null, db);
        const updateOne = _updateOne.bind(null, db);
        const updateOneQuery = _updateOneQuery.bind(null, db);

        onSuccess?.(db, {
            insertOne: insertOne as InsertOne,
            insertMany: insertMany as InsertMany,
            findOne: findOne as FindOne,
            findMany: findMany as FindMany,
            findAll: findAll as FindAll,
            deleteOne: deleteOne as DeleteOne,
            deleteMany: deleteMany as DeleteMany,
            updateOne: updateOne as UpdateOne,
            updateOneQuery: updateOneQuery as UpdateOneQuery
        });
    };

    request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        onError?.(error!);
    };

    function createObjectStore(
        db: IDBDatabase,
        name: string,
        keyPath: string | string[],
        autoIncrement?: boolean,
    ) {
        let createIndexes: ((indexes: ObjectStoreIndex[]) => void) | null = null;
        let error: Error | string | null = null;
        try {
            const objectStore = db.createObjectStore(name, {
                keyPath: keyPath,
                autoIncrement: autoIncrement ?? false,
            });

            createIndexes = _createIndex.bind(null, objectStore);
        } catch (e) {
            if (e instanceof Error) {
                error = e;
            } else {
                error = `unexpected error: ${e}`;
            }
        }

        return {createIndexes, error};
    }

    function _createIndex(objectStore: IDBObjectStore, indexes: ObjectStoreIndex[]) {
        indexes.forEach((index) => {
            objectStore.createIndex(index.indexName, index.keyPath, {unique: index.unique});
        });
    }

    function _insertOne<T>(
        db: IDBDatabase,
        storeName: string,
        element: T,
        key?: IDBValidKey
    ): Promise<IDBValidKey | null> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(element, key);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    function _insertMany<T>(
        db: IDBDatabase,
        storeName: string,
        elements: T[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const keys: IDBValidKey[] = [];

            let rejected = false;
            transaction.oncomplete = () => {
                if (!rejected) {
                    resolve(keys);
                }
            }

            transaction.onerror = () => {
                if (!rejected) {
                    rejected = true;
                    reject(transaction.error)
                }
            }

            elements.forEach(element => {
                const request = store.add(element);

                request.onsuccess = () => {
                    keys.push(request.result);
                };

                request.onerror = () => {
                    if (!rejected) {
                        rejected = true;
                        reject(request.error);
                        transaction.abort();
                    }
                }
            });
        });
    }

    function _findOne<T>(
        db: IDBDatabase,
        storeName: string,
        indexName: string,
        element: IDBValidKey,
    ): Promise<T | undefined> {
        return new Promise<T | undefined>((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.get(element);

            request.onsuccess = () => {
                resolve(request.result as T | undefined);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    function _findMany<T>(
        db: IDBDatabase,
        storeName: string,
        indexName: string,
        elements: IDBValidKey[],
    ): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);

            const promises = elements.map(element => {
                return new Promise<T>((resolve, reject) => {
                    const request = index.get(element);
                    request.onsuccess = () => resolve(request.result as T);
                    request.onerror = () => reject(request.error);
                });
            });

            Promise.all(promises)
                .then(resolve)
                .catch(reject);
        });
    }

    function _findAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result as T[]);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    function _deleteOne<R extends { id: IDBValidKey } & Record<string, unknown>>(
        db: IDBDatabase,
        storeName: string,
        element: IDBValidKey,
        options?: { searchIndex: { value: string } },
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            const index = options?.searchIndex?.value;
            if (index) {
                _findOne<R>(db, storeName, index, element)
                    .then((value) => {
                        if (!value) return resolve();

                        const keyToDelete: IDBValidKey = value.id ?? (value[index] as IDBValidKey);
                        if (!keyToDelete) return resolve();

                        const request: IDBRequest = store.delete(keyToDelete);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    }).catch(reject);
                return;
            }

            const request = store.delete(element);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function _deleteMany<R extends { id: IDBValidKey } & Record<string, unknown>>(
        db: IDBDatabase,
        storeName: string,
        elements: IDBValidKey[],
        options?: { searchIndex: { value: string } },
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const index = options?.searchIndex?.value;
            if (index) {
                _findMany<R>(db, storeName, index, elements)
                    .then(values => {
                        const keysToDelete = values.filter(value => value && (value.id || value[index]))
                            .map(value => value.id ?? (value[index] as IDBValidKey));

                        deleteValues(db, storeName, keysToDelete).then(resolve).catch(reject);
                    }).catch(reject);
            } else {
                deleteValues(db, storeName, elements).then(resolve).catch(reject);
            }
        });

        function deleteValues(db: IDBDatabase, storeName: string, keys: IDBValidKey[]): Promise<void> {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                let rejected = false;
                transaction.oncomplete = () => {
                    if (!rejected) {
                        resolve();
                    }
                }

                transaction.onerror = () => {
                    if (!rejected) {
                        rejected = true;
                        reject(transaction.error)
                    }
                }

                for (const key of keys) {
                    const request = store.delete(key);
                    request.onerror = () => {
                        if (!rejected) {
                            rejected = true;
                            reject(request.error);
                            transaction.abort();
                        }
                    };
                }
            });
        }
    }

    function _updateOne<T>(
        db: IDBDatabase,
        storeName: string,
        element: T,
    ): Promise<IDBValidKey | null> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(element);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    function _updateOneQuery<T>(
        db: IDBDatabase,
        storeName: string,
        element: DeepPartial<T>,
        query: (item: T) => boolean
    ): Promise<IDBValidKey | null> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const cursor = store.openCursor();
            cursor.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
                if (cursor) {
                    const item = cursor.value as T;
                    if (query(item)) {
                        const newItem = { ...item, ...element };
                        const request = cursor.update(newItem);
                        request.onsuccess = () => {
                            resolve(request.result);
                        }
                        request.onerror = () => {
                            reject(request.error);
                        }
                    }
                    cursor.continue();
                } else {
                    resolve(null);
                }
            }
            request.onerror = () => reject(request.error);
        });
    }
}

