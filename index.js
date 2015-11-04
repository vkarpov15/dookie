'use strict';

let co = require('co');
var clone = require('clone');
var dot = require('dot-component');
var ejson = require('mongodb-extended-json');
var emitter = require('events').EventEmitter;
var mongodb = require('mongodb');
var ns = require('mongodb-ns');
var wagner = require('wagner-core')();
var _ = require('underscore');

wagner.task('db', function(uri, callback) {
  mongodb.MongoClient.connect(uri, callback);
});

wagner.task('drop', function(db, callback) {
  db.dropDatabase(function(error) {
    callback(error, null);
  });
});

wagner.task('push', function(db, drop, data, callback) {
  var extensions = {};

  for (var key in data) {
    if (key.substr(0, '$require:'.length) === '$require:') {
      var d = JSON.parse(fs.readFileSync(key.substr('$require:'.length)));
      for (var key in d) {
        if (typeof data[key] === 'undefined') {
          data[key] = d[key];
        }
      }
    }
  }

  for (var key in data) {
    if (key[0] !== '$') {
      continue;
    }

    extensions[key] = data[key];
    delete data[key];
  }

  wagner.parallel(data, function(docs, collection, callback) {
    _.each(docs, function(doc, index) {
      expand(extensions, doc);
      if (doc.$set) {
        var tmp = doc.$set;
        delete doc.$set;
        for (var key in tmp) {
          dot.set(doc, key, tmp[key]);
        }
      }

      docs[index] = ejson.deflate(doc);
    });
    db.collection(collection).insert(docs, callback);
  }, callback);
});

function expand(extensions, doc) {
  if (doc.$extend) {
    var tmp = doc.$extend;
    delete doc.$extend;
    for (var key in extensions[tmp]) {
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
    let db = yield mongodb.MongoClient.connect(uri);

    let collections = yield db.listCollections().toArray();

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

    let contents = yield promises;
    let res = {};

    filteredCollections.forEach(function(collection, i) {
      res[collection] = contents[i];
    });

    return res;
  });
}

exports.push = function(uri, data, callback) {
  wagner.invokeAsync(function(error, push) {
    callback(error, push);
  }, { uri: uri, data: data });
};

exports.pull = function(uri) {
  return pull(uri);
};
