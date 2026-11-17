'use strict';

const _ = require('lodash');
const assert = require('assert');
const dookie = require('../');
const fs = require('fs');
const mongodb = require('mongodb');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

describe('dookie:push', function() {
  const uri = 'mongodb://localhost:27017/test';
  let client;
  let db;

  before(async function() {
    client = await mongodb.MongoClient.connect(uri);
    db = client.db();
  });

  after(async function() {
    await client.close();
  });

  it('inserts documents', async function() {
    await dookie.push(uri, { 'sample': [{ x: 1 }] }, { dropDatabase: true });

    const docs = await db.collection('sample').find({}).toArray();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].x, 1);
  });

  it('converts extended JSON and keeps dates', async function() {
    const toInsert = {
      sample: [
        {
          _id: { $oid: '561d87b8b260cf35147998ca' },
          createdAt: new Date('2020-01-01T00:00:00.000Z'),
          updatedAt: { $date: '2021-01-01T00:00:00.000Z' }
        }
      ]
    };

    await dookie.push(uri, toInsert, { dropDatabase: true });

    const docs = await db.collection('sample').find({}).toArray();
    assert.equal(docs.length, 1);
    assert.ok(docs[0]._id instanceof mongodb.ObjectId);
    assert.equal(docs[0]._id.toHexString(), '561d87b8b260cf35147998ca');
    assert.ok(docs[0].createdAt instanceof Date);
    assert.equal(docs[0].createdAt.toISOString(), '2020-01-01T00:00:00.000Z');
    assert.ok(docs[0].updatedAt instanceof Date);
    assert.equal(docs[0].updatedAt.toISOString(), '2021-01-01T00:00:00.000Z');
  });

  it('$extend syntax', async function() {
    const toInsert = {
      $test: { a: 1, b: 2 },
      sample: [
        { $extend: '$test', x: 1, b: 3 }
      ]
    };

    await dookie.push(uri, toInsert, { dropDatabase: true });

    const docs = await db.collection('sample').find({}).toArray();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].x, 1);
    assert.equal(docs[0].a, 1);
    assert.equal(docs[0].b, 3);
  });

  it('recursive $extend syntax', async function() {
    const toInsert = {
      $base: { c: 1 },
      $test: { a: 1, b: { $extend: '$base' } },
      sample: [
        { x: { $extend: '$test' } }
      ]
    };

    await dookie.push(uri, toInsert, { dropDatabase: true });

    const docs = await db.collection('sample').find({}).toArray();

    assert.equal(docs.length, 1);
    assert.deepEqual(docs[0].x, { a: 1, b: { c: 1 } });
  });

  it('$require syntax', async function() {
    const filename = './example/$require/parent.yml';
    const toInsert = yaml.safeLoad(fs.readFileSync(filename));

    await db.dropDatabase();
    await dookie.push(uri, toInsert, filename);

    const people = await db.collection('people').find({}).toArray();
    assert.equal(people.length, 1);
    assert.equal(people[0]._id, 'Axl Rose');

    const bands = await db.collection('bands').find({}).toArray();
    assert.equal(bands.length, 1);
    assert.equal(bands[0]._id, `Guns N' Roses`);
  });

  it('$eval syntax', async function() {
    const toInsert = {
      sample: [
        { a: 1, b: { $eval: 'this.a;' } }
      ]
    };

    await dookie.push(uri, toInsert, { dropDatabase: true });

    const docs = await db.collection('sample').find({}).toArray();

    assert.equal(docs.length, 1);
    assert.deepEqual(_.omit(docs[0], '_id'), { a: 1, b: 1 });
  });

  it('dropDatabase option', async function() {
    const toInsert = {
      sample: [
        { a: 1 }
      ]
    };

    await dookie.push(uri, _.cloneDeep(toInsert), { dropDatabase: true });
    await dookie.push(uri, _.cloneDeep(toInsert));

    const docs = await db.collection('sample').find({}).toArray();
    assert.equal(docs.length, 2);
  });
});

describe('dookie:pull', function() {
  const uri = 'mongodb://localhost:27017/test2';
  let client;
  let db;

  before(async function() {
    client = await mongodb.MongoClient.connect(uri);
    db = client.db();
  });

  after(async function() {
    await client.close();
  });

  it('exports documents', async function() {
    await db.dropDatabase();
    await db.collection('sample').insertOne({ x: 1 });

    const results = await dookie.pull(uri);

    assert.equal(Object.keys(results).length, 1);
    assert.equal(results.sample.length, 1);
    assert.equal(results.sample[0].x, 1);
    assert.ok(results.sample[0]._id.$oid);
  });
});

describe('dookie:pullToFile', function() {
  const uri = 'mongodb://localhost:27017/test3';
  let client;
  let db;
  let filename;

  before(async function() {
    client = await mongodb.MongoClient.connect(uri);
    db = client.db();
    filename = path.join(os.tmpdir(), `dookie-${process.pid}.json`);
  });

  after(async function() {
    await client.close();
    await fs.promises.rm(filename, { force: true });
  });

  beforeEach(async function() {
    await db.dropDatabase();
    await db.collection('sample').insertOne({
      _id: new mongodb.ObjectId('561d87b8b260cf35147998ca'),
      x: 1,
      createdAt: new Date('2020-01-01T00:00:00.000Z')
    });
    await db.collection('other').insertOne({ _id: 'test', y: 2 });
  });

  it('writes one JSON document per line with $oid', async function() {
    await dookie.pullToFile(uri, { sample: {} }, filename);

    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    assert.deepEqual(lines, [
      '{"$collection":"sample"}',
      '{"_id":{"$oid":"561d87b8b260cf35147998ca"},"x":1,"createdAt":{"$date":"2020-01-01T00:00:00Z"}}',
      ''
    ]);
  });

  it('pulls all collections if collections is null', async function() {
    await dookie.pullToFile(uri, null, filename);

    const lines = fs.readFileSync(filename, 'utf8').trim().split('\n').
      map(line => JSON.parse(line));
    const collectionNames = lines.filter(line => line.$collection).
      map(line => line.$collection).sort();
    assert.deepEqual(collectionNames, ['other', 'sample']);
    assert.equal(lines.length, 4);
  });

  it('round trips with pushFromFile()', async function() {
    await dookie.pullToFile(uri, null, filename);
    await dookie.pushFromFile(uri, filename);

    const docs = await db.collection('sample').find({}).toArray();
    assert.deepEqual(docs, [{
      _id: new mongodb.ObjectId('561d87b8b260cf35147998ca'),
      x: 1,
      createdAt: new Date('2020-01-01T00:00:00.000Z')
    }]);
    const others = await db.collection('other').find({}).toArray();
    assert.deepEqual(others, [{ _id: 'test', y: 2 }]);
  });
});
