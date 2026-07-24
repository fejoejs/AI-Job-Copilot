const { MongoClient } = require('mongodb');

async function migrate() {
  const localUri = 'mongodb://localhost:27017/jobcopilot';
  const cloudUri = 'mongodb+srv://jobcopilotai_db_user:DRDPaTtsH4S6d3sG@aijobcopilotdb.lxzzaig.mongodb.net/test?retryWrites=true&w=majority';
  
  console.log('Connecting to local database...');
  const localClient = await MongoClient.connect(localUri);
  const localDb = localClient.db('ai_job_copilot');
  
  console.log('Connecting to cloud database...');
  const cloudClient = await MongoClient.connect(cloudUri);
  const cloudDb = cloudClient.db('AIJobCopilotDB');

  try {
    const collections = await localDb.listCollections().toArray();
    
    for (let coll of collections) {
      if (coll.name === 'system.indexes') continue;
      
      console.log(`Migrating collection: ${coll.name}`);
      const localCollection = localDb.collection(coll.name);
      const cloudCollection = cloudDb.collection(coll.name);
      
      const documents = await localCollection.find({}).toArray();
      
      if (documents.length > 0) {
        // Drop cloud collection if exists to avoid duplicates
        try { await cloudCollection.drop(); } catch (e) {}
        
        await cloudCollection.insertMany(documents);
        console.log(`✅ Copied ${documents.length} documents for ${coll.name}`);
      } else {
        console.log(`⚠️ No documents found in ${coll.name}`);
      }
    }
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await localClient.close();
    await cloudClient.close();
  }
}

migrate();
