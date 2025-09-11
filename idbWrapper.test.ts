import "fake-indexeddb/auto";
import {RayDb} from "./index";

type FileSystemItem = {
    parents: number[],
    file?: {
        name: string,
        id: number
    },
    directory?: {
        name: string,
        children: number[]
    },
    id?: number
}

describe('IndexedDB wrapper tests', () => {
    let idbWrapper: RayDb;
    beforeAll(async () => {
        try {
            idbWrapper = await RayDb.create('desktop', 1, [
                {
                    name: 'files',
                    keyPath: 'id',
                    indexes: [
                        {indexName: 'name', keyPath: 'name', unique: true},
                        {indexName: 'type', keyPath: 'type', unique: false},
                    ],
                    autoIncrement: true
                },
                {
                    name: 'fileSystem',
                    keyPath: 'id',
                    indexes: [
                        {indexName: 'id', keyPath: 'id', unique: true},
                        {indexName: 'parents', keyPath: 'parents', unique: false},
                        {indexName: 'file', keyPath: 'file', unique: false},
                        {indexName: 'directory', keyPath: 'directory.name', unique: false},
                    ],
                    autoIncrement: true
                },
            ]);
        } catch (error) {
            console.error(error);
        }
    });

    test('get element', async () => {
        const file = await idbWrapper.findOne('files', 'name', 'file1');
        expect(file).toEqual({name: 'file1', type: 'file'});
    });

    test('add new element', async () => {
        const file = {name: 'file2', type: 'file'};
        const addFile = await idbWrapper.insertOne<{ name: string, type: string }>('files', file);
        expect(addFile).toEqual('file2')
    });

    test('get elements', async () => {
        await idbWrapper.insertMany<{ name: string, type: string }>('files', [
            {name: 'file2', type: 'file'},
            {name: 'file3', type: 'file'},
            {name: 'file4', type: 'file'},
            {name: 'file5', type: 'file'}
        ]);

        const files = await idbWrapper.findMany<{ name: string, type: string }>('files', 'name',
            ['file1', 'file2', 'file3', 'file4', 'file5']
        );

        files.forEach(file => {
            console.log(file);
        });
    });

    test('remove existing element', async () => {
        const elementName = 'file1';
        const deletedFile = await idbWrapper.deleteOne('files', elementName);
        expect(deletedFile).toEqual(undefined);

        const allElements = await idbWrapper.findAll<{ name: string, type: string }>('files');
        const foundDeletedElement = allElements.some(element => element.name === elementName);
        expect(foundDeletedElement).toBe(false);
    });

    test('remove not existing element', async () => {
        try {
            const deletedNotExistingFile = await idbWrapper.deleteOne('not-existing', 'notExisting');
            expect(deletedNotExistingFile).toEqual(undefined);
        } catch (error) {
            expect(error).toBeInstanceOf(DOMException);
            expect(error.name).toBe('NotFoundError');
        }
    });

    test('add all elements to indexeddb', async () => {
        const files = Array.from({length: 10}, (_, i) => ({
            name: `file${i + 3}`,
            type: 'file'
        }));
        const addFiles = await idbWrapper.insertMany<{ name: string, type: string }>('files', files);
        console.log(addFiles);

        const getFiles = await idbWrapper.findAll('files');
        console.log(getFiles);
    });

    test('delete all elements s indexeddb', async () => {
        await idbWrapper.insertMany<{ name: string, type: string }>('files', [
            {name: 'file2', type: 'file'},
            {name: 'file3', type: 'application'},
            {name: 'file4', type: 'video'},
            {name: 'file5', type: 'photo'}
        ]);

        await idbWrapper.deleteMany('files', ['file4', 'file5'], {searchIndex: {value: 'name'}});
        const getFiles = await idbWrapper.findAll('files');
    });

    test('recursive', async () => {

        const rootDir = await insertItemIntoFileSystem([], {
            directory: { name: 'root', children: [] }
        });
        const workDir = await insertItemIntoFileSystem([rootDir], {
            directory: { name: 'work', children: [] }
        });
        const schoolDir = await insertItemIntoFileSystem([workDir], {
            directory: { name: 'school', children: [] }
        });
        await insertItemIntoFileSystem([schoolDir], {
            file: { name: 'deep.txt', id: 999 }
        });

        const testArray = ['root', 'work', 'school'];
        const testString = 'C:/root/work/school'

        const rect = await recursion(testString);
        console.log(rect.directory);
    });

    function parseStringIntoRecursionArray(value: string) {
        return value.replace('C:/', '').split('/');
    }

    function isDirectory(item: FileSystemItem) {
        return item.directory !== undefined;
    }

    async function insertItemIntoFileSystem(parents: number[], item: {
        file?: { name: string, id: number },
        directory?: { name: string, children: number[] }
    }) {
        let id = await idbWrapper.insertOne<FileSystemItem>('fileSystem', {parents: parents, [item.directory ? 'directory' : 'file']: item.directory || item.file})

        if (Number.isNaN(id)) return;

        id = id as number;
        for (const parentId of parents) {
            const parent = await idbWrapper.findOne<FileSystemItem>('fileSystem', 'id', parentId);
            if (isDirectory(parent)) {
                if (!parent.directory.children.includes(id)) {
                    parent.directory.children.push(id);
                    await idbWrapper.updateOne<FileSystemItem>('fileSystem', parent);
                }
            }
        }

        return id;
    }

    async function recursion(names: string[] | string) {
        if (typeof names === 'string') {
            names = parseStringIntoRecursionArray(names);
        }

        const startPoint = await idbWrapper.findOne<FileSystemItem>('fileSystem', 'directory', names[0]);
        names.splice(0, 1);

        return await doRecursion(startPoint, names);
    }

    async function doRecursion(startPoint: FileSystemItem, names: string[]) {
        if (typeof names[0] === 'undefined' || names.length === 0) {
            return startPoint;
        }

        let item: FileSystemItem = startPoint;
        for (const child of startPoint.directory.children) {
            item = await idbWrapper.findOne<FileSystemItem>('fileSystem', 'id', child);

            if (isDirectory(item)) {
                if (names[0] === item.directory.name) {
                    names.splice(0, 1);
                    return await doRecursion(item, names);
                }
            } else {
                if (names[0] === item.file.name) {
                    names.splice(0, 1);
                    return await doRecursion(item, names);
                }
            }
        }
    }
});