const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
const match = envContent.match(/MONGODB_URI=(.*)/);
const uri = match ? match[1].trim() : 'mongodb://localhost:27017/ai_job_copilot';

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const configs = await db.collection('systemconfigs').find({}).toArray();
  console.log('Configs:', configs);
  await mongoose.disconnect();
}
run().catch(console.error);
