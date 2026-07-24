const jsearchKey = '86b15c97c7msh04098f639dede5ep1a000djsn26d712a620b0';

async function testEndpoint(path, params) {
  const url = `https://jsearch.p.rapidapi.com${path}?${params}`;
  try {
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': jsearchKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });
    console.log(`Path: ${path} | Status: ${response.status}`);
    const data = await response.json();
    console.log(`Response keys:`, Object.keys(data));
    if (data.data) {
      console.log(`Data type:`, Array.isArray(data.data) ? 'Array' : typeof data.data);
      if (Array.isArray(data.data)) {
        console.log(`Array length:`, data.data.length);
      } else if (data.data.jobs) {
        console.log(`jobs length:`, data.data.jobs.length);
      }
    } else if (data.error) {
      console.log(`Error message:`, data.error.message);
    }
  } catch (err) {
    console.log(`Path: ${path} | Request failed:`, err.message);
  }
}

async function run() {
  await testEndpoint('/search', 'query=React&num_pages=1');
  await testEndpoint('/search-v2', 'query=React&num_pages=1');
  await testEndpoint('/estimated-salary', 'job_title=Developer&location=US');
}

run().catch(console.error);
