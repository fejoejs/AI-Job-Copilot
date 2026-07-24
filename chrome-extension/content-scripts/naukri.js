// Naukri Content Script for AI Job Assistant

function truncate(text, max = 180) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

function extractSingleJob() {
  const title = document.querySelector('.jd-header-title, .jd-title, h1[title]')?.innerText?.trim();
  
  const company = document.querySelector('.jd-header-comp-name a, .comp-name, .jd-header-comp-name')?.innerText?.trim();
  
  const location = document.querySelector('.location a, .location, .jd-header-comp-name ~ div .location')?.innerText?.trim();
  
  const rawDescription = document.querySelector('.job-desc, .jd-desc, .job-description')?.innerText;

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
            sourcePlatform: 'Naukri',
          }
        });
        console.log('[Extension] Extracted Naukri single job details:', title, 'at', company);
      }
    } catch (err) {
      console.warn('[Extension] Context invalidated. Please refresh the page.', err);
    }
  }
}

function extractSearchResults() {
  const cards = document.querySelectorAll('.srp-jobcard, .cust-job-tuple, article.jobTuple, .srp-jobtuple, [class*="job-tuple"]');
  console.log('[Extension] Naukri job search result cards found on page:', cards.length);
  
  let count = 0;
  cards.forEach(card => {
    const titleEl = card.querySelector('a.title, .title, a[class*="title"], [class*="job-title"]');
    const companyEl = card.querySelector('.comp-name, a.company, [class*="company"], [class*="org-name"]');
    const locationEl = card.querySelector('.loc-wrap, .location, [class*="location"], .locWdth, [class*="location"]');
    const linkEl = card.querySelector('a.title, a[class*="title"], a[class*="job-title"], a');

    const title = titleEl?.innerText?.trim() || titleEl?.title;
    const company = companyEl?.innerText?.trim() || companyEl?.title;
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
              sourcePlatform: 'Naukri',
            }
          });
        }
      } catch (err) {
        console.warn('[Extension] Context invalidated. Please refresh the page.', err);
      }
    }
  });
  if (count > 0) {
    console.log(`[Extension] Synced ${count} Naukri search results.`);
  }
}

setTimeout(() => {
  if (window.location.pathname.includes('/job-listings') || document.querySelector('.jd-title')) {
    extractSingleJob();
  } else {
    extractSearchResults();
  }
}, 2000);

let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(() => {
      if (window.location.pathname.includes('/job-listings') || document.querySelector('.jd-title')) {
        extractSingleJob();
      } else {
        extractSearchResults();
      }
    }, 2000);
  }
}).observe(document, { subtree: true, childList: true });
