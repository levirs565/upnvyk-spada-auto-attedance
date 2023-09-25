import {
  addSnapshot,
  attedanceUrlPrefix,
  initSnapshot,
  launchPuppeteer,
  login,
} from "./util.js";

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
    console.log("Tidak ada link submit");
    return;
  }

  console.log("Mencoba mensubmit");
  await Promise.all([page.waitForNavigation(), openSubmitLink.click()]);
  await page.waitForNetworkIdle();

  if (page.url().startsWith(attedanceUrlPrefix)) {
    console.log("Skip: Kemungkinan sudah teersimpan");
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
    console.log("Error: Radio Present tidak ada");
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
    console.log("Presensi sudah selesai");
  }
}

async function run(id) {
  const browser = await launchPuppeteer();
  const page = await browser.newPage();
  if (!(await login(page))) {
    console.log("Presensi tidak dapat dilakukan login gagal.");
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
