import {
  addSnapshot,
  attedanceUrlPrefix,
  initSnapshot,
  launchPuppeteer,
  login,
} from "./util.js";
import axios from "axios";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTaskListItem } from "micromark-extension-gfm-task-list-item";
import { gfmTaskListItemFromMarkdown } from "mdast-util-gfm-task-list-item";
import { find } from "unist-util-find";
import { toString } from "mdast-util-to-string";
import { findAfter } from "unist-util-find-after";

async function getAttedanceState() {
  const response = await axios.get(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${process.env.CONTROL_ISSUE_ID}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Beaerer ${process.env.GITHUB_TOKEN}`,
      },
    }
  );

  const ast = fromMarkdown(response.data.body, "utf-8", {
    extensions: [gfmTaskListItem()],
    mdastExtensions: [gfmTaskListItemFromMarkdown()],
  });

  const stateHeading = find(
    ast,
    (node) => node.type === "paragraph" && /^state\s*:$/i.test(toString(node))
  );
  const stateList = findAfter(ast, stateHeading, "list");
  const checkedStateItem = find(
    stateList,
    (node) => node.type === "listItem" && node.checked
  );
  if (!checkedStateItem) return "present";
  return toString(checkedStateItem).trim().toLowerCase();
}

/**
 *
 * @param {string} body
 */
async function sendPushNotification(body) {
  return axios.post(
    "https://api.pushbullet.com/v2/pushes",
    {
      type: "link",
      title: "UPNYK SPADA Auto Attedance",
      body,
      url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    },
    {
      headers: {
        "Access-Token": process.env.PUSHBULLET_TOKEN,
      },
    }
  );
}

async function pushLog(body) {
  console.log(body);
  await sendPushNotification(body);
  console.log(`::notice ::${body}`);
}

/**
 *
 * @param {import('puppeteer').Page} page
 * @param {string} id
 * @returns
 */
async function attedance(page, id) {
  const state = await getAttedanceState();
  console.log(`Attedance akan dilaksanakan dengan status "${state}"`);

  await page.goto(attedanceUrlPrefix + id);
  await page.waitForNetworkIdle();

  const courseName = await page.$eval("h1", (el) => el.innerText);
  console.log(`Mencoba presensi ${courseName}`);

  await addSnapshot(page);

  const openSubmitLink = await page.$(
    "a[href^='https://spada.upnyk.ac.id/mod/attendance/attendance.php']"
  );
  if (!openSubmitLink) {
    await pushLog(
      `Presensi "${courseName}" gagal. Alasan: Tidak ada link submit`
    );
    return false;
  }

  console.log("Mencoba mensubmit");
  await Promise.all([page.waitForNavigation(), openSubmitLink.click()]);
  await page.waitForNetworkIdle();

  if (page.url().startsWith(attedanceUrlPrefix)) {
    await pushLog(
      `Presensi "${courseName}" kemungkinan berhasil. Skip mengisi radio`
    );
    return true;
  }

  await addSnapshot(page);
  const submitForm = await page.$(
    "form[action='https://spada.upnyk.ac.id/mod/attendance/attendance.php']"
  );
  const radios = await Promise.all(
    (
      await submitForm.$$("label:has(> input[type='radio'])")
    ).map(async (label) => ({
      label,
      text: await label.$eval("span", (span) => span.innerText),
    }))
  );
  const presentRadio = radios.find((radio) =>
    radio.text.toLowerCase().includes(state)
  );
  if (!presentRadio) {
    await pushLog(
      `Presensi "${courseName}" gagal. Alasan: radio present tidak ada`
    );
    return false;
  }

  console.log("Mengisi radio");
  await presentRadio.label.click();

  const submitButton = await submitForm.$(
    "input[type='submit'][value~='save'i]"
  );

  console.log("Menyimpan presensi");
  await Promise.all([page.waitForNavigation(), submitButton.click()]);
  await page.waitForNetworkIdle();

  if (page.url().startsWith(attedanceUrlPrefix)) {
    await pushLog(
      `Presensi "${courseName}" kemungkinan berhasil. Pengisian radio berhasil`
    );
    return true;
  }
  await pushLog(
    `Presensi "${courseName}" kemungkinan gagal. Kegagalan setelah submit form radio`
  );
  return false;
}

async function run(id) {
  const browser = await launchPuppeteer();
  const page = await browser.newPage();
  if (!(await login(page))) {
    await pushLog("Presensi tidak dapat dilakukan karena login gagal.");
    return;
  }
  await initSnapshot();
  const success = await attedance(page, id);
  await browser.close();
  if (!success) process.exitCode = 1;
}

if (process.argv.length !== 3) {
  console.log("Wrong argument");
  process.exit();
}

run(process.argv[2]);
