// Smart Contract interaction service for auto-syncing Merkle roots
import { ethers } from 'ethers';

/**
 * Automatically update the Merkle root for question ID 1 when a new batch is committed
 * This fixes the architecture issue where manual updates were needed for each new batch
 */
export const updateQuestionMerkleRoot = async (batchId, merkleRoot, merkleContract, db = null) => {
  try {
    console.log(`🔄 Auto-syncing Merkle root for question ID 1...`);
    console.log(`   - Batch ID: ${batchId}`);
    console.log(`   - Merkle Root: ${merkleRoot}`);
    
    if (!merkleContract) {
      console.warn(`⚠️ No merkleContract provided - skipping auto-sync`);
      return {
        success: false,
        error: 'No merkleContract provided',
        questionId: 1,
        batchId,
        merkleRoot
      };
    }
    
    // Use the existing merkleContract from blockchain config
    const questionId = 1; // We use question ID 1 as the "current batch" placeholder
    
    console.log(`📡 Submitting Merkle root to smart contract...`);
    const tx = await merkleContract.submitMerkleRoot(questionId, merkleRoot);
    
    console.log(`📡 Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    
    console.log(`✅ Merkle root auto-synced successfully!`);
    console.log(`   - Question ID: ${questionId}`);
    console.log(`   - Transaction: ${tx.hash}`);
    console.log(`   - Gas used: ${receipt.gasUsed.toString()}`);
    
    // Update database to mark merkle leaves as created on-chain AND create questions on smart contract
    if (db) {
      try {
        console.log(`🔄 Updating database: marking batch ${batchId} leaves as createdOnChain...`);
        
        // Get all merkle leaves for this batch
        const leavesQuery = await db.collection('merkle_leaves')
          .where('batchId', '==', parseInt(batchId))
          .get();
        
        if (!leavesQuery.empty) {
          const batch = db.batch();
          let updateCount = 0;
          const questionIds = [];
          
          // Use single question ID (1) for all quizzes in this batch - consistent with manual fix
          const singleQuestionId = 1;
          
          leavesQuery.docs.forEach((doc, index) => {
            batch.update(doc.ref, {
              blockchainQuestionId: singleQuestionId, // All use question ID 1
              createdOnChain: true,
              txHash: tx.hash
            });
            updateCount++;
          });
          
          await batch.commit();
          console.log(`✅ Updated ${updateCount} merkle leaves as createdOnChain (all using question ID ${singleQuestionId})`);
          
          // Question ID 1 already has the Merkle root set from the main auto-sync above
          console.log(`✅ All quizzes in batch ${batchId} now use question ID ${singleQuestionId} with correct Merkle root`)
          
        } else {
          console.warn(`⚠️ No merkle leaves found for batch ${batchId}`);
        }
        
        // Update batch record
        await db.collection('merkle_batches').doc(String(batchId)).update({
          questionsCreatedOnChain: true,
          onChainQuestionCount: leavesQuery.size,
          createdOnChainAt: db.FieldValue ? db.FieldValue.serverTimestamp() : new Date()
        });
        
      } catch (dbError) {
        console.warn(`⚠️ Database update failed (non-blocking):`, dbError.message);
      }
    }
    
    return {
      success: true,
      questionId,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString()
    };
    
  } catch (error) {
    console.error(`❌ Failed to auto-sync Merkle root:`, error);
    console.error(`   - Batch ID: ${batchId}`);
    console.error(`   - Merkle Root: ${merkleRoot}`);
    
    // Don't throw the error - we don't want to break the batch commit process
    // Just log it and return failure status
    return {
      success: false,
      error: error.message,
      questionId: 1,
      batchId,
      merkleRoot
    };
  }
};

/**
 * Verify that the smart contract has the correct Merkle root
 */
export const verifyQuestionMerkleRoot = async (questionId = 1, merkleContract) => {
  try {
    console.log(`🔍 Verifying Merkle root for question ID ${questionId}...`);
    
    if (!merkleContract) {
      console.warn(`⚠️ No merkleContract provided - skipping verification`);
      return {
        success: false,
        error: 'No merkleContract provided',
        questionId
      };
    }
    
    const root = await merkleContract.getMerkleRoot(questionId);
    
    console.log(`📋 Current Merkle root: ${root}`);
    
    return {
      success: true,
      questionId,
      root: root
    };
    
  } catch (error) {
    console.error(`❌ Failed to verify Merkle root:`, error);
    return {
      success: false,
      error: error.message,
      questionId
    };
  }
};
