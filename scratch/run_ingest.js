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

  // Find user
  const user = await db.collection('users').findOne({});
  if (!user) {
    console.error('No user found in database!');
    await mongoose.disconnect();
    return;
  }
  const userId = user.clerkId;
  console.log('Ingesting for user:', userId);

  // Determine query parameters based on resume profile
  const resume = await db.collection('resumes').findOne({ userId, isAtsCheckOnly: { $ne: true } }, { sort: { createdAt: -1 } });
  
  let title = 'Software Engineer';
  if (resume && resume.parsedProfile && resume.parsedProfile.experience && resume.parsedProfile.experience[0]) {
    title = resume.parsedProfile.experience[0].title;
  }
  
  let location = 'India';
  if (user.filters && user.filters.countries && user.filters.countries[0]) {
    location = user.filters.countries[0];
  }

  const query = `${title} in ${location}`;
  console.log(`Search query: "${query}"`);

  // Fetch credentials
  const jsearchKey = await db.collection('systemconfigs').findOne({ key: 'JSEARCH_API_KEY' });
  const adzunaId = await db.collection('systemconfigs').findOne({ key: 'ADZUNA_API_ID' });
  const adzunaKey = await db.collection('systemconfigs').findOne({ key: 'ADZUNA_API_KEY' });

  let jobsCount = 0;

  async function ingestJob(jobData) {
    const existing = await db.collection('jobs').findOne({ title: jobData.title, company: jobData.company });
    if (!existing) {
      jobData.createdAt = new Date();
      jobData.updatedAt = new Date();
      await db.collection('jobs').insertOne(jobData);
      console.log(`Ingested: ${jobData.title} at ${jobData.company}`);
    } else {
      console.log(`Already exists: ${jobData.title} at ${jobData.company}`);
    }
  }

  // 1. Query JSearch
  if (jsearchKey && jsearchKey.value) {
    try {
      console.log('Querying JSearch API with key:', jsearchKey.value.substring(0, 10) + '...');
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1`;
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': jsearchKey.value,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });
      if (response.ok) {
        const result = await response.json();
        const apiJobs = result.data || [];
        console.log(`JSearch returned ${apiJobs.length} jobs.`);
        for (const aj of apiJobs) {
          await ingestJob({
            title: aj.job_title,
            company: aj.job_publisher || aj.employer_name || 'Employer',
            description: aj.job_description || '',
            url: aj.job_apply_link || aj.job_google_link || '',
            source: 'JSearch',
            location: aj.job_city && aj.job_country ? `${aj.job_city}, ${aj.job_country}` : (aj.job_location || 'India'),
            workType: aj.job_is_remote ? 'Remote' : 'Onsite',
            salaryMin: aj.job_min_salary || undefined,
            salaryMax: aj.job_max_salary || undefined,
          });
          jobsCount++;
        }
      } else {
        console.error('JSearch response status:', response.status, await response.text());
      }
    } catch (err) {
      console.error('JSearch fetch error:', err);
    }
  }

  // 2. Query Adzuna
  if (adzunaId && adzunaId.value && adzunaKey && adzunaKey.value) {
    try {
      console.log('Querying Adzuna API...');
      const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${adzunaId.value}&app_key=${adzunaKey.value}&what=${encodeURIComponent(title)}&where=${encodeURIComponent(location)}&content-type=application/json`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        const apiJobs = result.results || [];
        console.log(`Adzuna returned ${apiJobs.length} jobs.`);
        for (const aj of apiJobs) {
          await ingestJob({
            title: aj.title,
            company: aj.company.display_name || 'Company',
            description: aj.description || '',
            url: aj.redirect_url || '',
            source: 'Adzuna',
            location: aj.location.display_name || 'India',
            workType: aj.location.area.includes('Remote') ? 'Remote' : 'Onsite',
            salaryMin: aj.salary_min || undefined,
            salaryMax: aj.salary_max || undefined,
          });
          jobsCount++;
        }
      } else {
        console.error('Adzuna response status:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Adzuna fetch error:', err);
    }
  }

  // 3. Fallback predefined seed jobs
  if (jobsCount === 0) {
    console.log('No API keys active or zero search results. Seeding predefined real-world fallback jobs...');
    const seedJobs = [
      {
        title: 'Software Engineer (React/Node.js)',
        company: 'Razorpay',
        location: 'Bengaluru, India',
        workType: 'Remote',
        source: 'Greenhouse',
        url: 'https://razorpay.com/jobs',
        description: 'Razorpay is looking for a software engineer experienced in React, TypeScript, and Node.js APIs to help scale payment gateway platforms and merchant dashboards.',
        salaryString: '₹12,00,000 - ₹18,00,000 (LPA)',
        salaryMin: 1200000,
        salaryMax: 1800000
      },
      {
        title: 'Backend Developer (Python/FastAPI)',
        company: 'Paytm',
        location: 'Noida, India',
        workType: 'Hybrid',
        source: 'Lever',
        url: 'https://paytm.com/jobs',
        description: 'Paytm is searching for a Backend Developer to design high-throughput transaction processing APIs, write clean SQL aggregations, and optimize DB query performance on PostgreSQL.',
        salaryString: '₹8,00,000 - ₹12,00,000 (LPA)',
        salaryMin: 800000,
        salaryMax: 1200000
      },
      {
        title: 'Front-End Engineer (Next.js)',
        company: 'Zomato',
        location: 'Gurugram, India',
        workType: 'Onsite',
        source: 'Ashby',
        url: 'https://zomato.com/jobs',
        description: 'Help build and optimize Zomato web food delivery dashboards using HTML, CSS, React, and Next.js. Onsite at Gurugram headquarters.',
        salaryString: '₹10,00,000 - ₹15,00,000 (LPA)',
        salaryMin: 1000000,
        salaryMax: 1500000
      },
      {
        title: 'Junior Frontend Developer (React)',
        company: 'Swiggy',
        location: 'Bengaluru, India',
        workType: 'Hybrid',
        source: 'Lever',
        url: 'https://swiggy.com/jobs',
        description: 'Join Swiggy as a Junior Frontend Developer to build clean, performant React web interfaces for Swiggy Instamart applications. Collaborate with UI design partners.',
        salaryString: '₹7,00,000 - ₹10,00,000 (LPA)',
        salaryMin: 700000,
        salaryMax: 1000000
      }
    ];

    for (const sj of seedJobs) {
      await ingestJob(sj);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
