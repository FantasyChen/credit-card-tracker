/**
 * Search performance testing script
 * Tests the new optimized search functionality against the old client-side search
 */

const { PrismaClient } = require('@prisma/client');
const { searchCards } = require('../src/lib/cardSearchUtils.ts');
const { searchCardsOptimized, hybridSearch } = require('../src/lib/search/optimizedSearch.ts');

const prisma = new PrismaClient();

async function testSearchPerformance() {
  console.log('🔍 Starting search performance tests...\n');

  // Test queries of varying complexity
  const testQueries = [
    'amex',
    'travel',
    'dining',
    'chase sapphire',
    'no annual fee',
    'cashback',
    'uber',
    'hotels',
    'business',
    'entertainment',
    'capital one',
    'wells fargo',
    'citi',
    'us bank',
    'barclays'
  ];

  try {
    // Get all cards for client-side testing
    console.log('📊 Fetching all predefined cards...');
    const allCards = await prisma.predefinedCard.findMany({
      include: {
        benefits: {
          orderBy: { maxAmount: 'desc' },
        },
      },
    });
    console.log(`✅ Loaded ${allCards.length} cards with benefits\n`);

    // Test results storage
    const results = {
      clientSide: [],
      optimized: [],
      hybrid: [],
    };

    // Run tests for each query
    for (const query of testQueries) {
      console.log(`🧪 Testing query: "${query}"`);
      
      // Test client-side search
      const clientStart = performance.now();
      const clientResults = searchCards(allCards, query);
      const clientTime = performance.now() - clientStart;
      results.clientSide.push({
        query,
        time: clientTime,
        resultCount: clientResults.length,
      });

      // Test optimized search
      const optimizedStart = performance.now();
      const optimizedResults = await searchCardsOptimized(query, { limit: 50 });
      const optimizedTime = performance.now() - optimizedStart;
      results.optimized.push({
        query,
        time: optimizedTime,
        resultCount: optimizedResults.length,
      });

      // Test hybrid search
      const hybridStart = performance.now();
      const hybridResults = await hybridSearch(query, { limit: 50 });
      const hybridTime = performance.now() - hybridStart;
      results.hybrid.push({
        query,
        time: hybridTime,
        resultCount: hybridResults.length,
      });

      console.log(`  Client-side: ${clientTime.toFixed(2)}ms (${clientResults.length} results)`);
      console.log(`  Optimized:   ${optimizedTime.toFixed(2)}ms (${optimizedResults.length} results)`);
      console.log(`  Hybrid:      ${hybridTime.toFixed(2)}ms (${hybridResults.length} results)`);
      console.log('');
    }

    // Calculate averages
    const avgClientTime = results.clientSide.reduce((sum, r) => sum + r.time, 0) / results.clientSide.length;
    const avgOptimizedTime = results.optimized.reduce((sum, r) => sum + r.time, 0) / results.optimized.length;
    const avgHybridTime = results.hybrid.reduce((sum, r) => sum + r.time, 0) / results.hybrid.length;

    console.log('📈 Performance Summary:');
    console.log('='.repeat(50));
    console.log(`Average Client-side Time: ${avgClientTime.toFixed(2)}ms`);
    console.log(`Average Optimized Time:   ${avgOptimizedTime.toFixed(2)}ms`);
    console.log(`Average Hybrid Time:      ${avgHybridTime.toFixed(2)}ms`);
    console.log('');
    
    const optimizedImprovement = ((avgClientTime - avgOptimizedTime) / avgClientTime * 100);
    const hybridImprovement = ((avgClientTime - avgHybridTime) / avgClientTime * 100);
    
    console.log(`🚀 Optimized Search: ${optimizedImprovement > 0 ? '+' : ''}${optimizedImprovement.toFixed(1)}% improvement`);
    console.log(`🚀 Hybrid Search: ${hybridImprovement > 0 ? '+' : ''}${hybridImprovement.toFixed(1)}% improvement`);
    console.log('');

    // Test result quality (check if optimized results are reasonable)
    console.log('🔍 Result Quality Analysis:');
    console.log('='.repeat(50));
    
    for (const query of testQueries.slice(0, 5)) { // Test first 5 queries
      const clientResult = results.clientSide.find(r => r.query === query);
      const optimizedResult = results.optimized.find(r => r.query === query);
      const hybridResult = results.hybrid.find(r => r.query === query);
      
      console.log(`Query: "${query}"`);
      console.log(`  Client: ${clientResult.resultCount} results`);
      console.log(`  Optimized: ${optimizedResult.resultCount} results (${((optimizedResult.resultCount / clientResult.resultCount) * 100).toFixed(1)}% of client)`);
      console.log(`  Hybrid: ${hybridResult.resultCount} results (${((hybridResult.resultCount / clientResult.resultCount) * 100).toFixed(1)}% of client)`);
      console.log('');
    }

    // Memory usage test
    console.log('💾 Memory Usage Test:');
    console.log('='.repeat(50));
    
    const memBefore = process.memoryUsage();
    await hybridSearch('travel', { limit: 100 });
    const memAfter = process.memoryUsage();
    
    console.log(`Memory before: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Memory after:  ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Memory delta:  ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    console.log('✅ Search performance tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
if (require.main === module) {
  testSearchPerformance().catch(console.error);
}

module.exports = { testSearchPerformance };
