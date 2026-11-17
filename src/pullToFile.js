'use strict';

const { EJSON } = require('mongodb').BSON;
const fs = require('fs');
const mongodb = require('mongodb');
const ns = require('mongodb-ns');
const { pipeline } = require('stream/promises');

module.exports = async function pullToFile(uri, collections, path) {
  const client = await mongodb.MongoClient.connect(uri);
  try {
    const db = client.db();

    if (collections == null) {
      const collectionNames = await db.listCollections().toArray();
      // Convert `['foo', 'bar']` into `{ foo: {}, bar: {} }`
      collections = collectionNames.
        reduce((res, coll) => Object.assign(res, { [coll.name]: {} }), {});
    }

    // `pipeline()` handles backpressure and resolves once the file is
    // flushed and closed
    await pipeline(async function*() {
      for (const name of Object.keys(collections)) {
        let namespace = ns(`test.${name}`);
        if (namespace.system || namespace.oplog || namespace.special) {
          continue;
        }
        yield JSON.stringify({ $collection: name }) + '\n';

        for await (const doc of db.collection(name).find(collections[name])) {
          yield EJSON.stringify(doc) + '\n';
        }
      }
    }, fs.createWriteStream(path));
  } finally {
    await client.close();
  }
};
