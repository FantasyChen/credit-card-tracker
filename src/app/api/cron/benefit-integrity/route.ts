import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Benefit Integrity Monitoring
 * 
 * Runs daily to detect benefit cycle assignment issues
 * This would have caught the Q3 -> Q1 date assignment bug
 */

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request (optional security check)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 Starting benefit integrity check...');

  try {
    const issues = await checkBenefitIntegrity();
    
    if (issues.length > 0) {
      console.error(`❌ Found ${issues.length} benefit integrity issues!`);
      
      // Send alert (in a real system, this would email admins)
      await sendIntegrityAlert(issues);
      
      return Response.json({ 
        status: 'issues_found', 
        issueCount: issues.length,
        issues: issues.slice(0, 5) // Return first 5 for debugging
      });
    }
    
    console.log('✅ No benefit integrity issues found');
    return Response.json({ 
      status: 'healthy', 
      issueCount: 0,
      message: 'All benefit cycles look correct'
    });

  } catch (error) {
    console.error('💥 Benefit integrity check failed:', error);
    return Response.json({ 
      error: 'Integrity check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function checkBenefitIntegrity() {
  const issues: Array<{
    type: string;
    description: string;
    benefitId: string;
    userId: string;
    userEmail: string;
    cycleInfo: string;
  }> = [];
  
  console.log('Checking quarterly benefit alignments...');
  
  // Check for quarterly mismatches (the bug we just fixed)
  const quarterlyIssues = await prisma.benefitStatus.findMany({
    where: {
      OR: [
        // Q1 benefits with non-January start dates
        {
          AND: [
            {
              benefit: { description: { contains: 'Q1: Jan-Mar' } }
            },
            {
              NOT: {
                cycleStartDate: {
                  gte: new Date('2025-01-01T00:00:00Z'),
                  lt: new Date('2025-02-01T00:00:00Z')
                }
              }
            }
          ]
        },
        // Q2 benefits with non-April start dates
        {
          AND: [
            {
              benefit: { description: { contains: 'Q2: Apr-Jun' } }
            },
            {
              NOT: {
                cycleStartDate: {
                  gte: new Date('2025-04-01T00:00:00Z'),
                  lt: new Date('2025-05-01T00:00:00Z')
                }
              }
            }
          ]
        },
        // Q3 benefits with non-July start dates (this was the main bug)
        {
          AND: [
            {
              benefit: { description: { contains: 'Q3: Jul-Sep' } }
            },
            {
              NOT: {
                cycleStartDate: {
                  gte: new Date('2025-07-01T00:00:00Z'),
                  lt: new Date('2025-08-01T00:00:00Z')
                }
              }
            }
          ]
        },
        // Q4 benefits with non-October start dates
        {
          AND: [
            {
              benefit: { description: { contains: 'Q4: Oct-Dec' } }
            },
            {
              NOT: {
                cycleStartDate: {
                  gte: new Date('2025-10-01T00:00:00Z'),
                  lt: new Date('2025-11-01T00:00:00Z')
                }
              }
            }
          ]
        }
      ]
    },
    include: {
      benefit: {
        select: {
          id: true,
          description: true
        }
      },
      user: {
        select: {
          email: true
        }
      }
    },
    take: 100 // Limit to prevent overwhelming results
  });
  
  quarterlyIssues.forEach(status => {
    issues.push({
      type: 'QUARTERLY_MISMATCH',
      description: `Quarterly benefit has wrong cycle dates`,
      benefitId: status.benefitId,
      userId: status.userId,
      userEmail: status.user.email,
      cycleInfo: `${status.benefit.description}: ${status.cycleStartDate.toISOString().split('T')[0]} → ${status.cycleEndDate.toISOString().split('T')[0]}`
    });
  });
  
  // Check for December benefits with wrong dates
  console.log('Checking December benefit alignments...');
  
  const decemberIssues = await prisma.benefitStatus.findMany({
    where: {
      AND: [
        {
          benefit: { description: { contains: 'December' } }
        },
        {
          NOT: {
            cycleStartDate: {
              gte: new Date('2025-12-01T00:00:00Z'),
              lt: new Date('2026-01-01T00:00:00Z')
            }
          }
        }
      ]
    },
    include: {
      benefit: {
        select: {
          id: true,
          description: true
        }
      },
      user: {
        select: {
          email: true
        }
      }
    },
    take: 50
  });
  
  decemberIssues.forEach(status => {
    issues.push({
      type: 'DECEMBER_MISMATCH',
      description: `December benefit has wrong cycle dates`,
      benefitId: status.benefitId,
      userId: status.userId,
      userEmail: status.user.email,
      cycleInfo: `${status.benefit.description}: ${status.cycleStartDate.toISOString().split('T')[0]} → ${status.cycleEndDate.toISOString().split('T')[0]}`
    });
  });
  
  return issues;
}

async function sendIntegrityAlert(issues: any[]) {
  // In a real system, this would send email/Slack alerts to admins
  console.error('🚨 BENEFIT INTEGRITY ALERT 🚨');
  console.error('==========================================');
  console.error(`Found ${issues.length} benefit integrity issues:`);
  
  issues.slice(0, 10).forEach((issue, index) => {
    console.error(`\n${index + 1}. ${issue.type}: ${issue.description}`);
    console.error(`   User: ${issue.userEmail}`);
    console.error(`   Details: ${issue.cycleInfo}`);
  });
  
  if (issues.length > 10) {
    console.error(`\n... and ${issues.length - 10} more issues`);
  }
  
  console.error('\n🔧 ACTION REQUIRED: Check benefit cycle assignments immediately!');
  console.error('==========================================');
}

// Allow this endpoint to be called manually for testing
export async function POST(request: NextRequest) {
  return GET(request);
}
