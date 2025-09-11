export type InsertOne = <T>(storeName: string, element: T, key?: IDBValidKey) =>
    Promise<IDBValidKey | null>;
export type InsertMany = <T>(storeName: string, elements: T[]) =>
    Promise<IDBValidKey[]>;

export type FindOne = <T>(storeName: string, indexName: string, value: IDBValidKey,) => Promise<T>;
export type FindMany = <T>(storeName: string, indexName: string, elements: IDBValidKey[]) => Promise<T[]>;
export type FindAll = <T>(storeName: string) => Promise<T[]>;

export type DeleteOne = (storeName: string, element: IDBValidKey, options?: { searchIndex: { value: string } }) =>
    Promise<void>;
export type DeleteMany = (storeName: string, elements: IDBValidKey[], options?: { searchIndex: { value: string } }) =>
    Promise<void>
export type UpdateOne = <T>(storeName: string, element: T) =>
    Promise<IDBValidKey | null>;
export type UpdateOneQuery = <T>(storeName: string, element: Partial<T>, query: (item: T) => boolean) => Promise<IDBValidKey | null>;
