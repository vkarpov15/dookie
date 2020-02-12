'use strict';

const ejson = require('mongodb-extended-json');
const fs = require('fs');
const jsonstream = require('json-stream');
const mongodb = require('mongodb');

module.exports = async function pushFromFile(uri, filename) {
  const client = await mongodb.MongoClient.connect(uri);
  const db = client.db();

  await db.dropDatabase();

  const stream = fs.createReadStream(filename).pipe(jsonstream());
  let collection;

  return new Promise((resolve, reject) => {
    stream.on('data', obj => {
      if (obj.$collection) {
        collection = obj.$collection;
        return;
      }

      db.collection(collection).insertOne(ejson.deserialize(obj)).
        catch(err => reject(err));
    });

    stream.on('end', () => resolve());
    stream.on('error', err => reject(err));
  });
};