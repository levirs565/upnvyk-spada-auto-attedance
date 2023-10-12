import {
  addSnapshot,
  attedanceUrlPrefix,
  initSnapshot,
  launchPuppeteer,
  login,
} from "./util.js";
import axios from "axios";

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
}

/**
 *
 * @param {import('puppeteer').Page} page
 * @param {string} id
 * @returns
 */
async function attedance(page, id) {
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
    return;
  }

  console.log("Mencoba mensubmit");
  await Promise.all([page.waitForNavigation(), openSubmitLink.click()]);
  await page.waitForNetworkIdle();

  if (page.url().startsWith(attedanceUrl)) {
    await pushLog(
      `Presensi "${courseName}" kemungkinan berhasil. Skip mengisi radio`
    );
    return;
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
    radio.text.toLowerCase().includes("present")
  );
  if (!presentRadio) {
    await pushLog(
      `Presensi "${courseName}" gagal. Alasan: radio present tidak ada`
    );
    return;
  }

  console.log("Mengisi radio");
  await presentRadio.label.click();

  const submitButton = await submitForm.$(
    "input[type='submit'][value~='save'i]"
  );

  console.log("Menyimpan presensi");
  await Promise.all([page.waitForNavigation(), submitButton.click()]);
  await page.waitForNetworkIdle();

  if (page.url().startsWith(attedanceUrl)) {
    await pushLog(
      `Presensi "${courseName}" kemungkinan berhasil. Pengisian radio berhasil`
    );
  }
}

async function run(id) {
  const browser = await launchPuppeteer();
  const page = await browser.newPage();
  if (!(await login(page))) {
    await pushLog("Presensi tidak dapat dilakukan karena login gagal.");
    return;
  }
  await initSnapshot();
  await attedance(page, id);
  await browser.close();
}

if (process.argv.length !== 3) {
  console.log("Wrong argument");
  process.exit();
}

run(process.argv[2]);
