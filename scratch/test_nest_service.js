const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../apps/api/dist/app.module');
const { JobService } = require('../apps/api/dist/job/job.service');

async function testService() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App context loaded.');

  const jobService = app.get(JobService);
  const userId = 'user_3GRy64gd1FDToSz2MlpaE0YmVc2';

  console.log(`Calling jobService.getDashboardJobs('${userId}')...`);
  const results = await jobService.getDashboardJobs(userId);
  console.log(`Results returned count: ${results.length}`);
  if (results.length > 0) {
    console.log('First result:', JSON.stringify({
      title: results[0].job.title,
      company: results[0].job.company,
      location: results[0].job.location,
      workType: results[0].job.workType,
      hasMatch: !!results[0].match
    }, null, 2));
  } else {
    console.log('Warning: No jobs matched!');
  }

  await app.close();
}

testService().catch(console.error);
