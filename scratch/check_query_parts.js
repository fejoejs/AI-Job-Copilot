const mongoose = require('mongoose');

async function debugQuery() {
  await mongoose.connect('mongodb://127.0.0.1:27017/ai_job_copilot');
  const Job = mongoose.connection.db.collection('jobs');

  const total = await Job.countDocuments();
  console.log('Total jobs:', total);

  // 1. workType
  const wt = await Job.countDocuments({ workType: { $in: ['Remote', 'Hybrid', 'Onsite'] } });
  console.log('workType Remote/Hybrid/Onsite:', wt);

  // 2. location
  const loc = await Job.countDocuments({
    $or: [
      { location: { $regex: /Chennai/i } },
      { location: { $regex: /Bengaluru/i } },
      { location: { $regex: /Remote/i } }
    ]
  });
  console.log('Location matching regex:', loc);

  // 3. roles
  const roles = [
    'Web development', 'frontend developer', 'python full stack',
    'pm', 'product owner', 'program manager', 'product manager',
    'react developer', 'ui developer', 'front-end engineer',
    'frontend engineer', 'ui engineer', 'web developer'
  ];
  const roleConditions = roles.map(r => ({
    $or: [
      { title: { $regex: new RegExp(r, 'i') } },
      { description: { $regex: new RegExp(r, 'i') } }
    ]
  }));
  const rc = await Job.countDocuments({ $or: roleConditions });
  console.log('Roles matching:', rc);

  // 4. experienceLevel
  const el = await Job.countDocuments({
    $or: [
      { experienceLevel: { $in: ['Fresher'] } },
      { experienceLevel: { $exists: false } },
      { experienceLevel: null }
    ]
  });
  console.log('experienceLevel matching:', el);

  // 5. salaryMin
  const sal = await Job.countDocuments({
    $or: [
      { salaryMin: { $gte: 300000 } },
      { salaryMin: { $exists: false } },
      { salaryMin: null }
    ]
  });
  console.log('salaryMin matching:', sal);

  // 6. freshness
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fresh = await Job.countDocuments({
    $or: [
      { postedDate: { $gte: thirtyDaysAgo } },
      { postedDate: { $exists: false } },
      { postedDate: null },
      { createdAt: { $gte: thirtyDaysAgo } }
    ]
  });
  console.log('freshness matching:', fresh);

  // Combine Location, Roles, Exp, Sal, Fresh
  const combined = await Job.countDocuments({
    $and: [
      {
        $or: [
          { location: { $regex: /Chennai/i } },
          { location: { $regex: /Bengaluru/i } },
          { location: { $regex: /Remote/i } }
        ]
      },
      { $or: roleConditions },
      {
        $or: [
          { experienceLevel: { $in: ['Fresher'] } },
          { experienceLevel: { $exists: false } },
          { experienceLevel: null }
        ]
      },
      {
        $or: [
          { salaryMin: { $gte: 300000 } },
          { salaryMin: { $exists: false } },
          { salaryMin: null }
        ]
      },
      {
        $or: [
          { postedDate: { $gte: thirtyDaysAgo } },
          { postedDate: { $exists: false } },
          { postedDate: null },
          { createdAt: { $gte: thirtyDaysAgo } }
        ]
      }
    ]
  });
  console.log('All combined matching:', combined);

  await mongoose.disconnect();
}

debugQuery().catch(console.error);
