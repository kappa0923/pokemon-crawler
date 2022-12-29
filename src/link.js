import { Dataset, PuppeteerCrawler } from 'crawlee';

const dataset = await Dataset.open('poketetus-links');

// Create an instance of the PuppeteerCrawler class - a crawler
// that automatically loads the URLs in headless Chrome / Puppeteer.
const crawler = new PuppeteerCrawler({
  // Here you can set options that are passed to the launchPuppeteer() function.
  launchContext: {
    launchOptions: {
      headless: true,
      // Other Puppeteer options
    },
  },
  async requestHandler({ request, page, log }) {
    log.info(`Processing ${request.url}...`);

    // A function to be evaluated by Puppeteer within the browser context.
    const data = await page.$$eval('#contents > div.pokemon_list_box > ul.pokemon_list > li', ($posts) => {
      let links = [];
      for (const $post of $posts) {
        links.push({
          url: 'https://yakkun.com' + $post.querySelector('a').getAttribute('href'),
          headers: { "paldea_no": $post.getAttribute('data-paldea-no') },
        });
      }
      return { links };
    });

    // Store the results to the default dataset.
    await dataset.pushData(data);
  },

  // This function is called if the page processing failed more than maxRequestRetries+1 times.
  failedRequestHandler({ request, log }) {
    log.error(`Request ${request.url} failed too many times.`);
  },
});

await crawler.addRequests([
  'https://yakkun.com/sv/zukan/',
]);

// Run the crawler and wait for it to finish.
await crawler.run();
dataset.exportToJSON('links', { toKVS: 'poketetus-links' })

console.log('Crawler finished.');