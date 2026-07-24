const { Queue } = require('bullmq');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const connection = { host: redisHost, port: redisPort };

async function triggerCrawl() {
  console.log(`Connecting to Redis at ${redisHost}:${redisPort}...`);
  const globalCrawlQueue = new Queue('global-crawl', { connection });

  console.log('Adding "crawl-jobs" job to global-crawl queue...');
  const job = await globalCrawlQueue.add('crawl-jobs', {});

  console.log(`Successfully enqueued manual crawl job! Job ID: ${job.id}`);
  console.log('The running API server background worker will now process the crawl.');
  console.log('Watch the API server console log for progress.');

  await globalCrawlQueue.close();
}

triggerCrawl().catch(err => {
  console.error('Failed to trigger crawl:', err);
});
