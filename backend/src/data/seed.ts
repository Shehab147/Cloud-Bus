import { dataFile, resetData } from './store.js';

await resetData();
console.log(`Demo data reset in ${dataFile}. All demo records are prefixed with Demo or Fictional.`);
