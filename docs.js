'use strict';

const acquit = require('acquit');
const fs = require('fs');

require('acquit-ignore')();
require('acquit-markdown')();

const header = fs.readFileSync('./HEADER.md', 'utf8');
let markdown =
  acquit.parse(fs.readFileSync('./test/examples.test.js', 'utf8'));

const re = new RegExp('@import:[\\S]+', 'g');
markdown.match(re).forEach(function(statement) {
  const file = statement.substr('@import:'.length);
  const data = fs.readFileSync(file, 'utf8');
  markdown = markdown.replace(statement, '```yaml\n' + data + '\n```');
});

fs.writeFileSync('./README.md', `${header}\n\n${markdown}`);
