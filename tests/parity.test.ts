import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateTaxSummary } from '../server/lib/taxCalculator';
import { computeSCorpComparison } from '../client/lib/scorpCalculations';
import * as tax from '../client/pages/TaxSavingsAnalyzer/utils/taxCalculations';
import { STRATEGIES } from '../client/pages/TaxSavingsAnalyzer/utils/strategyDefinitions';
const cases = JSON.parse(readFileSync('tests/fixtures/original-results.json','utf8'));
const functions: Record<string, Function> = { summary: calculateTaxSummary, scorp: computeSCorpComparison, ...Object.fromEntries(Object.entries(tax).filter(([,v])=>typeof v === 'function')),
 strategy: (id: string, inputs: any, plan: any) => STRATEGIES.find(s=>s.id===id)!.compute(inputs,plan) };
for (const [i,c] of cases.entries()) test(`Original output ${i}: ${c.engine}`,()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(functions[c.engine](...c.args))), c.expected);
});
const manifest = JSON.parse(readFileSync('docs/source-integrity.json','utf8'));
for (const [file,entry] of Object.entries(manifest) as [string,any][]) {
 if (entry.original !== entry.migrated) continue;
 test(`Original source: ${file}`,()=>assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),entry.original));
}
