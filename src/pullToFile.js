'use strict';

const mongodb = require('mongodb');
const ejson = require('mongodb-extended-json');
const fs = require('fs');
const ns = require('mongodb-ns');

module.exports = async function pullToFile(uri, collections, path) {
  const client = await mongodb.MongoClient.connect(uri);
  const db = client.db();
  const stream = fs.createWriteStream(path);

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
    stream.write(`{ "$collection": "${name}" }\n`);

    const cursor = db.collection(name).find(collections[name]);
    for (let doc = await cursor.next();
        doc != null;
        doc = await cursor.next()) {
      stream.write('  ' + JSON.stringify(ejson.serialize(doc)) + '\n');
    }
  }
}