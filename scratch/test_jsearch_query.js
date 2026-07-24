const jsearchKey = '86b15c97c7msh04098f639dede5ep1a000djsn26d712a620b0';

async function run() {
  const query = 'React Developer';
  const url = `https://jsearch.p.rapidapi.com/search-v2?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': jsearchKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
    }
  });
  
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Jobs Count:', data.data?.jobs?.length || 0);
  if (data.data?.jobs?.length > 0) {
    console.log('First Job Title:', data.data.jobs[0].job_title);
  } else {
    console.log('Raw Response:', JSON.stringify(data));
  }
}

run().catch(console.error);
