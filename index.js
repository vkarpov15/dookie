'use strict';

const clone = require('clone');
const co = require('co');
const dot = require('dot-component');
const ejson = require('mongodb-extended-json');
const fs = require('fs');
const mongodb = require('mongodb');
const ns = require('mongodb-ns');
const path = require('path');
const thunkify = require('thunkify');
const vm = require('vm');
const yaml = require('js-yaml');

function push(uri, data, filename) {
  return co(function*() {
    const db = yield mongodb.MongoClient.connect(uri);

    yield db.dropDatabase();
    // $require
    for (const key in data) {
      if (key === '$require') {
        if (!filename) {
          throw new Error(`Can't $require without specifying a filename`);
        }

        const directory = path.dirname(filename);
        const extension = path.extname(filename);
        const fileToRead = path.join(directory, data[key]);
        const fileContents = yield thunkify(fs.readFile)(fileToRead);
        const parsedContents = {
          '.yml': () => yaml.safeLoad(fileContents),
          '.json': () => JSON.parse(fileContents)
        }[extension]();
        for (const _key in parsedContents) {
          data[_key] = parsedContents[_key];
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
      for (let i = 0; i < docs.length; ++i) {
        const doc = docs[i];
        expand(extensions, doc);
        const tmp = doc.$set;
        delete doc.$set;
        for (const key in tmp) {
          dot.set(doc, key, tmp[key]);
        }

        docs[i] = ejson.deflate(doc);
      }
      promises.push(db.collection(collection).insert(docs));
    }

    const res = yield promises;
    return res;
  });
}

function expand(extensions, doc) {
  if (doc.$extend) {
    const tmp = doc.$extend;
    delete doc.$extend;
    for (const key in extensions[tmp]) {
      if (typeof doc[key] === 'undefined') {
        doc[key] = clone(extensions[tmp][key]);
      }
    }
  }

  Object.keys(doc).forEach(function(key) {
    if (typeof doc[key] === 'object') {
      if (doc[key].$eval) {
        const context = vm.createContext(doc);
        doc[key] = vm.runInContext(doc[key].$eval, context);
      }
      expand(extensions, doc[key]);
    }
  });
}

function pull(uri) {
  return co(function*() {
    const db = yield mongodb.MongoClient.connect(uri);

    const collections = yield db.listCollections().toArray();

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

    const contents = yield promises;
    let res = {};

    filteredCollections.forEach(function(collection, i) {
      res[collection] = contents[i];
    });

    return res;
  });
}

exports.push = function(uri, data, path) {
  return push(uri, data, path);
};

exports.pull = function(uri) {
  return pull(uri);
};
