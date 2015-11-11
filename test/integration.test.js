'use strict';

const assert = require('assert');
const co = require('co');
const dookie = require('../');
const fs = require('fs');
const mongodb = require('mongodb');
const yaml = require('js-yaml');

describe('dookie:push', function() {
  it('inserts documents', function(done) {
    co(function*() {
      const uri = 'mongodb://localhost:27017/test';
      yield dookie.push(uri, { 'sample': [{ x: 1 }] });

      const db = yield mongodb.MongoClient.connect(uri);
      const docs = yield db.collection('sample').find({}).toArray();
      assert.equal(docs.length, 1);
      assert.equal(docs[0].x, 1);

      done();
    }).catch((error) => done(error));
  });

  it('$extend syntax', function(done) {
    co(function*() {
      const uri = 'mongodb://localhost:27017/test';

      const toInsert = {
        $test: { a: 1, b: 2 },
        sample: [
          { $extend: '$test', x: 1, b: 3 }
        ]
      };

      yield dookie.push(uri, toInsert);

      const db = yield mongodb.MongoClient.connect(uri);
      const docs = yield db.collection('sample').find({}).toArray();
      assert.equal(docs.length, 1);
      assert.equal(docs[0].x, 1);
      assert.equal(docs[0].a, 1);
      assert.equal(docs[0].b, 3);

      done();
    }).catch((error) => done(error));
  });

  it('recursive $extend syntax', function(done) {
    co(function*() {
      const uri = 'mongodb://localhost:27017/test';

      const toInsert = {
        $base: { c: 1 },
        $test: { a: 1, b: { $extend: '$base' } },
        sample: [
          { x: { $extend: '$test' } }
        ]
      };

      yield dookie.push(uri, toInsert);

      const db = yield mongodb.MongoClient.connect(uri);
      const docs = yield db.collection('sample').find({}).toArray();

      assert.equal(docs.length, 1);
      assert.deepEqual(docs[0].x, { a: 1, b: { c: 1 } });

      done();
    }).catch((error) => done(error));
  });

  it('$require syntax', function(done) {
    co(function*() {
      const uri = 'mongodb://localhost:27017/test';

      const path = './example/$require/parent.yml';
      const toInsert = yaml.safeLoad(fs.readFileSync(path));

      yield dookie.push(uri, toInsert, path);

      const db = yield mongodb.MongoClient.connect(uri);
      const people = yield db.collection('people').find({}).toArray();
      assert.equal(people.length, 1);
      assert.equal(people[0]._id, 'Axl Rose');

      const bands = yield db.collection('bands').find({}).toArray();
      assert.equal(bands.length, 1);
      assert.equal(bands[0].name, `Guns N' Roses`);

      done();
    }).catch((error) => done(error));
  });
});

describe('dookie:pull', function() {
  it('exports documents', function(done) {
    co(function*() {
      const uri = 'mongodb://localhost:27017/test2';

      const db = yield mongodb.MongoClient.connect(uri);
      yield db.dropDatabase();
      yield db.collection('sample').insert({ x: 1 });

      const results = yield dookie.pull(uri);

      assert.equal(Object.keys(results).length, 1);
      assert.equal(results.sample.length, 1);
      assert.equal(results.sample[0].x, 1);

      done();
    }).catch((error) => done(error));
  });
});
