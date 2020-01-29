'use strict';

const ejson = require('mongodb-extended-json');
const fs = require('fs').promises; // Requires Node.js 10
const mongodb = require('mongodb');

module.exports = async function pushFromFile(uri, filename) {
  const client = await mongodb.MongoClient.connect(uri);
  const db = client.db();

  await db.dropDatabase();

  const handle = await fs.open(filename, 'r');
  let collection;
  let cur = '';

  while (true) {
    const buf = Buffer.alloc(1000);
    await handle.read(buf, 0, 1000);

    const read = buf.toString('utf8');
    cur += read;
    if (!read.indexOf('\n')) {
      continue;
    }

    const sp = cur.split('\n');
    for (let line of sp.slice(0, sp.length - 1)) {
      const data = JSON.parse(line);
      if (data.$collection != null) {
        collection = data.$collection;
      } else {
        if (collection == null) {
          throw new Error('No collection!');
        }
        await db.collection(collection).insertOne(ejson.deserialize(data));
      }
    }

    cur = sp[sp.length - 1];
  }
};