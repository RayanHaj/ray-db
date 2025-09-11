import type {
    DeleteMany,
    DeleteOne,
    FindAll,
    FindMany,
    FindOne,
    InsertMany,
    InsertOne,
    UpdateOne, UpdateOneQuery
} from "./types/crudTypes";
import type {ObjectStoreIndex} from "./types/ObjectStoreIndex";
import type {ObjectStore} from "./types/ObjectStore";
import {indexedDbWrapper} from "./idbWrapper";
export class RayDb {
    private _db!: IDBDatabase;
    private _findOne!: FindOne;
    private _findMany!: FindMany;
    private _findAll!: FindAll;
    private _insertOne!: InsertOne;
    private _insertMany!: InsertMany;
    private _deleteOne!: DeleteOne;
    private _deleteMany!: DeleteMany;
    private _updateOne!: UpdateOne;
    private _updateOneQuery!: UpdateOneQuery

    private _createObjectStore!: (
        name: string,
        keyPath: string | string[],
        autoIncrement?: boolean | undefined,
    ) => {
        createIndexes: ((indexes: ObjectStoreIndex[]) => void) | null;
        error: string | Error | null;
    };

    static async create(
        name: string,
        version: number,
        objectStores: ObjectStore[],
    ): Promise<RayDb> {
        const service = new RayDb();
        await service.init(name, version, objectStores);
        return service;
    }

    private async init(
        name: string,
        version: number,
        objectStores: ObjectStore[],
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            indexedDbWrapper(name, version, {
                onUpgrade: (db, {createObjectStore}) => {
                    this._createObjectStore = createObjectStore;
                    objectStores.forEach((store) => {
                        if (!db.objectStoreNames.contains(store.name)) {
                            const objectStore = createObjectStore(store.name, store.keyPath, store.autoIncrement);
                            if (objectStore && objectStore.createIndexes) {
                                objectStore.createIndexes(store.indexes);
                            }
                        }
                    });
                },
                onSuccess: (db, {
                    findOne,
                    findMany,
                    findAll,
                    insertOne,
                    insertMany,
                    deleteOne,
                    deleteMany,
                    updateOne,
                    updateOneQuery
                }) => {
                    this._db = db;
                    this._findOne = findOne;
                    this._findMany = findMany;
                    this._insertOne = insertOne;
                    this._deleteOne = deleteOne;
                    this._deleteMany = deleteMany;
                    this._findAll = findAll;
                    this._insertMany = insertMany;
                    this._updateOne = updateOne;
                    this._updateOneQuery = updateOneQuery;
                    resolve();
                },
                onError: (error) => {
                    reject(error);
                },
            });
        });
    }

    public async findOne<T extends object>(
        storeName: string,
        indexName: string,
        value: IDBValidKey,
    ) {
        return await this._findOne<T>(storeName, indexName, value);
    }

    public async findMany<T extends object>(
        storeName: string,
        indexName: string,
        elements: IDBValidKey[],
    ) {
        return await this._findMany<T>(storeName, indexName, elements);
    }

    public async findAll<T>(storeName: string) {
        return await this._findAll<T>(storeName);
    }

    public async insertOne<T extends object>(storeName: string, element: T, key?: IDBValidKey) {
        return await this._insertOne(storeName, element, key);
    }

    public async insertMany<T extends object>(storeName: string, elements: T[]) {
        return await this._insertMany(storeName, elements);
    }

    public async deleteOne(
        storeName: string,
        element: IDBValidKey,
        options?: {
            searchIndex: { value: string };
        },
    ) {
        return await this._deleteOne(storeName, element, options);
    }

    public async deleteMany(
        storeName: string,
        elements: IDBValidKey[],
        options?: {
            searchIndex: { value: string };
        },
    ) {
        return await this._deleteMany(storeName, elements, options);
    }

    public async updateOne<T extends object>(storeName: string, element: T) {
        return this._updateOne(storeName, element);
    }

    public async updateOneQuery<T extends object>(storeName: string, element: Partial<T>, query: (item: T) => boolean) {
        return this._updateOneQuery(storeName, element, query);
    }

    public db() {
        return this._db;
    }

    public close() {
        this._db?.close();
    }

    public objectStoreNames() {
        return this._db.objectStoreNames;
    }

    public createObjectStore(
        name: string,
        keyPath: string | string[],
        autoIncrement?: boolean | undefined,
    ): {
        createIndexes: ((indexes: ObjectStoreIndex[]) => void) | null;
        error: string | Error | null;
    } {
        return this._createObjectStore(name, keyPath, autoIncrement);
    }
}