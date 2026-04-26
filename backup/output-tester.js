const fs = require('fs');
const { execSync } = require('child_process');

const implementation = `
function getEvenSorted(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.filter(n => n % 2 === 0).sort((a, b) => a - b);
}

console.log(getEvenSorted([5, 2, 8, 3, 10, 1]));
`;

fs.writeFileSync('implementation.js', implementation.trim());

const output = execSync('node implementation.js').toString();

fs.writeFileSync('output.txt', output);
