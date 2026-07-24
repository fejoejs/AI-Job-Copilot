const jsearchKey = '86b15c97c7msh04098f639dede5ep1a000djsn26d712a620b0';

async function run() {
  const query = 'React Developer in India';
  const url = `https://jsearch.p.rapidapi.com/search-v2?query=React%20Developer%20in%20India&num_pages=1`;
  
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': jsearchKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
    }
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Body:', text);
}

run().catch(console.error);
