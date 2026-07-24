const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/ai_job_copilot');
  const User = mongoose.connection.db.collection('users');
  await User.updateOne({}, {
    $set: {
      'filters.countries': ['Nagercoil']
    }
  });
  console.log('User filters updated to Chennai!');
  await mongoose.disconnect();
}

run().catch(console.error);
