const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
const match = envContent.match(/MONGODB_URI=(.*)/);
const uri = match ? match[1].trim() : 'mongodb://localhost:27017/ai_job_copilot';
console.log('Connecting to:', uri);

async function check() {
  await mongoose.connect(uri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  console.log('Database Collections:');
  
  for (const col of cols) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`- ${col.name}: ${count} documents`);
    if (count > 0) {
      const docs = await db.collection(col.name).find({}).limit(1).toArray();
      console.log(`  Sample:`, JSON.stringify(docs[0], null, 2));
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
