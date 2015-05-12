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
    callback(error, db);
  });
});

wagner.task('push', function(drop, data, callback) {
  var db = drop;
  wagner.parallel(data, function(docs, collection, callback) {
    _.each(docs, function(doc, index) {
      docs[index] = ejson.deflate(doc);
    });
    db.collection(collection).insert(docs, callback);
  }, callback);
});

wagner.task('pull', function(db, callback) {
  db.listCollections().toArray(function(error, collections) {
    if (error) {
      return callback(error);
    }

    wagner.parallel(collections, function(collection, index, callback) {
      if (collection.name === 'system.indexes') {
        return callback(null, null);
      }

      db.collection(collection.name).find({}).toArray(function(error, docs) {
        if (error) {
          return callback(error);
        }
        _.each(docs, function(doc, index) {
          docs[index] = ejson.inflate(doc);
        });

        callback(null, docs);
      });
    }, function(error, results) {
      if (error) {
        return callback(error);
      }
      var ret = {};
      for (var i = 0; i < collections.length; ++i) {
        if (results[i]) {
          ret[collections[i].name] = results[i];
        }
      }
      callback(null, ret);
    });
  });
});

exports.push = function(uri, data, callback) {
  wagner.invokeAsync(function(error, push) {
    callback(error, push);
  }, { uri: uri, data: data });
};

exports.pull = function(uri, callback) {
  wagner.invokeAsync(function(error, pull) {
    callback(error, pull);
  }, { uri: uri });
};