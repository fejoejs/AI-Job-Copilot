// LinkedIn Content Script for AI Job Assistant

function truncate(text, max = 180) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

function extractSingleJob() {
  // Try several selectors for LinkedIn job title, company name, location, and description
  const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24')?.innerText?.trim();
  
  const company = document.querySelector('.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .jobs-unified-top-card__primary-description a')?.innerText?.trim();
  
  const location = document.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, .jobs-unified-top-card__primary-description span:nth-of-type(1)')?.innerText?.trim();
  
  const rawDescription = document.querySelector('.jobs-description__content, .jobs-box__html-content, #job-details')?.innerText;

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
            sourcePlatform: 'LinkedIn',
          }
        });
        console.log('[Extension] Extracted single job details:', title, 'at', company);
      }
    } catch (err) {
      console.warn('[Extension] Context invalidated. Please refresh the page.', err);
    }
  }
}

function extractSearchResults() {
  // Selector for job list items in LinkedIn searches
  const cards = document.querySelectorAll('.job-card-container, .jobs-search-results-list__list-item');
  let count = 0;
  cards.forEach(card => {
    const titleEl = card.querySelector('.job-card-list__title, .disabled-job-card__job-title');
    const companyEl = card.querySelector('.job-card-container__company-name, .job-card-container__company-link');
    const locationEl = card.querySelector('.job-card-container__metadata-item, .job-card-container__metadata-item--subtitle');
    const linkEl = card.querySelector('a.job-card-list__title, a.job-card-container__link, a');

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
              url: link.split('?')[0], // strip tracking params
              sourcePlatform: 'LinkedIn',
            }
          });
        }
      } catch (err) {
        console.warn('[Extension] Context invalidated. Please refresh the page.', err);
      }
    }
  });
  if (count > 0) {
    console.log(`[Extension] Synced ${count} search list matches.`);
  }
}

// Run extraction on load after elements render
setTimeout(() => {
  if (window.location.pathname.includes('/jobs/view/') || document.querySelector('.jobs-description__content')) {
    extractSingleJob();
  } else if (window.location.pathname.includes('/jobs/search')) {
    extractSearchResults();
  }
}, 2000);

// Setup page URL mutation observer to detect ajax tab navigation changes
let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(() => {
      if (window.location.pathname.includes('/jobs/view/') || document.querySelector('.jobs-description__content')) {
        extractSingleJob();
      } else if (window.location.pathname.includes('/jobs/search')) {
        extractSearchResults();
      }
    }, 2000);
  }
}).observe(document, { subtree: true, childList: true });
