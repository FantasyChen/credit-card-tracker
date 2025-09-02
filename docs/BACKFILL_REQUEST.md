# August 2025 Benefit Status Backfill Request

## 🎯 **Objective**
Create a careful, surgical backfill operation for August 2025 benefit statuses that were missed due to a `Promise.all` cron job failure, while avoiding any duplicates or overwrites of existing benefit statuses.

## 🚨 **Critical Requirements**

### 1. **NO DUPLICATES** - Strict Deduplication
- **NEVER** create a benefit status if one already exists for the same:
  - `benefitId` + `userId` + `cycleStartDate` + `occurrenceIndex` 
  - This is the unique constraint in the database
- **PRESERVE** all existing benefit statuses (completed, not-usable, or pending)
- **CHECK** existing records before any creation attempt

### 2. **Preserve User Actions**
- **DO NOT** touch benefits marked as `isCompleted = true`
- **DO NOT** touch benefits marked as `isNotUsable = true`  
- **DO NOT** override any existing `completedAt` timestamps
- **DO NOT** change any existing `orderIndex` values

### 3. **Target Scope**
- **ONLY** August 2025 benefit statuses (`cycleStartDate` within August 2025)
- **ONLY** recurring benefits (`frequency` = 'MONTHLY', 'QUARTERLY', 'YEARLY')
- **ONLY** active users with credit cards that have benefits
- **EXCLUDE** one-time or expired benefits

## 🔍 **Technical Implementation Requirements**

### Query Strategy
```sql
-- Find missing benefit statuses (pseudo-code)
SELECT DISTINCT b.id as benefitId, u.id as userId, b.occurrencesInCycle
FROM Benefit b
JOIN CreditCard cc ON b.creditCardId = cc.id  
JOIN User u ON cc.userId = u.id
WHERE b.frequency IN ('MONTHLY', 'QUARTERLY', 'YEARLY')
  AND NOT EXISTS (
    SELECT 1 FROM BenefitStatus bs 
    WHERE bs.benefitId = b.id 
      AND bs.userId = u.id 
      AND bs.cycleStartDate >= '2025-08-01'
      AND bs.cycleStartDate < '2025-09-01'
      AND bs.occurrenceIndex = [0..b.occurrencesInCycle-1]
  )
```

### Cycle Calculation
- Use the existing `calculateBenefitCycle()` function from `src/lib/benefit-cycle.ts`
- **IMPORTANT**: Respect different cycle alignments:
  - `CALENDAR_MONTH`: August 1-31, 2025
  - `CARD_ANNIVERSARY`: Based on card's `openedDate`
  - Handle quarterly/yearly frequencies appropriately

### Error Handling
- Use `Promise.allSettled` (NOT `Promise.all`) for batch operations
- Log individual failures without stopping the entire process
- Provide detailed success/failure metrics

## 📊 **Expected Scope**
Based on previous investigation, expect approximately:
- **~200 users** affected
- **~1,500-3,200 missing benefit statuses** (exact number TBD)
- **Various benefit types**: dining credits, travel credits, statement credits, etc.

## ✅ **Verification Steps**
1. **Pre-check**: Query and report exactly how many benefit statuses will be created
2. **Dry-run option**: Allow testing without actual database writes
3. **Post-check**: Verify no duplicates were created
4. **User validation**: Test with specific user (fantasychen2016@gmail.com) to ensure no UI issues

## 🛡️ **Safety Measures**
- **Transaction safety**: Consider using database transactions for consistency
- **Backup consideration**: Document that this is a CREATE-only operation (no updates/deletes)
- **Rollback plan**: All created records will have identifiable `createdAt` timestamps for potential future rollback
- **Monitoring**: Provide comprehensive logging of what was created vs. what was skipped

## 📝 **Required Deliverables**
1. **Pre-execution report**: Number of missing benefit statuses identified
2. **Execution script**: Safe, idempotent backfill operation  
3. **Post-execution report**: Success/failure counts and any issues encountered
4. **Verification**: Confirm no existing benefit statuses were modified

## 🔧 **Code References**
- Cron job logic: `src/app/api/cron/check-benefits/route.ts`
- Benefit cycle calculation: `src/lib/benefit-cycle.ts`
- Database schema: `prisma/schema.prisma` (BenefitStatus unique constraint)
- Existing benefit creation: `src/lib/actions/cardUtils.ts` (createCardForUser function)

---
**⚠️ CRITICAL**: This backfill must be surgical and precise. The previous attempt created overlapping benefit cycles that confused users. We need ONLY the truly missing August 2025 benefit statuses, with zero impact on existing user data. 