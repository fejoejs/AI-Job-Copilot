const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
const match = envContent.match(/MONGODB_URI=(.*)/);
const uri = match ? match[1].trim() : 'mongodb://localhost:27017/ai_job_copilot';

async function check() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const docs = await db.collection('systemconfigs').find({}).toArray();
  console.log('System Config Keys and Values:');
  for (const doc of docs) {
    console.log(`- ${doc.key}: "${doc.value ? doc.value.substring(0, 15) + '...' : ''}"`);
  }
  await mongoose.disconnect();
}
check().catch(console.error);
