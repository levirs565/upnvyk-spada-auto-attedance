import puppeteer from "puppeteer";
import fs from "fs-extra";
import path from "path";
import url from "url";
import "dotenv/config";

/**
 *
 * @param {puppeteer.Page} page
 * @returns {boolean}
 */
export async function login(page) {
  const loginUrl = "https://spada.upnyk.ac.id/login/index.php";
  await page.goto(loginUrl);
  await page.waitForNetworkIdle();

  if (process.env.SPADA_PASSWORD.length == 0) {
    console.log("Password belum di set");
    return false;
  }

  let repeatLoginCount = 0;
  while (true) {
    console.log("Mencoba login");
    await page.type("#username", process.env.SPADA_USERNAME);
    await page.type("#password", process.env.SPADA_PASSWORD);

    const loginSelector = "#loginbtn";
    await page.waitForSelector(loginSelector);

    await Promise.all([
      page.waitForNavigation(),
      await page.click(loginSelector),
    ]);

    await page.waitForNetworkIdle();

    if (page.url() === loginUrl) {
      console.log("Login gagal.");
      repeatLoginCount++;
      if (repeatLoginCount === 10) {
        break;
      } else {
        continue;
      }
    }

    return true;
  }

  return false;
}

export function isCI() {
  return process.env.CI === "true";
}

export const courseViewLink = "https://spada.upnyk.ac.id/course/view.php?id=";

const snapshotDir = path.join(
  url.fileURLToPath(new URL(".", import.meta.url)),
  "snapshot"
);
const snapshotCsvFile = path.join(snapshotDir, "index.csv");

export async function initSnapshot() {
  if (await fs.pathExists(snapshotDir)) return;
  await fs.mkdir(snapshotDir);
  await fs.appendFile(snapshotCsvFile, "Nama,Url\n");
}

/**
 *
 * @param {puppeteer.Page} page
 */

export async function addSnapshot(page) {
  const name = `${Date.now()}.html`;
  await fs.appendFile(snapshotCsvFile, `${name},${page.url()}\n`);
  await fs.writeFile(path.join(snapshotDir, name), await page.content());
}

export function launchPuppeteer() {
  return puppeteer.launch({
    headless: isCI(),
  });
}
