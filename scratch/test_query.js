const mongoose = require('mongoose');

// Schemas
const JobSchema = new mongoose.Schema({
  title: String,
  company: String,
  description: String,
  location: String,
  workType: String,
  salaryMin: Number,
  isClosed: Boolean,
  postedDate: Date,
  createdAt: Date
}, { strict: false });

const UserSchema = new mongoose.Schema({
  clerkId: String,
  email: String,
  filters: mongoose.Schema.Types.Mixed
}, { strict: false });

const ResumeSchema = new mongoose.Schema({
  userId: String,
  parsedProfile: mongoose.Schema.Types.Mixed
}, { strict: false });

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/ai_job_copilot');
  console.log('Connected');

  const Job = mongoose.model('Job', JobSchema);
  const User = mongoose.model('User', UserSchema);
  const Resume = mongoose.model('Resume', ResumeSchema);

  const user = await User.findOne({});
  const userId = user.clerkId;
  console.log('User ID:', userId);
  console.log('Filters in DB:', user.filters);

  function normalizeQueryLocation(loc) {
    const clean = (loc || '').toLowerCase().trim();
    if (!clean) return '';
    if (clean.includes('thiruvananthapuram') || clean.includes('thiruvanthapuram') || clean === 'tvm' || clean === 'trivandrum') {
      return 'Trivandrum|Thiruvananthapuram|Thiruvanthapuram|TVM';
    }
    if (clean === 'kochi' || clean === 'cochin' || clean === 'ernakulam') {
      return 'Kochi|Cochin|Ernakulam';
    }
    if (clean === 'bengaluru' || clean === 'bangalore' || clean === 'blr') {
      return 'Bengaluru|Bangalore';
    }
    return loc.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Build query
  const query = { isClosed: { $ne: true } };
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const andConditions = [];

  if (user && user.filters) {
    const { workTypes, minSalary, countries, experienceLevel, targetRoles, targetCompanies } = user.filters;

    if (workTypes && workTypes.length > 0) {
      andConditions.push({ workType: { $in: workTypes } });
    }
    
    if (minSalary) {
      andConditions.push({
        $or: [
          { salaryMin: { $gte: minSalary } },
          { salaryMin: { $exists: false } },
          { salaryMin: null }
        ]
      });
    }

    if (countries && countries.length > 0) {
      const locationConditions = countries.map(c => ({
        location: { $regex: new RegExp(normalizeQueryLocation(c), 'i') }
      }));
      andConditions.push({ $or: locationConditions });
    }

    if (targetCompanies && targetCompanies.length > 0) {
      const companyConditions = targetCompanies.filter(Boolean).map(company => ({
        company: { $regex: new RegExp(company.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      }));
      if (companyConditions.length > 0) andConditions.push({ $or: companyConditions });
    }

    if (experienceLevel) {
      let allowedLevels = [experienceLevel];
      if (experienceLevel === 'Fresher') {
        allowedLevels = ['Junior', 'Intern'];
      } else if (experienceLevel === 'Junior') {
        allowedLevels = ['Junior', 'Intern'];
      } else if (experienceLevel === 'Mid') {
        allowedLevels = ['Mid', 'Junior', 'Intern'];
      } else if (experienceLevel === 'Senior') {
        allowedLevels = ['Senior', 'Mid'];
      }

      andConditions.push({
        $or: [
          { experienceLevel: { $in: allowedLevels } },
          { experienceLevel: { $exists: false } },
          { experienceLevel: null }
        ]
      });
    }

    // Role filter
    let rolesFilter = targetRoles && targetRoles.length > 0
      ? [...targetRoles]
      : (user.filters.targetJobRole ? user.filters.targetJobRole.split(',').map(r => r.trim()).filter(Boolean) : []);

    // Resume enrichment
    const resume = await Resume.findOne({ userId, isAtsCheckOnly: { $ne: true } }).sort({ createdAt: -1 }).exec();
    if (resume) {
      console.log('Found resume');
      if (resume.parsedProfile?.experience && resume.parsedProfile.experience.length > 0) {
        const resumeRoles = resume.parsedProfile.experience.map(exp => exp.title?.trim()).filter(Boolean);
        rolesFilter = [...new Set([...rolesFilter, ...resumeRoles])];
      }
      if (resume.parsedProfile?.skills && resume.parsedProfile.skills.length > 0) {
        const topSkills = resume.parsedProfile.skills.slice(0, 5);
        rolesFilter = [...new Set([...rolesFilter, ...topSkills])];
      }
    } else {
      console.log('No resume found');
    }

    console.log('Initial rolesFilter:', rolesFilter);

    // Expand
    const roleAliasMap = {
      'software engineer': ['swe', 'software developer', 'sde', 'backend engineer', 'backend developer'],
      'frontend developer': ['react developer', 'ui developer', 'front-end engineer', 'frontend engineer', 'ui engineer', 'web developer'],
      'fullstack developer': ['fullstack engineer', 'full stack developer', 'full-stack developer', 'node developer', 'full stack engineer'],
      'backend developer': ['backend engineer', 'server-side developer', 'api developer', 'node developer', 'python developer'],
      'data scientist': ['ml engineer', 'machine learning engineer', 'ai engineer', 'data analyst', 'data engineer'],
      'devops engineer': ['site reliability engineer', 'sre', 'platform engineer', 'infrastructure engineer', 'cloud engineer'],
      'product manager': ['pm', 'product owner', 'program manager'],
      'ui ux designer': ['ux designer', 'ui designer', 'product designer', 'interaction designer', 'visual designer'],
      'mobile developer': ['ios developer', 'android developer', 'react native developer', 'flutter developer'],
    };

    const expandedRoles = new Set(rolesFilter);
    for (const role of rolesFilter) {
      const roleLower = role.toLowerCase().trim();
      for (const [canonical, aliases] of Object.entries(roleAliasMap)) {
        if (roleLower.includes(canonical) || aliases.some(a => roleLower.includes(a))) {
          aliases.forEach(a => expandedRoles.add(a));
          expandedRoles.add(canonical);
        }
      }
    }

    const finalRoles = [...expandedRoles].filter(Boolean);
    console.log('finalRoles:', finalRoles);

    if (finalRoles.length > 0) {
      const roleConditions = finalRoles.map(r => ({
        $or: [
          { title: { $regex: new RegExp(r.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
          { description: { $regex: new RegExp(r.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
        ]
      }));
      andConditions.push({ $or: roleConditions });
    }

    // Freshness
    andConditions.push({
      $or: [
        { postedDate: { $gte: thirtyDaysAgo } },
        { postedDate: { $exists: false } },
        { postedDate: null },
        { createdAt: { $gte: thirtyDaysAgo } }
      ]
    });

    query.$and = andConditions;
  }

  console.log('Query:', JSON.stringify(query, null, 2));

  const totalCount = await Job.countDocuments({ isClosed: { $ne: true } });
  console.log('Total Active Jobs in DB:', totalCount);

  const matchedJobs = await Job.find(query).limit(50).exec();
  console.log('Matched Jobs count:', matchedJobs.length);
  matchedJobs.forEach((mj, idx) => {
    console.log(`${idx + 1}. [${mj.workType}] ${mj.title} at ${mj.company} (${mj.location})`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
