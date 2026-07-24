const mongoose = require('mongoose');

async function testCounts() {
  await mongoose.connect('mongodb://127.0.0.1:27017/ai_job_copilot');
  const count = await mongoose.connection.db.collection('jobs').countDocuments();
  console.log('Total jobs:', count);

  const agg = await mongoose.connection.db.collection('jobs').aggregate([
    { $group: { _id: '$workType', count: { $sum: 1 } } }
  ]).toArray();
  console.log('WorkType counts:', agg);

  const locations = await mongoose.connection.db.collection('jobs').aggregate([
    { $group: { _id: '$location', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();
  console.log('Top locations:', locations);

  await mongoose.disconnect();
}

testCounts().catch(console.error);
