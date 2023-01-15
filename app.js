const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const qs = require('qs');

class WebScraper {
  constructor(outputPath) {
    this.outputPath = outputPath;
  }

  async getHtml(url) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(error);
      return;
    }
  }

  getData(html, selector) {
    const $ = cheerio.load(html);
    return $(selector).text();
  }

  async getDataFromUrl(url, selector) {
    const html = await this.getHtml(url);
    return this.getData(html, selector);
  }

  async saveData(url) {
    const html = await this.getHtml(url);
    const $ = cheerio.load(html);
    try {
      const parsedUrl = new URL(url);
      const baseUrl = parsedUrl.protocol + '//' + parsedUrl.host;
      // get the current timestamp
      const timestamp = new Date().toISOString().replace(/:/g, "_");
      // create the output directory if it doesn't exist
      if (!fs.existsSync(this.outputPath)) {
        fs.mkdirSync(this.outputPath);
      }
      // create a new output folder inside the original output folder with a timestamp on the name
      const newOutputPath = path.join(this.outputPath, `${timestamp}_scraped_data`);
      if (!fs.existsSync(newOutputPath)) {
        fs.mkdirSync(newOutputPath);
      }
      // create subdirectories for images, css and js
      if (!fs.existsSync(path.join(newOutputPath, 'images'))) {
        fs.mkdirSync(path.join(newOutputPath, 'images'));
      }
      if (!fs.existsSync(path.join(newOutputPath, 'css'))) {
        fs.mkdirSync(path.join(newOutputPath, 'css'));
      }
      if (!fs.existsSync(path.join(newOutputPath, 'js'))) {
        fs.mkdirSync(path.join(newOutputPath, 'js'));
      }
      // save the HTML
      fs.writeFileSync(`${newOutputPath}/output.html`, html);

      // download and save images
      const images = $('img');
      for (let i = 0; i < images.length; i++) {
        const imgSrc = images[i].attribs.src;
        const imgUrl = new URL(imgSrc, baseUrl).href;
        const imgData = await axios.get(imgUrl, { responseType: 'arraybuffer' });
        const imgPath = path.parse(imgSrc);
        const imgName = imgPath.base;
        fs.writeFileSync(path.join(newOutputPath, 'images', imgName), imgData.data);
      }

     //FIXME CSS files are not generated // download and save CSS files
      const cssLinks = $('link[rel="stylesheet"]');
      for (let i = 0; i < cssLinks.length; i++) {
        try {
          const cssHref = cssLinks[i].attribs.href;
          if (!cssHref) continue;
          const cssUrl = new URL(cssHref, baseUrl).href;
          const cssData = await axios.get(cssUrl);
          const parsedUrl = qs.parse(cssHref);
          let cssName = "";
          if (parsedUrl.url) cssName = parsedUrl.url.split('/').pop();
          // check if file exists before write
          const filePath = path.join(newOutputPath, 'css', cssName);
          if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, cssData.data);
          }
          // change the link element to point to the local file path
          $(cssLinks[i]).attr('href', `./css/${cssName}`);
        } catch (error) {
          console.error(`Error downloading CSS file: ${error}`);
        }
      }


      // download and save JS files
      const jsLinks = $('script[src]');
      for (let i = 0; i < jsLinks.length; i++) {
        const jsSrc = jsLinks[i].attribs.src;
        const jsUrl = new URL(jsSrc, baseUrl).href;
        const jsData = await axios.get(jsUrl);
        const jsPath = path.parse(jsSrc);
        const jsName = jsPath.base;
        fs.writeFileSync(path.join(newOutputPath, 'js', jsName), jsData.data);
        // change the script element to point to the local file path
        $(jsLinks[i]).attr('src', `./js/${jsName}`);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

const outputPath = './output';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Enter the URL you would like to scrape: ", (scrapedUrl) => {
  if (!/^https?:\/\//.test(scrapedUrl)) {
    scrapedUrl = "http://" + scrapedUrl;
  }
  const scraper = new WebScraper(outputPath);
  // Loading text
  const loadingText = ['|', '/', '-', '\\'];
  let loadingIndex = 0;
  const loadingInterval = setInterval(() => {
    process.stdout.write(`\rLoading ${loadingText[loadingIndex]}`);
    loadingIndex = (loadingIndex + 1) % loadingText.length;
  }, 200);

  scraper.saveData(scrapedUrl).then(() => {
    clearInterval(loadingInterval);
    console.log('\nScraping complete.');
    rl.close();
  });
});