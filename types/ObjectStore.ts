import type { ObjectStoreIndex } from './ObjectStoreIndex';

export type ObjectStore = {
  name: string;
  keyPath: string | string[];
  indexes: ObjectStoreIndex[];
  autoIncrement?: boolean | undefined;
};
