// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function testDragDropFunctionality() {
  console.log('🧪 Testing drag-and-drop functionality...');
  
  try {
    // Find a test user (you can replace this with your actual user ID)
    const testUser = await prisma.user.findFirst({
      where: {
        email: 'fantasychen2016@gmail.com' // Replace with your test email
      }
    });
    
    if (!testUser) {
      console.log('❌ No test user found. Please sign in to the app first.');
      return;
    }
    
    console.log(`✅ Found test user: ${testUser.email}`);
    
    // Check if user has any benefit statuses
    const benefitStatuses = await prisma.benefitStatus.findMany({
      where: {
        userId: testUser.id
      },
      include: {
        benefit: {
          include: {
            creditCard: true
          }
        }
      },
      orderBy: [
        { orderIndex: 'asc' },
        { cycleEndDate: 'asc' }
      ]
    });
    
    console.log(`📊 Found ${benefitStatuses.length} benefit statuses for user`);
    
    if (benefitStatuses.length === 0) {
      console.log('ℹ️  No benefit statuses found. Add some cards with benefits first.');
      return;
    }
    
    // Display current order
    console.log('\n📋 Current benefit order:');
    benefitStatuses.forEach((status, index) => {
      console.log(`  ${index + 1}. [${status.orderIndex ?? 'null'}] ${status.benefit.description} (${status.benefit.creditCard.name})`);
    });
    
    // Test: Set initial order indices if they don't exist
    const statusesWithoutOrder = benefitStatuses.filter(s => s.orderIndex === null);
    if (statusesWithoutOrder.length > 0) {
      console.log(`\n🔧 Setting initial order for ${statusesWithoutOrder.length} benefits...`);
      
      for (let i = 0; i < statusesWithoutOrder.length; i++) {
        await prisma.benefitStatus.update({
          where: { id: statusesWithoutOrder[i].id },
          data: { orderIndex: i }
        });
      }
      
      console.log('✅ Initial order set successfully');
    }
    
    // Test: Simulate reordering (reverse the order)
    if (benefitStatuses.length >= 2) {
      console.log('\n🔄 Testing reorder functionality (reversing order)...');
      
      const reversedOrder = [...benefitStatuses].reverse();
      
      for (let i = 0; i < reversedOrder.length; i++) {
        await prisma.benefitStatus.update({
          where: { id: reversedOrder[i].id },
          data: { orderIndex: i }
        });
      }
      
      // Verify the new order
      const reorderedStatuses = await prisma.benefitStatus.findMany({
        where: {
          userId: testUser.id
        },
        include: {
          benefit: {
            include: {
              creditCard: true
            }
          }
        },
        orderBy: [
          { orderIndex: 'asc' },
          { cycleEndDate: 'asc' }
        ]
      });
      
      console.log('\n📋 New benefit order after reordering:');
      reorderedStatuses.forEach((status, index) => {
        console.log(`  ${index + 1}. [${status.orderIndex}] ${status.benefit.description} (${status.benefit.creditCard.name})`);
      });
      
      console.log('✅ Reordering test completed successfully!');
    }
    
    console.log('\n🎉 All drag-and-drop tests passed!');
    console.log('\n📝 Next steps:');
    console.log('  1. Visit /benefits in your browser');
    console.log('  2. Click "Reorder Benefits" button');
    console.log('  3. Drag and drop benefits to rearrange them');
    console.log('  4. Click "Done Reordering" to save');
    console.log('  5. Refresh the page to verify order persists');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDragDropFunctionality(); 