// backend/src/test-fastpath.ts
import 'dotenv/config';
import { rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runHudCorrelation } from './agent/correlation-run-service.js';

async function runTest() {
  console.log('================================================');
  console.log('🚀 Parallax Fast Path & Correlation Pipeline Test');
  console.log('================================================\n');

  const reportsDir = resolve(process.cwd(), 'reports');
  
  // 1. 清理缓存，模拟全新环境
  if (existsSync(reportsDir)) {
    console.log('🧹 Clearing cache (reports/ directory) for a clean test...');
    rmSync(reportsDir, { recursive: true, force: true });
  }

  const fredKey = process.env.FRED_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  console.log('\n------------------------------------------------');
  console.log('🧪 TEST 1: Single Event - INITIAL RUN (Slow Path)');
  console.log('------------------------------------------------');
  const res1 = await runHudCorrelation({
    eventIds: ['spacex-ipo-q1'],
    fredApiKey: fredKey,
    geminiApiKey: geminiKey,
  });
  console.log(`=> Status: [ ${res1.status} ] (Expected: live_generated or cache_miss)`);
  console.log(`=> Reports ready: ${res1.reports.length}`);

  console.log('\n------------------------------------------------');
  console.log('⚡ TEST 2: Single Event - SECOND RUN (Fast Path)');
  console.log('------------------------------------------------');
  const res2 = await runHudCorrelation({
    eventIds: ['spacex-ipo-q1'],
  });
  console.log(`=> Status: [ ${res2.status} ]`);
  if (res2.status !== 'cache_hit') {
    throw new Error('❌ Failed: Single event did not hit Fast Path!');
  }
  console.log('=> ✅ Fast path successfully bypassed Gemini and acquisition!');

  console.log('\n------------------------------------------------');
  console.log('🧪 TEST 3: Multi Event - INITIAL RUN (Slow Path)');
  console.log('------------------------------------------------');
  // 添加一个新事件 cpi-jun-2026，系统必须去生成新报告并合成 Combined Dossier
  const res3 = await runHudCorrelation({
    eventIds: ['spacex-ipo-q1', 'cpi-jun-2026'],
    fredApiKey: fredKey,
    geminiApiKey: geminiKey,
  });
  console.log(`=> Status: [ ${res3.status} ] (Expected: live_generated)`);
  console.log(`=> Combined Dossier Cached: ${res3.cache.combined_cached}`);

  console.log('\n------------------------------------------------');
  console.log('⚡ TEST 4: Multi Event - SECOND RUN (Fast Path)');
  console.log('------------------------------------------------');
  const res4 = await runHudCorrelation({
    eventIds: ['spacex-ipo-q1', 'cpi-jun-2026'],
  });
  console.log(`=> Status: [ ${res4.status} ]`);
  if (res4.status !== 'cache_hit') {
    throw new Error('❌ Failed: Multi event did not hit Fast Path!');
  }
  console.log(`=> Combined Dossier Cached: ${res4.cache.combined_cached}`);
  console.log('=> ✅ Fast path successfully bypassed ALL generation!');

  console.log('\n================================================');
  console.log('🏆 ALL TESTS PASSED! The Fast Path is rock solid.');
  console.log('================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});