'use strict';

const assert = require('assert');
const co = require('co');
const dookie = require('../');
const mongodb = require('mongodb');

describe('dookie:push', function() {
  it('inserts documents', function*() {
    const uri = 'mongodb://localhost:27017/test';
    yield dookie.push(uri, { 'sample': [{ x: 1 }] });

    const db = yield mongodb.MongoClient.connect(uri);
    const docs = db.collection('sample').find({}).toArray();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].x, 1);
  });

  it('$extend syntax', function*() {
    const uri = 'mongodb://localhost:27017/test';

    const toInsert = {
      $test: { a: 1, b: 2 },
      sample: [
        { $extend: '$test', x: 1, b: 3 }
      ]
    };

    yield dookie.push(uri, toInsert);

    const db = mongodb.MongoClient.connect(uri);
    const docs = db.collection('sample').find({}).toArray();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].x, 1);
    assert.equal(docs[0].a, 1);
    assert.equal(docs[0].b, 3);
  });

  it('recursive $extend syntax', function*() {
    const uri = 'mongodb://localhost:27017/test';

    const toInsert = {
      $test: { a: 1, b: 2 },
      sample: [
        { x: { $extend: '$test' } }
      ]
    };

    yield dookie.push(uri, toInsert);

    const db = mongodb.MongoClient.connect(uri);
    const docs = db.collection('sample').find({}).toArray();

    assert.ifError(error);
    assert.equal(docs.length, 1);
    assert.deepEqual(docs[0].x, { a: 1, b: 2 });
  });
});

describe('dookie:pull', function() {
  it('exports documents', function*() {
    const uri = 'mongodb://localhost:27017/test2';

    const db = yield mongodb.MongoClient.connect(uri);
    yield db.dropDatabase();
    yield db.collection('sample').insert({ x: 1 });

    const results = dookie.pull(uri);

    assert.equal(Object.keys(results).length, 1);
    assert.equal(results.sample.length, 1);
    assert.equal(results.sample[0].x, 1);
  });
});
