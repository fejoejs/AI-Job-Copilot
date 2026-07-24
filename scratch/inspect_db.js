const mongoose = require('mongoose');

async function inspectDb() {
  const mongoUri = 'mongodb://127.0.0.1:27017/ai_job_copilot';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  // Inspect User profiles
  const users = await mongoose.connection.db.collection('users').find().toArray();
  console.log('Users found:', users.length);
  for (const u of users) {
    console.log(`User: ${u.email}, clerkId: ${u.clerkId}`);
    console.log('Filters:', JSON.stringify(u.filters, null, 2));
  }

  // Inspect Resumes
  const resumes = await mongoose.connection.db.collection('resumes').find().toArray();
  console.log('Resumes found:', resumes.length);
  for (const r of resumes) {
    console.log(`Resume ID: ${r._id}, userId: ${r.userId}, isAtsCheckOnly: ${r.isAtsCheckOnly}, fileName: ${r.originalFileName}`);
    console.log('Has parsedProfile:', !!r.parsedProfile);
    if (r.parsedProfile) {
      console.log('Parsed Profile Skills:', r.parsedProfile.skills);
      console.log('Parsed Profile Experience count:', r.parsedProfile.experience ? r.parsedProfile.experience.length : 0);
    }
  }

  // Inspect Jobs
  const jobsCount = await mongoose.connection.db.collection('jobs').countDocuments();
  console.log('Total jobs in database:', jobsCount);

  // Inspect Job Matches
  const matches = await mongoose.connection.db.collection('jobmatches').find().toArray();
  console.log('Total job matches calculated:', matches.length);

  // Inspect Applications
  const applications = await mongoose.connection.db.collection('applications').find().toArray();
  console.log('Total applications:', applications.length);

  await mongoose.disconnect();
}

inspectDb().catch(console.error);
