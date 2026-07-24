// Indeed Content Script for AI Job Assistant

function truncate(text, max = 180) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

function extractSingleJob() {
  const title = document.querySelector('.jobsearch-JobInfoHeader-title, h1[class*="JobInfoHeader-title"]')?.innerText?.trim();
  
  const company = document.querySelector('[data-company-name="true"], .jobsearch-InlineCompanyRating a, .jobsearch-InlineCompanyRating div')?.innerText?.trim();
  
  const location = document.querySelector('.jobsearch-JobInfoHeader-subtitle div:last-child, #jobsearch-ViewJobButtons-container ~ div')?.innerText?.trim();
  
  const rawDescription = document.querySelector('#jobDescriptionText')?.innerText;

  if (title && company) {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          action: 'JOB_FOUND',
          data: {
            title,
            company,
            location: location || 'Remote',
            description: truncate(rawDescription),
            url: window.location.href,
            sourcePlatform: 'Indeed',
          }
        });
        console.log('[Extension] Extracted Indeed single job details:', title, 'at', company);
      }
    } catch (err) {
      console.warn('[Extension] Context invalidated. Please refresh the page.', err);
    }
  }
}

function extractSearchResults() {
  const cards = document.querySelectorAll('.job_seen_beacon, td.resultContent');
  let count = 0;
  cards.forEach(card => {
    const titleEl = card.querySelector('.jobTitle, a[id^="job_"] span');
    const companyEl = card.querySelector('.companyName, [class*="companyName"]');
    const locationEl = card.querySelector('.companyLocation, [class*="companyLocation"]');
    const linkEl = card.querySelector('a[id^="job_"], .jobTitle a');

    const title = titleEl?.innerText?.trim();
    const company = companyEl?.innerText?.trim();
    const location = locationEl?.innerText?.trim();
    const link = linkEl?.href;

    if (title && company && link) {
      count++;
      try {
        if (chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            action: 'JOB_FOUND',
            data: {
              title,
              company,
              location: location || 'Remote',
              url: link.split('?')[0],
              sourcePlatform: 'Indeed',
            }
          });
        }
      } catch (err) {
        console.warn('[Extension] Context invalidated. Please refresh the page.', err);
      }
    }
  });
  if (count > 0) {
    console.log(`[Extension] Synced ${count} Indeed search results.`);
  }
}

setTimeout(() => {
  if (window.location.pathname.includes('/viewjob') || document.querySelector('#jobDescriptionText')) {
    extractSingleJob();
  } else if (window.location.pathname.includes('/jobs') || document.querySelector('.job_seen_beacon')) {
    extractSearchResults();
  }
}, 2000);

let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(() => {
      if (window.location.pathname.includes('/viewjob') || document.querySelector('#jobDescriptionText')) {
        extractSingleJob();
      } else if (window.location.pathname.includes('/jobs') || document.querySelector('.job_seen_beacon')) {
        extractSearchResults();
      }
    }, 2000);
  }
}).observe(document, { subtree: true, childList: true });
