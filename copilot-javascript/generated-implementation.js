const oFs = require('fs');
const oPath = require('path');

function getEvenSorted(aInput) {
    if (!Array.isArray(aInput)) {
        return [];
    }
    const aEven = aInput.filter(iVal => iVal % 2 === 0);
    aEven.sort((iA, iB) => iA - iB);
    return aEven;
}

const cCwd = process.cwd();
const aEntries = oFs.readdirSync(cCwd);
const aFilesFound = [];
let iTotalChars = 0;

for (let iIndex = 0; iIndex < aEntries.length; iIndex++) {
    const cFileName = aEntries[iIndex];
    if (cFileName === 'node_modules') {
        continue;
    }
    const cFilePath = oPath.join(cCwd, cFileName);
    try {
        const oStats = oFs.statSync(cFilePath);
        if (oStats.isFile()) {
            if (cFileName.endsWith('.js') || cFileName.endsWith('.md')) {
                const cContent = oFs.readFileSync(cFilePath, 'utf8');
                iTotalChars += cContent.length;
                aFilesFound.push(cFilePath);
            }
        }
    } catch (oErr) {
        continue;
    }
}

const aInputNumbers = [42, 11, 8, 103, 4, 1];
const aMathResult = getEvenSorted(aInputNumbers);

const oOutput = {
    filesFound: aFilesFound,
    totalChars: iTotalChars,
    mathResult: aMathResult
};

console.log(JSON.stringify(oOutput));