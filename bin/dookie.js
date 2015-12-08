#!/usr/bin/env node
'use strict';

const co = require('co');
const commander = require('commander');
const dookie = require('../');
const fs = require('fs');
const yaml = require('js-yaml');

commander.
  usage('dookie (pull|push) --file <file> --db <database name>').
  option('-f, --file <file>', 'File to read/write from').
  option('-d, --db <database>', 'Database to read/write from').
  option('-u, --uri <uri>', 'MongoDB URI to use (mongodb://localhost:27017 by default)').
  parse(process.argv);

const cmd = process.argv[2];
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
  console.log(`Writing data from ${commander.db} to ${commander.file}`);
  co(function*() {
    const res = yield dookie.pull(`mongodb://localhost:27017/${commander.db}`);
    fs.writeFileSync(commander.file, JSON.stringify(res, null, '  '));
    process.exit(0);
  }).
  catch(function(error) {
    console.log('Error reading data:', error);
    process.exit(1);
  });
} else if (cmd === 'push') {
  console.log(`Writing data from ${commander.file} to ${commander.db}`);

  co(function*() {
    const uri = commander.uri || 'mongodb://localhost:27017';
    const data = yaml.safeLoad(fs.readFileSync(commander.file));
    yield dookie.push(`${uri}/${commander.db}`, data,
      commander.file);

    console.log('Success!');
    process.exit(0);
  }).catch(function(error) {
    console.log('Error writing data', error);
    process.exit(1);
  });
} else {
  console.log(`Invalid command ${cmd}: must be 'push' or 'pull'`);
  process.exit(1);
}
