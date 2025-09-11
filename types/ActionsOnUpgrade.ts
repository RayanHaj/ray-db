import type { ObjectStoreIndex } from './ObjectStoreIndex';

export interface OnUpgradeActions {
  createObjectStore: (
    name: string,
    keyPath: string | string[],
    autoIncrement?: boolean,
  ) => {
    createIndexes: ((indexes: ObjectStoreIndex[]) => void) | null;
    error: string | Error | null;
  };
}
