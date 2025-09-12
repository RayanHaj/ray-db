import {
  InsertOne,
  DeleteOne,
  FindAll,
  FindOne,
  InsertMany,
  FindMany,
  DeleteMany,
  UpdateOne,
  UpdateManyByQuery
} from './crudTypes';

export interface OnSuccessActions {
  insertOne: InsertOne;
  insertMany: InsertMany;
  findOne: FindOne;
  findMany: FindMany;
  findAll: FindAll;
  deleteOne: DeleteOne;
  deleteMany: DeleteMany;
  updateOne: UpdateOne;
  updateManyByQuery: UpdateManyByQuery
}
