'use strict';

const assert = require('assert');
const co = require('co');
const dookie = require('../');
const mongodb = require('mongodb');

/**
 * Dookie can be used either via `require('dookie');` in Node.js, or from the
 * command line as an executable. Dookie's fundamental operations are:
 *
 * 1. Push - clear out a database and insert some data
 * 2. Pull - write the contents of a database to a file
 *
 * Push is more interesting, so let's start with that. You can access the
 * push functionality with the `require('dookie').push()` function, or
 * `./node_modules/.bin/dookie push` from the command line.
 */
describe('Examples', function() {
  /**
   * Suppose you have a YAML file called `file.yml` that looks like below.
   *
   * @import:example/basic/file.yml
   *
   * Dookie can push this file to MongoDB for you.
   */
  it('can import YAML data with .push()', function(done) {
    co(function*() {
      const fs = require('fs');
      const yaml = require('js-yaml');

      const contents = fs.readFileSync('./example/basic/file.yml');
      const parsed = yaml.safeLoad(contents);

      const mongodbUri = 'mongodb://localhost:27017/test';
      // Insert data into dookie
      // Or, at the command line:
      // `dookie push --db test --file ./example/basic/file.yml`
      yield dookie.push(mongodbUri, parsed);

      const db = yield mongodb.MongoClient.connect(mongodbUri);
      const collections = yield db.listCollections().toArray();
      assert.equal(collections.length, 3);
      assert.equal(collections[0].name, 'bands');
      assert.equal(collections[1].name, 'people');
      // MongoDB built-in collection
      assert.equal(collections[2].name, 'system.indexes');

      const people = yield db.collection('people').find().toArray();
      people.forEach((person) => { person._id = person._id.toString() });
      assert.deepEqual(people, [
        { _id: '561d87b8b260cf35147998ca', name: 'Axl Rose' },
        { _id: '561d88f5b260cf35147998cb', name: 'Slash' }
      ]);
      const bands = yield db.collection('bands').find().toArray();
      assert.deepEqual(bands, [
        { _id: `Guns N' Roses`, members: ['Axl Rose', 'Slash'] }
      ]);
      // acquit:ignore:start
      done();
      // acquit:ignore:end
    })
    // acquit:ignore:start
    .catch((error) => done(error));
    // acquit:ignore:end
  });
});
