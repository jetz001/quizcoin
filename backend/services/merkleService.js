// backend/services/merkleService.js
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';

class MerkleService {
  constructor(db, quizService, blockchainService) {
    this.db = db;
    this.quizService = quizService;
    this.blockchainService = blockchainService;
  }

  // สร้าง Batch ID
  makeBatchId() {
    return Math.floor(Date.now() / 1000);
  }

  // ✅ แก้ไขการสร้าง batch - ใช้ correctAnswer เป็น leaf
  async generateBatch(totalQuestions = 18, subBatchSize = 9, batchId = null) {
    const bid = batchId || this.makeBatchId();
    console.log(`🔧 Generating batch ${bid} (${totalQuestions} questions, subBatchSize=${subBatchSize})`);
    
    if (this.db) {
      try {
        await this.db.collection('merkle_batches').doc(String(bid)).set({
          batchId: bid,
          totalQuestions,
          createdAt: this.db.FieldValue.serverTimestamp(),
          status: 'open'
        });
      } catch (error) {
        console.error("❌ Failed to create batch document:", error);
        throw new Error("Failed to initialize batch in database");
      }
    }

    let created = 0;
    let indexCounter = 0;

    while (created < totalQuestions) {
      const active = Math.min(subBatchSize, totalQuestions - created);
      const createdThisRound = [];
      console.log(`🚀 Starting sub-batch: need ${active} questions...`);
      
      for (let i = 0; i < active; i++) {
        try {
          const q = await this.quizService.generateQuizQuestion();
          if (!q) {
            console.warn(`⚠️ Failed to generate question ${i + 1}/${active}, skipping...`);
            continue;
          }
          
          indexCounter++;
          const quizId = `q_${Date.now()}_${indexCounter}`;
          const storeResult = await this.quizService.storeQuestionToFirestore(quizId, q);
          if (!storeResult.success) {
            console.warn(`⚠️ Failed to store question ${quizId}, skipping...`);
            continue;
          }
          
          // ✅ ใช้ correctAnswer แทน quizId ในการสร้าง leaf
          const leaf = ethers.keccak256(ethers.toUtf8Bytes(storeResult.correctAnswer));
          
          if (this.db) {
            try {
              await this.db.collection('merkle_leaves').add({
                batchId: bid,
                leaf,
                quizId,
                correctAnswer: storeResult.correctAnswer, // เก็บ correctAnswer ด้วย
                createdAt: this.db.FieldValue.serverTimestamp()
              });
            } catch (error) {
              console.error(`❌ Failed to store leaf for ${quizId}:`, error);
              continue;
            }
          }
          
          created++;
          createdThisRound.push(quizId);
          console.log(`   ✅ Created ${created}/${totalQuestions} : ${quizId}`);
        } catch (error) {
          console.error(`❌ Error creating question ${i + 1}:`, error.message);
          continue;
        }
      }
      
      if (created < totalQuestions) {
        console.log(`⏳ Sub-batch done (${createdThisRound.length}). Waiting 60s before next sub-batch...`);
        for (let sec = 60; sec > 0; sec -= 10) {
          console.log(`     ... still waiting (${sec}s left)`);
          await new Promise(r => setTimeout(r, 10_000));
        }
      } else {
        console.log(`🎉 Batch ${bid} generation complete.`);
      }
    }

    if (this.db) {
      try {
        await this.db.collection('merkle_batches').doc(String(bid)).update({ 
          status: 'ready', 
          readyAt: this.db.FieldValue.serverTimestamp() 
        });
      } catch (error) {
        console.error("❌ Failed to update batch status:", error);
      }
    }
    
    return { batchId: bid, totalCreated: created };
  }

  // ✅ แก้ไข API สร้าง Merkle proof
  async generateMerkleProof(quizId, answer) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    console.log(`🔍 Generating Merkle proof for quiz ${quizId}, answer: ${answer}`);

    // ✅ Step 1: ตรวจสอบคำตอบผ่าน QuizService
    const isCorrect = await this.quizService.verifyAnswer(quizId, answer);
    if (!isCorrect) {
      throw new Error("Incorrect answer");
    }

    // ✅ Step 2: ดึงคำตอบที่ถูกต้อง
    const correctAnswer = await this.quizService.getCorrectAnswer(quizId);
    if (!correctAnswer) {
      throw new Error("Quiz not found");
    }

    // ✅ Step 3: ใช้ correctAnswer ในการสร้าง leaf
    const answerLeaf = ethers.keccak256(ethers.toUtf8Bytes(correctAnswer));
    
    // ✅ Step 4: หา batch ที่มี quiz นี้
    const leavesQuery = await this.db.collection('merkle_leaves')
      .where('quizId', '==', quizId)
      .limit(1)
      .get();

    if (leavesQuery.empty) {
      throw new Error("Quiz not found in Merkle tree");
    }

    const leafDoc = leavesQuery.docs[0];
    const batchId = leafDoc.data().batchId;

    // ✅ Step 5: ดึง leaves ทั้งหมดใน batch นี้
    const batchLeavesQuery = await this.db.collection('merkle_leaves')
      .where('batchId', '==', batchId)
      .get();

    const leaves = batchLeavesQuery.docs.map(doc => doc.data().leaf);
    
    // ✅ Step 6: สร้าง Merkle tree
    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    
    // ✅ Step 7: สร้าง proof สำหรับ answerLeaf
    const proof = tree.getHexProof(answerLeaf);
    const root = tree.getHexRoot();

    // ✅ Step 8: ตรวจสอบ proof
    const isValid = tree.verify(proof, answerLeaf, root);

    console.log(`✅ Generated proof for ${quizId}: valid=${isValid}, answer=${correctAnswer}`);

    return {
      leaf: answerLeaf,
      proof: proof,
      root: root,
      isValid: isValid,
      batchId: batchId,
      correctAnswer: correctAnswer
    };
  }

  // สร้าง Merkle tree จาก batch
  async buildMerkleFromBatch(batchId) {
    if (!this.db) {
      throw new Error("Firebase not initialized - cannot build Merkle tree");
    }
    
    const query = await this.db.collection('merkle_leaves').where('batchId', '==', batchId).get();
    
    // ✅ ใช้ leaf ที่สร้างจาก correctAnswer
    const leaves = query.docs.map(doc => doc.data().leaf);
    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    const rootHex = tree.getHexRoot();
    
    return { rootHex, leaves };
  }

  // Commit batch ขึ้น blockchain
  async commitBatchOnChain(batchId, submitChunkSize = 500) {
    console.log(`🔗 Preparing to commit batch ${batchId} on-chain...`);
    
    if (!this.db) {
      throw new Error("Firebase not initialized - cannot commit batch");
    }
    
    const bdoc = await this.db.collection('merkle_batches').doc(String(batchId)).get();
    if (!bdoc.exists) throw new Error("Batch not found: " + batchId);
    const batchInfo = bdoc.data();
    if (batchInfo.status !== 'ready') {
      console.warn("⚠️ Batch status not 'ready' — current:", batchInfo.status);
    }

    const { rootHex, leaves } = await this.buildMerkleFromBatch(batchId);
    console.log(`🌳 Merkle root built: ${rootHex}, total leaves=${leaves.length}`);

    await this.db.collection('merkle_batches').doc(String(batchId)).update({ 
      root: rootHex, 
      committedAt: null 
    });

    if (!this.blockchainService || !this.blockchainService.merkleContract) {
      console.warn("⚠️ No blockchain service -> skipping on-chain commit. Root saved to Firestore only.");
      await this.db.collection('merkle_batches').doc(String(batchId)).update({ 
        status: 'committed_offchain', 
        rootSavedAt: this.db.FieldValue.serverTimestamp() 
      });
      return { root: rootHex, totalLeaves: leaves.length, onChain: false };
    }

    // Submit ขึ้น blockchain
    try {
      console.log("🚀 Submitting to blockchain...");
      const tx = await this.blockchainService.merkleContract.submitMerkleRoot(batchId, rootHex, leaves, { 
        gasLimit: 6_000_000 
      });
      console.log("📡 Tx sent:", tx.hash);
      await tx.wait();
      console.log("✅ Tx confirmed:", tx.hash);
      
      await this.db.collection('merkle_batches').doc(String(batchId)).update({ 
        status: 'committed_onchain', 
        committedAt: this.db.FieldValue.serverTimestamp(),
        txHash: tx.hash
      });
      
      return { root: rootHex, totalLeaves: leaves.length, onChain: true, txHash: tx.hash };
    } catch (error) {
      console.error("❌ Error submitting to blockchain:", error);
      throw error;
    }
  }

  // ตรวจสอบ Merkle proof
  async verifyMerkleProof(leaf, proof, batchId) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    const batchDoc = await this.db.collection('merkle_batches').doc(String(batchId)).get();
    if (!batchDoc.exists) {
      throw new Error("Batch not found");
    }

    const { root } = batchDoc.data();
    if (!root) {
      throw new Error("Batch root not found");
    }

    const tree = new MerkleTree([], ethers.keccak256, { sortPairs: true });
    return tree.verify(proof, leaf, root);
  }

  // ดึงรายการ batches
  async getBatches(limit = 20) {
    if (!this.db) {
      throw new Error("Firebase not available");
    }

    const querySnapshot = await this.db.collection('merkle_batches')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis(),
      readyAt: doc.data().readyAt?.toMillis(),
      committedAt: doc.data().committedAt?.toMillis()
    }));
  }
}

export default MerkleService;