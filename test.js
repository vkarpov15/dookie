var assert = require('assert');
var dookie = require('./');
var mongodb = require('mongodb');

describe('dookie:push', function() {
  it('inserts documents', function(done) {
    var uri = 'mongodb://localhost:27017/test';
    dookie.push(uri, { 'sample': [{ x: 1 }] }, function(error, results) {
      assert.ifError(error);
      assert.ok(results.sample);
      mongodb.MongoClient.connect(uri, function(error, db) {
        assert.ifError(error);
        db.collection('sample').find({}).toArray(function(error, docs) {
          assert.ifError(error);
          assert.equal(docs.length, 1);
          assert.equal(docs[0].x, 1);
          done();
        });
      });
    });
  });

  it('$extend syntax', function(done) {
    var uri = 'mongodb://localhost:27017/test';

    var docs = {
      $test: { a: 1, b: 2 },
      sample: [
        { $extend: '$test', x: 1, b: 3 }
      ]
    };

    dookie.push(uri, docs, function(error, results) {
      assert.ifError(error);
      assert.ok(results.sample);
      mongodb.MongoClient.connect(uri, function(error, db) {
        assert.ifError(error);
        db.collection('sample').find({}).toArray(function(error, docs) {
          assert.ifError(error);
          assert.equal(docs.length, 1);
          assert.equal(docs[0].x, 1);
          assert.equal(docs[0].a, 1);
          assert.equal(docs[0].b, 3);
          done();
        });
      });
    });
  });

  it('recursive $extend syntax', function(done) {
    var uri = 'mongodb://localhost:27017/test';

    var docs = {
      $test: { a: 1, b: 2 },
      sample: [
        { x: { $extend: '$test' } }
      ]
    };

    dookie.push(uri, docs, function(error, results) {
      assert.ifError(error);
      assert.ok(results.sample);
      mongodb.MongoClient.connect(uri, function(error, db) {
        assert.ifError(error);
        db.collection('sample').find({}).toArray(function(error, docs) {
          assert.ifError(error);
          assert.equal(docs.length, 1);
          assert.deepEqual(docs[0].x, { a: 1, b: 2 });
          done();
        });
      });
    });
  });
});

describe('dookie:pull', function() {
  it('exports documents', function(done) {
    var uri = 'mongodb://localhost:27017/test2';
    mongodb.MongoClient.connect(uri, function(error, db) {
      assert.ifError(error);
      db.dropDatabase(function(error) {
        assert.ifError(error);
        db.collection('sample').insert({ x: 1 }, function(error) {
          assert.ifError(error);
          dookie.pull(uri).then(function(results) {
            assert.equal(Object.keys(results).length, 1);
            assert.equal(results.sample.length, 1);
            assert.equal(results.sample[0].x, 1);
            done();
          }).catch((error) => done(error));
        });
      });
    });
  });
});
