'use strict';

const { EJSON } = require('mongodb').BSON;
const fs = require('fs');
const mongodb = require('mongodb');
const readline = require('readline');

const batchSize = 1000;

module.exports = async function pushFromFile(uri, filename) {
  const client = await mongodb.MongoClient.connect(uri);
  try {
    const db = client.db();

    await db.dropDatabase();

    const lines = readline.createInterface({
      input: fs.createReadStream(filename),
      crlfDelay: Infinity
    });
    let collection;
    let docs = [];
    for await (const line of lines) {
      if (line.trim() === '') {
        continue;
      }
      const obj = EJSON.parse(line);
      if (obj.$collection) {
        if (docs.length > 0) {
          await db.collection(collection).insertMany(docs);
          docs = [];
        }
        collection = obj.$collection;
        continue;
      }

      docs.push(obj);
      if (docs.length >= batchSize) {
        await db.collection(collection).insertMany(docs);
        docs = [];
      }
    }
    if (docs.length > 0) {
      await db.collection(collection).insertMany(docs);
    }
  } finally {
    await client.close();
  }
};
