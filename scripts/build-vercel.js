'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
// Only explicitly public assets are copied. Never publish the project root.
const files = ['index.html','ppdb.html','admin.html','publication.html',
  'style.css','script.js','ppdb.css','ppdb.js','admin.js','school.js',
  'api-client.js','school.css','school-admin.js'];
function build() {
  fs.mkdirSync(output, { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(root,file),path.join(output,file));
  fs.cpSync(path.join(root,'assets','school'),path.join(output,'assets','school'),{recursive:true});
  console.log('Public website assets prepared; environment files and database excluded.');
}
if (require.main === module) build();
module.exports = { build, files };
