const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
const match = envContent.match(/MONGODB_URI=(.*)/);
const uri = match ? match[1].trim() : 'mongodb://localhost:27017/ai_job_copilot';

async function run() {
  await mongoose.connect(uri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  
  // Clear jobs and matches
  const jobRes = await db.collection('jobs').deleteMany({});
  const matchRes = await db.collection('jobmatches').deleteMany({});
  const appRes = await db.collection('applications').deleteMany({});

  console.log(`Deleted ${jobRes.deletedCount} jobs`);
  console.log(`Deleted ${matchRes.deletedCount} matches`);
  console.log(`Deleted ${appRes.deletedCount} applications`);

  await mongoose.disconnect();
}

run().catch(console.error);
