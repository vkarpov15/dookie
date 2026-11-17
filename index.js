'use strict';

const { EJSON } = require('mongodb').BSON;
const dot = require('dot-component');
const fs = require('fs');
const mongodb = require('mongodb');
const ns = require('mongodb-ns');
const path = require('path');
const vm = require('vm');
const yaml = require('js-yaml');

function standardizePushOptions(options) {
  if (!options) {
    return {};
  }
  if (typeof options === 'string') {
    return { filename: options };
  }
  return structuredClone(options);
}

async function push(uri, data, options) {
  const client = await mongodb.MongoClient.connect(uri);
  try {
    const db = client.db();
    options = standardizePushOptions(options);

    if (options.dropDatabase === true) {
      await db.dropDatabase();
    }

    // $require
    for (const key in data) {
      if (key === '$require') {
        const filename = options.filename;
        if (!filename) {
          throw new Error(`Can't $require without specifying a filename`);
        }

        const directory = path.dirname(filename);
        const extension = path.extname(filename);
        const fileToRead = path.join(directory, data[key]);
        const fileContents = await fs.promises.readFile(fileToRead);
        const parsedContents = {
          '.yml': () => yaml.safeLoad(fileContents),
          '.json': () => JSON.parse(fileContents)
        }[extension]();
        for (const _key in parsedContents) {
          if (data[_key] && !_key.startsWith('$') &&
              Array.isArray(data[_key]) && Array.isArray(parsedContents[_key])) {
            data[_key] = parsedContents[_key].concat(data[_key]);
          } else {
            data[_key] = parsedContents[_key];
          }
        }
      }
    }

    // extensions
    let extensions = {};
    for (const key in data) {
      if (key[0] !== '$') {
        continue;
      }
      extensions[key] = data[key];
      delete data[key];
    }

    // insert
    let promises = [];
    for (const collection in data) {
      let docs = data[collection];
      if (docs.length === 0) {
        continue;
      }
      for (let i = 0; i < docs.length; ++i) {
        const doc = docs[i];
        expand(extensions, doc);
        const tmp = doc.$set;
        delete doc.$set;
        for (const key in tmp) {
          dot.set(doc, key, tmp[key]);
        }

        // Serialize first so values that are already BSON types, like dates
        // from YAML or `$eval`, survive `deserialize()`'s `JSON.stringify()`
        docs[i] = EJSON.deserialize(EJSON.serialize(doc));
      }
      promises.push(db.collection(collection).insertMany(docs));
    }
    return await Promise.all(promises);
  } finally {
    await client.close();
  }
}

function expand(extensions, doc) {
  if (doc.$extend) {
    const tmp = doc.$extend;
    delete doc.$extend;
    for (const key in extensions[tmp]) {
      if (typeof doc[key] === 'undefined') {
        doc[key] = structuredClone(extensions[tmp][key]);
      }
    }
  }

  Object.keys(doc).forEach(function(key) {
    if (doc[key] && typeof doc[key] === 'object') {
      if (doc[key].$eval) {
        const _doc = structuredClone(doc);
        _doc.require = v => require(v);
        const context = vm.createContext(_doc);
        doc[key] = vm.runInContext(doc[key].$eval, context);
      }
      expand(extensions, doc[key]);
    }
  });
}

async function pull(uri) {
  const client = await mongodb.MongoClient.connect(uri);
  try {
    const db = client.db();

    const collections = await db.listCollections().toArray();

    let promises = [];
    let filteredCollections = [];
    for (let i = 0; i < collections.length; ++i) {
      let namespace = ns(`test.${collections[i].name}`);
      if (namespace.system || namespace.oplog || namespace.special) {
        continue;
      }
      filteredCollections.push(collections[i].name);
      promises.push(db.collection(collections[i].name).find({}).toArray());
    }

    const contents = await Promise.all(promises);
    let res = {};

    filteredCollections.forEach(function(collection, i) {
      res[collection] = contents[i].map(doc => EJSON.serialize(doc));
    });

    return res;
  } finally {
    await client.close();
  }
}

exports.push = function(uri, data, pathOrOptions) {
  return push(uri, data, pathOrOptions);
};

exports.pull = function(uri) {
  return pull(uri);
};

exports.pullToFile = require('./src/pullToFile');
exports.pushFromFile = require('./src/pushFromFile');
exports.pushFromRemote = require('./src/pushFromRemote');
