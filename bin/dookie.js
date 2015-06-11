#!/usr/bin/env node

var commander = require('commander');
var dookie = require('../');
var fs = require('fs');

commander.
  usage('dookie (pull|push) --file <file> --db <database name>').
  option('-f, --file <file>', 'File to read/write from').
  option('-d, --db <database>', 'Database to read/write from').
  parse(process.argv);

var cmd = process.argv[2];
if (!cmd || ['pull', 'push'].indexOf(cmd) === -1) {
  console.log('Must specify either pull (pull data from db into file) ' +
    'or push (push data into db from file).');
  process.exit(1);
}

if (!commander.file) {
  console.log('Must specify --file');
  process.exit(1);
}

if (!commander.db) {
  console.log('Must specify --db');
  process.exit(1);
}

if (cmd === 'pull') {
  console.log('Writing data from ' + commander.db + ' to ' +
    commander.file);
  dookie.pull('mongodb://localhost:27017/' + commander.db, function(error, data) {
    if (error) {
      console.log('Error reading data: ' + error);
      process.exit(1);
    }
    fs.writeFileSync(commander.file, JSON.stringify(data, null, '  '));
    console.log('Success!');
    process.exit(0);
  });
}
