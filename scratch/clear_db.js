const mongoose = require('mongoose');

async function clearDb() {
  const mongoUri = 'mongodb://127.0.0.1:27017/ai_job_copilot';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Clear jobs, matches, applications
  const collections = ['jobs', 'jobmatches', 'applications'];
  for (const name of collections) {
    const col = mongoose.connection.db.collection(name);
    const count = await col.countDocuments();
    console.log(`Clearing collection: ${name} (contains ${count} documents)`);
    await col.deleteMany({});
  }

  // Clear resumes
  const resCol = mongoose.connection.db.collection('resumes');
  console.log(`Clearing collection: resumes (contains ${await resCol.countDocuments()} documents)`);
  await resCol.deleteMany({});

  console.log('Database cleared successfully');
  await mongoose.disconnect();
}

clearDb().catch(console.error);
