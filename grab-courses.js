import {
  attedanceUrlPrefix,
  courseUrlPrefix,
  launchPuppeteer,
  login,
} from "./util.js";
import fs from "fs-extra";

/**
 *
 * @param {import('puppeteer').Page} page
 */
async function getCourseData(page) {
  const url = page.url();
  const id = url.substring(url.lastIndexOf("=") + 1);
  const name = await page.$eval("h1", (el) => el.innerText);
  console.log(`Mendapatkan data kursus ${name}`);
  const attedanceLink = await page.$(
    `.activityinstance > a[href^='${attedanceUrlPrefix}']`
  );
  if (!attedanceLink) {
    console.log("Tidak ada link presensi");
    return {
      id,
      name,
    };
  }

  const attedanceUrl = await attedanceLink.evaluate((el) => el.href);

  await Promise.all([page.waitForNavigation(), attedanceLink.click()]);
  await page.waitForNetworkIdle();

  const dateTimeList = await page.$$(".datecol.cell.c0");
  const [date, timeRange] = await dateTimeList
    .at(-1)
    .evaluate((el) => [el.children[0].textContent, el.children[1].textContent]);
  return {
    id,
    name,
    attedanceUrl,
    date,
    timeRange,
  };
}

async function run() {
  const browser = await launchPuppeteer();
  const page = await browser.newPage();
  if (!(await login(page))) {
    console.log("Gagal login");
    return;
  }

  console.log("Mendapatkan daftar kursus");
  const courseLinkList = await Promise.all(
    (
      await page.$$(`nav.list-group a[href^="${courseUrlPrefix}"]`)
    ).map((link) => link.evaluate((el) => el.href))
  );

  const courseDataList = [];
  for await (const link of courseLinkList) {
    await page.goto(link);
    await page.waitForNetworkIdle();
    courseDataList.push(await getCourseData(page));
  }
  await browser.close();
  await fs.writeJSON("./courses.json", courseDataList);
}

run();
