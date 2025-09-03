// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const { generateQuestionBatch, getBatchGenerationStatus } = require('../services/quiz');
const { commitBatchToBlockchain, saveBatchOffchain } = require('../services/merkle');
const { getBatch } = require('../services/firebase');
const { checkContractHealth } = require('../services/blockchain');

// Generate new batch of questions
router.post('/generate-batch', async (req, res) => {
  try {
    const { totalQuestions, subBatchSize } = req.body;
    
    console.log(`🔧 Starting batch generation...`);
    console.log(`   - Total Questions: ${totalQuestions || 'default'}`);
    console.log(`   - Sub-batch Size: ${subBatchSize || 'default'}`);
    
    const result = await generateQuestionBatch(totalQuestions, subBatchSize);
    
    res.status(200).json({ 
      success: true, 
      message: `Batch ${result.batchId} generated successfully`,
      ...result 
    });
  } catch (error) {
    console.error("❌ Error getting batch details:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// System health check
router.get('/health', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const merkleContract = req.app.locals.merkleContract;

    const health = {
      timestamp: new Date().toISOString(),
      services: {
        firebase: {
          connected: !!db,
          status: db ? 'healthy' : 'unavailable'
        },
        blockchain: {
          connected: !!merkleContract,
          status: merkleContract ? 'healthy' : 'unavailable'
        },
        gemini: {
          configured: !!process.env.GEMINI_API_KEY,
          status: process.env.GEMINI_API_KEY ? 'configured' : 'not configured'
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8000
      }
    };

    // Test blockchain connection if available
    if (merkleContract) {
      try {
        const contractHealth = await checkContractHealth();
        health.services.blockchain.network = contractHealth.network;
        health.services.blockchain.accessible = contractHealth.accessible;
        if (!contractHealth.accessible) {
          health.services.blockchain.error = contractHealth.error;
        }
      } catch (error) {
        health.services.blockchain.error = error.message;
      }
    }

    const allHealthy = health.services.firebase.connected && 
                      health.services.gemini.configured;

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      health
    });

  } catch (error) {
    console.error("❌ Error checking health:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Clear batch data (for development/testing)
router.delete('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const db = req.app.locals.db;

    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    console.log(`🗑️ Clearing batch ${batchId}...`);

    // Delete batch document
    await db.collection('merkle_batches').doc(String(batchId)).delete();

    // Delete associated leaves
    const leavesQuery = await db.collection('merkle_leaves')
      .where('batchId', '==', parseInt(batchId))
      .get();

    const batch = db.batch();
    leavesQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Delete associated questions
    const questionsQuery = await db.collection('questions')
      .where('batchId', '==', parseInt(batchId))
      .get();

    const questionBatch = db.batch();
    questionsQuery.docs.forEach(doc => {
      questionBatch.delete(doc.ref);
    });
    await questionBatch.commit();

    console.log(`✅ Batch ${batchId} cleared successfully`);

    res.json({
      success: true,
      message: `Batch ${batchId} and associated data cleared`,
      deleted: {
        batch: 1,
        leaves: leavesQuery.size,
        questions: questionsQuery.size
      }
    });

  } catch (error) {
    console.error("❌ Error clearing batch:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Admin dashboard (HTML page)
router.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Quiz Game Admin Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        button { background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        button:hover { background: #005a87; }
        button.danger { background: #dc3545; }
        button.danger:hover { background: #c82333; }
        .result { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 10px; white-space: pre-wrap; font-family: monospace; font-size: 12px; }
        .loading { color: #666; font-style: italic; }
        input[type="number"] { padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin: 0 10px; width: 100px; }
        .endpoint { background: #f8f9fa; padding: 10px; margin: 5px 0; border-left: 4px solid #007cba; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 Quiz Game Admin Dashboard</h1>
        
        <div class="status">
            <h3>System Status</h3>
            <div id="systemStatus">Loading...</div>
        </div>

        <div class="section">
            <h3>📋 Batch Generation</h3>
            <p>Generate new batches of quiz questions with Merkle tree structure.</p>
            
            <div>
                <label>Total Questions: <input type="number" id="totalQuestions" value="18" min="1" max="100"></label>
                <label>Sub-batch Size: <input type="number" id="subBatchSize" value="9" min="1" max="20"></label>
            </div>
            <br>
            
            <button onclick="generateBatch()">🔧 Generate Batch</button>
            <button onclick="generateAndCommit()">⚡ Generate & Commit</button>
            
            <div id="generateResult" class="result" style="display:none;"></div>
        </div>

        <div class="section">
            <h3>🔗 Blockchain Operations</h3>
            <p>Commit existing batches to the blockchain.</p>
            
            <div>
                <label>Batch ID: <input type="number" id="commitBatchId" placeholder="Enter batch ID"></label>
                <button onclick="commitBatch()">🚀 Commit Batch</button>
            </div>
            
            <div id="commitResult" class="result" style="display:none;"></div>
        </div>

        <div class="section">
            <h3>📊 Batch Management</h3>
            <p>View and manage existing batches.</p>
            
            <button onclick="loadBatches()">📋 Load Batches</button>
            <button onclick="clearResults()">🧹 Clear Results</button>
            
            <div id="batchList" class="result" style="display:none;"></div>
        </div>

        <div class="section">
            <h3>🔧 API Endpoints</h3>
            <div class="endpoint"><strong>POST</strong> /admin/generate-batch - Generate new batch</div>
            <div class="endpoint"><strong>POST</strong> /admin/commit-batch - Commit batch to blockchain</div>
            <div class="endpoint"><strong>POST</strong> /admin/generate-and-commit - Generate and commit in one operation</div>
            <div class="endpoint"><strong>GET</strong> /admin/config - Get system configuration</div>
            <div class="endpoint"><strong>GET</strong> /admin/batches - List all batches</div>
            <div class="endpoint"><strong>GET</strong> /admin/health - System health check</div>
        </div>
    </div>

    <script>
        async function apiCall(method, endpoint, body = null) {
            const options = {
                method: method,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (body) {
                options.body = JSON.stringify(body);
            }
            
            const response = await fetch(endpoint, options);
            return await response.json();
        }

        async function loadSystemStatus() {
            try {
                const result = await apiCall('GET', '/admin/health');
                document.getElementById('systemStatus').innerHTML = 
                    \`<pre>\${JSON.stringify(result, null, 2)}</pre>\`;
            } catch (error) {
                document.getElementById('systemStatus').innerHTML = 
                    \`<span style="color: red;">Error: \${error.message}</span>\`;
            }
        }

        async function generateBatch() {
            const totalQuestions = document.getElementById('totalQuestions').value;
            const subBatchSize = document.getElementById('subBatchSize').value;
            
            const resultDiv = document.getElementById('generateResult');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div class="loading">🔧 Generating batch... This may take a few minutes.</div>';
            
            try {
                const result = await apiCall('POST', '/admin/generate-batch', {
                    totalQuestions: parseInt(totalQuestions),
                    subBatchSize: parseInt(subBatchSize)
                });
                
                resultDiv.innerHTML = JSON.stringify(result, null, 2);
            } catch (error) {
                resultDiv.innerHTML = \`Error: \${error.message}\`;
            }
        }

        async function commitBatch() {
            const batchId = document.getElementById('commitBatchId').value;
            
            if (!batchId) {
                alert('Please enter a batch ID');
                return;
            }
            
            const resultDiv = document.getElementById('commitResult');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div class="loading">🚀 Committing batch to blockchain...</div>';
            
            try {
                const result = await apiCall('POST', '/admin/commit-batch', {
                    batchId: parseInt(batchId)
                });
                
                resultDiv.innerHTML = JSON.stringify(result, null, 2);
            } catch (error) {
                resultDiv.innerHTML = \`Error: \${error.message}\`;
            }
        }

        async function generateAndCommit() {
            const totalQuestions = document.getElementById('totalQuestions').value;
            const subBatchSize = document.getElementById('subBatchSize').value;
            
            const resultDiv = document.getElementById('generateResult');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div class="loading">⚡ Generating and committing batch... This may take several minutes.</div>';
            
            try {
                const result = await apiCall('POST', '/admin/generate-and-commit', {
                    totalQuestions: parseInt(totalQuestions),
                    subBatchSize: parseInt(subBatchSize)
                });
                
                resultDiv.innerHTML = JSON.stringify(result, null, 2);
            } catch (error) {
                resultDiv.innerHTML = \`Error: \${error.message}\`;
            }
        }

        async function loadBatches() {
            const resultDiv = document.getElementById('batchList');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div class="loading">📋 Loading batches...</div>';
            
            try {
                const result = await apiCall('GET', '/admin/batches?limit=10');
                resultDiv.innerHTML = JSON.stringify(result, null, 2);
            } catch (error) {
                resultDiv.innerHTML = \`Error: \${error.message}\`;
            }
        }

        function clearResults() {
            const results = document.querySelectorAll('.result');
            results.forEach(result => {
                result.style.display = 'none';
                result.innerHTML = '';
            });
        }

        // Load system status on page load
        loadSystemStatus();
        
        // Refresh status every 30 seconds
        setInterval(loadSystemStatus, 30000);
    </script>
</body>
</html>
  `;

  res.send(html);
});

module.exports = router; Error in /admin/generate-batch:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Commit existing batch to blockchain
router.post('/commit-batch', async (req, res) => {
  try {
    const { batchId } = req.body;
    
    if (!batchId) {
      return res.status(400).json({ 
        success: false, 
        error: "batchId is required" 
      });
    }

    console.log(`🔗 Starting commit process for batch ${batchId}`);

    // Check if batch exists and is ready
    const batchData = await getBatch(parseInt(batchId));
    if (!batchData) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    if (batchData.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: `Batch status is '${batchData.status}', expected 'ready'`
      });
    }

    const merkleContract = req.app.locals.merkleContract;
    
    let result;
    if (merkleContract) {
      // Commit to blockchain
      result = await commitBatchToBlockchain(parseInt(batchId), merkleContract);
    } else {
      // Save off-chain only
      console.warn("⚠️ No blockchain connection, saving off-chain only");
      result = await saveBatchOffchain(parseInt(batchId));
    }

    res.status(200).json({ 
      success: true, 
      message: `Batch ${batchId} committed successfully`,
      ...result 
    });
  } catch (error) {
    console.error("❌ Error in /admin/commit-batch:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate and commit in one operation
router.post('/generate-and-commit', async (req, res) => {
  try {
    const { totalQuestions, subBatchSize } = req.body;
    
    console.log(`🔧 Starting generate-and-commit process...`);
    
    // Generate batch
    const generateResult = await generateQuestionBatch(totalQuestions, subBatchSize);
    console.log(`✅ Batch ${generateResult.batchId} generated, now committing...`);
    
    const merkleContract = req.app.locals.merkleContract;
    
    let commitResult;
    if (merkleContract) {
      // Commit to blockchain
      commitResult = await commitBatchToBlockchain(generateResult.batchId, merkleContract);
    } else {
      // Save off-chain only
      console.warn("⚠️ No blockchain connection, saving off-chain only");
      commitResult = await saveBatchOffchain(generateResult.batchId);
    }

    console.log(`🎉 Generate-and-commit completed for batch ${generateResult.batchId}`);

    res.status(200).json({ 
      success: true,
      message: `Batch ${generateResult.batchId} generated and committed successfully`,
      generation: generateResult,
      commit: commitResult
    });
  } catch (error) {
    console.error("❌ Error in /admin/generate-and-commit:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get system configuration
router.get('/config', async (req, res) => {
  try {
    const batchStatus = await getBatchGenerationStatus();
    const contractHealth = await checkContractHealth();

    const config = {
      ...batchStatus,
      blockchain: {
        connected: contractHealth.accessible,
        network: contractHealth.network || null,
        contractAddress: process.env.CONTRACT_ADDRESS || null,
        error: contractHealth.error || null
      },
      database: {
        firebase: !!req.app.locals.db
      }
    };

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error("❌ Error getting config:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all batches
router.get('/batches', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: "Firebase not available" 
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || null;

    let query = db.collection('merkle_batches')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const batches = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        batchId: data.batchId,
        status: data.status,
        totalQuestions: data.totalQuestions,
        totalCreated: data.totalCreated || 0,
        progress: data.progress || 0,
        merkleRoot: data.merkleRoot || null,
        createdAt: data.createdAt,
        readyAt: data.readyAt || null,
        committedAt: data.committedAt || null,
        onChain: data.status === 'committed_onchain'
      };
    });

    res.json({
      success: true,
      batches,
      total: batches.length,
      filters: { limit, status }
    });

  } catch (error) {
    console.error("❌ Error getting batches:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get batch details
router.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;

    const batchData = await getBatch(parseInt(batchId));
    if (!batchData) {
      return res.status(404).json({
        success: false,
        error: "Batch not found"
      });
    }

    // Include more detailed information for admin
    const detailedBatch = {
      ...batchData,
      totalLeaves: batchData.leaves ? batchData.leaves.length : 0,
      totalQuizIds: batchData.quizIds ? batchData.quizIds.length : 0,
      onChain: batchData.status === 'committed_onchain',
      hasTransactions: !!(batchData.txs && batchData.txs.length > 0)
    };

    res.json({
      success: true,
      batch: detailedBatch
    });

  } catch (error) {
    console.error("❌