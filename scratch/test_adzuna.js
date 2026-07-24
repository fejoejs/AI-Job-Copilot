const adzunaId = 'b0f9195c';
const adzunaKey = 'bd75f08bd1bd9e98ddb06095fc2185b2';

async function run() {
  const role = 'React';
  const countryCode = 'in';
  const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?app_id=${adzunaId}&app_key=${adzunaKey}&what=${encodeURIComponent(role)}&results_per_page=20&content-type=application/json`;
  
  const response = await fetch(url);
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Results Count:', data.results?.length || 0);
  if (data.results?.length > 0) {
    console.log('First Job:', data.results[0].title, '| Location:', data.results[0].location?.display_name);
  }
}

run().catch(console.error);
