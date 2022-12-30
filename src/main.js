import { Dataset, PuppeteerCrawler } from 'crawlee';
import fs from "fs";
import { Parser } from "json2csv";

const links = JSON.parse(fs.readFileSync('./src/links.json', 'utf8')).links;

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
  /**
   * クロールしたページの内容を処理するハンドラー
   */
  async requestHandler({ request, page, log }) {
    const title = (await page.title()).match(/(.*?)｜.*/)[1];
    log.info(`Processing ${request.url}, ${title}...`);

    // const content = await page.content()
    // console.log(content.match(/.*(<div.*?id="contents".*?>).*/)[1]);

    // 指定したselectorの要素を処理する
    const stats = await page.$$eval('div#contents.contents', ($posts) => {
      const baseStatsPattern = /.*?(\d+)\(/;

      const types = [
        $posts[0].querySelector('#base_anchor > table > tbody > tr:nth-child(8) > td:nth-child(2) > ul > li:nth-child(1) > a > img')?.getAttribute('alt'),
        $posts[0].querySelector('#base_anchor > table > tbody > tr:nth-child(8) > td:nth-child(2) > ul > li:nth-child(2) > a > img')?.getAttribute('alt')
      ].filter(a => a); // null削除

      const abilities = [
        $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(35) > td.c1 > a')?.innerText,
        $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(36) > td.c1 > a')?.innerText,
        $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(37) > td.c1 > a')?.innerText.replace('*', ''),
        $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(38) > td.c1 > a')?.innerText.replace('*', '')
      ].filter(a => a); // null削除

      return {
        types: types,
        weight: $posts[0].querySelector('#base_anchor > table > tbody > tr:nth-child(7) > td:nth-child(2) > ul > li:nth-child(1)').innerText.match(/(.*)kg/)[1],
        hitPointBaseStats: $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(2) > td.left').innerText.match(baseStatsPattern)[1],
        attackBaseStats: $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(3) > td.left').innerText.match(baseStatsPattern)[1],
        defenseBaseStats: $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(4) > td.left').innerText.match(baseStatsPattern)[1],
        specialAttackBaseStats: $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(5) > td.left').innerText.match(baseStatsPattern)[1],
        specialDefenseBaseStats: $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(6) > td.left').innerText.match(baseStatsPattern)[1],
        speedBaseStats: $posts[0].querySelector('#stats_anchor > table > tbody > tr:nth-child(7) > td.left').innerText.match(baseStatsPattern)[1],
        abilities: abilities,
      };
    });

    const moves = await page.$$eval('#move_list > tbody > tr', ($posts) => {
      let moves = new Set();
      // 覚える技のテーブルから列ごとに処理
      $posts.forEach(($post, i) => {
        // 変化技を省く(技名と技種別の2列になっているのでi+1で次の行の要素を利用する)
        const moveMainRow = $post.querySelector('td.move_name_cell > a');
        if (moveMainRow) {
          const type = $posts[i + 1].querySelector('td.physics > span')?.className
            ?? $posts[i + 1].querySelector('td.special > span')?.className
            ?? $posts[i + 1].querySelector('td.change > span')?.className;
          if (type !== 'change') {
            moves.add(moveMainRow.innerText);
          }
        }
      })

      return { moves: Array.from(moves) };
    });

    const data = {
      paldea_no: request.headers['paldea_no'],
      id: request.url.substring(request.url.lastIndexOf('/') + 1),
      name: title,
      ...stats,
      ...moves
    }

    // Store the results to the default dataset.
    await Dataset.pushData(data);
  },

  // This function is called if the page processing failed more than maxRequestRetries+1 times.
  failedRequestHandler({ request, log }) {
    log.error(`Request ${request.url} failed too many times.`);
  },
});

await crawler.addRequests(links);

// Run the crawler and wait for it to finish.
await crawler.run();

// 特定のキーでソートする処理
let tempData = await Dataset.getData();
let tempData2 = tempData.items;
tempData2.sort((a, b) => {
  if (a.paldea_no && b.paldea_no) {
    const noA = a.paldea_no
    const noB = b.paldea_no

    return noA - noB;
  } else {
    return 0
  }
})

// ソート後のデータをファイル出力する
const parser = new Parser({ header: true });
fs.writeFileSync('storage/key_value_stores/pokemon_sv/OUTPUT.json', JSON.stringify(tempData2));
fs.writeFileSync('storage/key_value_stores/pokemon_sv/OUTPUT.csv', parser.parse(tempData2));

// Dataset.exportToCSV('OUTPUT', { toKVS: 'pokemon_sv' })
// Dataset.exportToJSON('OUTPUT', { toKVS: 'pokemon_sv' })

console.log('Crawler finished.');