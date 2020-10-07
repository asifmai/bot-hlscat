const pupHelper = require('./puppeteerhelper');
const {
  siteLink
} = require('./keys');
const fs = require('fs');
let browser;
let channels = [];

const run = async () => {
  try {
    browser = await pupHelper.launchBrowser();

    await fetch();
    await saveResults();

    await browser.close();
  } catch (error) {
    if (browser) await browser.close();
    return error;
  }
};

const fetch = () => new Promise(async (resolve, reject) => {
  let page;
  try {
    page = await pupHelper.launchPage(browser);
    const response = await page.goto(siteLink, {
      timeout: 0,
      waitUntil: 'load'
    });

    await page.waitForSelector('.pagination > li:last-child > a');
    const numberOfPages = await page.$eval('.pagination > li:last-child > a', elm => Number(elm.getAttribute('data-ci-pagination-page').trim()));
    console.log(`Number of Pages: ${numberOfPages}`);

    for (let pageNumber = 1; pageNumber <= numberOfPages; pageNumber++) {
      console.log(`${pageNumber}/${numberOfPages} - Scraping page...`);
      if (pageNumber > 1) {
        await page.goto(`${siteLink}/${pageNumber}`, {
          timeout: 0,
          waitUntil: 'load'
        });
      }

      await page.waitForSelector('table.stream_table > tbody');

      const trs = await page.$$('table.stream_table > tbody > tr:not(.aa)');

      for (let i = 0; i < trs.length - 1; i = i + 2) {
        const isOnline = await trs[i].$('td:nth-of-type(4) > .online');
        const liveliness = await trs[i].$eval('td:nth-of-type(3)', elm => Number(elm.innerText.trim()));
        
        if (isOnline && liveliness > 50) {
          const channel = {
            status: 'online',
            name: '',
            url: '',
          }

          channel.name = await trs[i].$eval('td:nth-of-type(2)', elm => elm.innerText.trim());
          channel.url = await trs[i + 1].$eval('span.get_vlc', elm => elm.getAttribute('data-clipboard-text'));

          channels.push(channel);
        }
      }
    }

    await page.close();
    resolve(true);
  } catch (error) {
    if (page) await page.close();
    console.log(`Run Error: ${error}`);
    reject(error);
  }
})

const saveResults = () => new Promise(async (resolve, reject) => {
  try {
    const fileName = 'embyshare.m3u';

    for (let i = 0; i < channels.length; i++) {
      if (i == 0) {
        const header = '#EXTM3U\n#PLAYLIST:hlscat.com\n';
        fs.writeFileSync(fileName, header);
      }

      const line = `#EXTINF:0 tvg-country="US" tvg-logo="" group-title="Undefined",${channels[i].name}\n${channels[i].url}\n`;
      fs.appendFileSync(fileName, line);
    }

    resolve(true);
  } catch (error) {
    console.log(`saveResults Error: ${error}`);
    reject(error);
  }
});


run();