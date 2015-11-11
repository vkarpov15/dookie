'use strict';

const clone = require('clone');
const co = require('co');
const dot = require('dot-component');
const emitter = require('events').EventEmitter;
const ejson = require('mongodb-extended-json');
const mongodb = require('mongodb');
const ns = require('mongodb-ns');
const thunkify = require('thunkify');

function push(uri, data) {
  return co(function*() {
    const db = yield mongodb.MongoClient.connect(uri);

    yield db.dropDatabase();
    // $require
    for (const key in data) {
      if (key === '$require') {
        const required = JSON.parse(yield thunkify(fs.readFile)(key));
        for (const _key of required) {
          data[_key] = required[key];
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

        docs[i] = ejson.inflate(doc);
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

exports.push = function(uri, data) {
  return push(uri, data);
};

exports.pull = function(uri) {
  return pull(uri);
};
