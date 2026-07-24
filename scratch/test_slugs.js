async function testSlug(name, ats, slug) {
  let url = '';
  if (ats === 'greenhouse') {
    url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  } else if (ats === 'lever') {
    url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  } else if (ats === 'ashby') {
    url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  }
  
  try {
    const res = await fetch(url);
    console.log(`${name} (${ats}/${slug}) | Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const jobsCount = ats === 'greenhouse' ? (data.jobs?.length || 0) : (ats === 'lever' ? (data.length || 0) : (data.jobs?.length || 0));
      console.log(`  Jobs Count: ${jobsCount}`);
    } else {
      const text = await res.text();
      console.log(`  Response: ${text.substring(0, 100)}`);
    }
  } catch (err) {
    console.log(`${name} (${ats}/${slug}) | Error: ${err.message}`);
  }
}

async function run() {
  console.log('Testing configured Greenhouse slugs...');
  await testSlug('Airbnb', 'greenhouse', 'airbnb');
  await testSlug('Stripe', 'greenhouse', 'stripe');
  await testSlug('Cloudflare', 'greenhouse', 'cloudflare');
  
  console.log('\nTesting OpenAI...');
  await testSlug('OpenAI (Ashby)', 'ashby', 'openai');
  await testSlug('OpenAI (Greenhouse)', 'greenhouse', 'openai');
  
  console.log('\nTesting Figma as Lever vs Greenhouse...');
  await testSlug('Figma (Lever)', 'lever', 'figma');
  await testSlug('Figma (Greenhouse)', 'greenhouse', 'figma');
  
  console.log('\nTesting Vercel as Ashby vs Greenhouse...');
  await testSlug('Vercel (Ashby)', 'ashby', 'vercel');
  await testSlug('Vercel (Greenhouse)', 'greenhouse', 'vercel');
}

run();
