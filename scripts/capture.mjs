#!/usr/bin/env node
import { captureSet } from '../lib/capture.js';

const setId = process.argv[2] || '0001';

captureSet(setId)
  .then(saved => {
    console.log('\n✅ Capture complete');
    console.log('📁 Output files:');
    saved.forEach(p => console.log(`   ${p}`));
  })
  .catch(err => {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  });
