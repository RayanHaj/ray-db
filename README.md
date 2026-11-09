# RayDB

A lightweight, promise-based wrapper around the native IndexedDB API, Tailored to my specific needs for my RayOS project.

## Installation

```bash
npm i ray-db-wrapper
```

## Getting started

Create a client with `RayDb.create()`, declaring your object stores upfront. Stores and indexes are created automatically on upgrade:

```ts
import { RayDb } from 'raydb';

const db = await RayDb.create('myDatabase', 1, [
  {
    name: 'users',
    keyPath: 'id',
    indexes: [{ indexName: 'email', keyPath: 'email', unique: true }],
  },
]);

// Insert
const id = await db.insertOne('users', { name: 'Ray', email: 'ray@example.com' });

// Query by index
const user = await db.findOne<typeof user>('users', 'email', 'ray@example.com');

// Delete
await db.deleteOne('users', id);

// Done
db.close();
```

Because `RayDb.create()` returns a Promise, the client is always fully initialized when you receive it — no callbacks, no "wait for `onsuccess`" bookkeeping.

## API

All operations are async and resolve or reject as Promises.

| Method | Signature | Description |
| --- | --- | --- |
| `RayDb.create` | `static (name, version, objectStores[]) → Promise<RayDb>` | Opens (and upgrades, if needed) the database and returns an initialized client. |
| `insertOne` | `(storeName, element, key?) → Promise<IDBValidKey \| null>` | Adds a single record, optionally with an explicit key. |
| `insertMany` | `(storeName, elements[]) → Promise<IDBValidKey[]>` | Bulk-inserts records in one transaction; rejects and aborts on any failure. |
| `findOne` | `(storeName, indexName, key) → Promise<T \| undefined>` | Fetches one record by index key. |
| `findMany` | `(storeName, indexName, keys[]) → Promise<T[]>` | Fetches multiple records by index keys. |
| `findAll` | `(storeName) → Promise<T[]>` | Returns every record in the store. |
| `updateOne` | `(storeName, element) → Promise<IDBValidKey \| null>` | Upserts a record via `put`. |
| `updateManyByQuery` | `(storeName, updater, query) → Promise<IDBValidKey[]>` | Iterates the store with a cursor and deep-merges the result of `updater(item)` into every item matching `query`. |
| `deleteOne` | `(storeName, key, options?) → Promise<void>` | Deletes one record; with `options.searchIndex` it looks the record up by index first. |
| `deleteMany` | `(storeName, keys[], options?) → Promise<void>` | Bulk-delete; supports the same `searchIndex` option. |
| `db()` | `() → IDBDatabase` | Direct access to the underlying `IDBDatabase` for anything RayDB doesn't cover. |
| `close()` | `() → void` | Closes the database connection. |
| `objectStoreNames()` | `() → DOMStringList` | Lists the stores in the database. |
| `createObjectStore` | `(name, keyPath, autoIncrement?) → { createIndexes, error }` | Manually create a store outside of `RayDb.create` (upgrade context only). |
