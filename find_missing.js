const fs = require('fs');
const path = require('path');
const en = JSON.parse(fs.readFileSync('frontend/src/locales/en.json', 'utf8'));
const ko = JSON.parse(fs.readFileSync('frontend/src/locales/ko.json', 'utf8'));

function getNestedKeys(obj, prefix = '') {
  return Object.keys(obj).reduce((res, el) => {
    if (Array.isArray(obj[el])) return res;
    if (typeof obj[el] === 'object' && obj[el] !== null) {
      return [...res, ...getNestedKeys(obj[el], prefix + el + '.')];
    }
    return [...res, prefix + el];
  }, []);
}

const enKeys = new Set(getNestedKeys(en));
const koKeys = new Set(getNestedKeys(ko));

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  let usedKeys = new Map();
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      const nested = scanDir(fullPath);
      for (const [k, v] of nested.entries()) usedKeys.set(k, v);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = /t\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        usedKeys.set(match[1], match[2] || '');
      }
    }
  }
  return usedKeys;
}

const used = scanDir('frontend/src');
console.log('Used keys missing in KO:');
for (const [key, defaultText] of used.entries()) {
  if (!koKeys.has(key)) {
    console.log(key + ' -> ' + defaultText);
  }
}
