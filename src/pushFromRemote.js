'use strict';

const mongodb = require('mongodb');
const ns = require('mongodb-ns');

module.exports = async function pushFromFile(localUri, remoteUri, collections) {
  const local = await mongodb.MongoClient.connect(localUri).then(client => client.db());
  const remote = await mongodb.MongoClient.connect(remoteUri).then(client => client.db());

  await local.dropDatabase();

  if (collections == null) {
    const collectionNames = await db.listCollections();
    // Convert `['foo', 'bar']` into `{ foo: {}, bar: {} }`
    collections = collectionNames.
      reduce((res, coll) => Object.assign(res, { [coll.name]: {} }), {});
  }

  for (const name of Object.keys(collections)) {
    let namespace = ns(`test.${name}`);
    if (namespace.system || namespace.oplog || namespace.special) {
      continue;
    }

    const cursor = remote.collection(name).find(collections[name]);
    for (let doc = await cursor.next();
        doc != null;
        doc = await cursor.next()) {
      local.collection(name).insertOne(doc);
    }
  }
};