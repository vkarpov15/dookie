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
    if (key.substr(0, '@require:'.length) === '@require:') {
      var d = JSON.parse(fs.readFileSync(key.substr('@require:'.length)));
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
      if (doc.$extend) {
        var tmp = doc.$extend;
        delete doc.$extend;
        for (var key in extensions[tmp]) {
          if (typeof doc[key] === 'undefined') {
            doc[key] = extensions[tmp][key];
          }
        }
      }
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
