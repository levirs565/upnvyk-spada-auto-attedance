import puppeteer from "puppeteer";
import fs from "fs-extra";
import path from "path";
import url from "url";
import "dotenv/config";

function testSleep(duration) {
  if (process.env.CI === "true") return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function fixTime(time) {
  const splitIndex = time.length - 2;
  return (
    time.substring(0, splitIndex) +
    (time.includes(":") ? " " : ":00 ") +
    time.substring(splitIndex)
  );
}

(async () => {
  const browser = await puppeteer.launch({
    headless: process.env.CI === "true",
  });
  const page = await browser.newPage();

  const loginUrl = "https://spada.upnyk.ac.id/login/index.php";
  await page.goto(loginUrl);
  await page.waitForNetworkIdle();

  if (process.env.SPADA_PASSWORD.length == 0) {
    console.log("Password belum di set");
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
        process.exit();
      } else {
        continue;
      }
    }

    break;
  }

  console.log("Mendapatkan daftar kursus");
  const courseLinkList = await Promise.all(
    (
      await page.$$('nav.list-group a[href^="https://spada.upnyk.ac.id/course/view.php?id="]')
    ).map((link) => link.evaluate((el) => el.href))
  );
  const snapshotDir = path.join(
    url.fileURLToPath(new URL(".", import.meta.url)),
    "snapshot"
  );
  const courseCsvFile = path.join(snapshotDir, "course-list.csv");
  const courseTimeCsvFile = path.join(snapshotDir, "course-times.csv");
  const snapshotCsvFile = path.join(snapshotDir, "index.csv");

  if (await fs.pathExists(snapshotDir)) await fs.remove(snapshotDir);
  await fs.mkdir(snapshotDir);
  await fs.appendFile(courseCsvFile, "Index,Nama\n");
  await fs.appendFile(courseTimeCsvFile, "Index,Date,StartTime,EndTime,Cron\n");
  await fs.appendFile(snapshotCsvFile, "Nama,Url\n");

  async function addSnapshot(name) {
    await fs.appendFile(snapshotCsvFile, `${name},${page.url()}\n`);
    await fs.writeFile(path.join(snapshotDir, name), await page.content());
  }

  for await (const [courseIndex, courseLink] of courseLinkList.entries()) {
    await page.goto(courseLink);
    await page.waitForNetworkIdle();
    const courseName = await page.$eval("h1", (el) => el.innerText);
    console.log(`Mencoba presensi ${courseName}`);

    await fs.appendFile(courseCsvFile, `${courseIndex},${courseName}\n`);

    const attedanceUrl =
      "https://spada.upnyk.ac.id/mod/attendance/view.php?id=";
    const attendanceLink = await page.$(
      `.activityinstance > a[href^='${attedanceUrl}']`
    );
    if (!attendanceLink) {
      console.log("Tidak ada link presensi");
      continue;
    }

    await Promise.all([page.waitForNavigation(), attendanceLink.click()]);
    await page.waitForNetworkIdle();

    await addSnapshot(`${courseIndex}-presensi.html`);

    const [date, timeRange] = await page.$eval(".datecol.cell.c0", (el) => [
      el.children[0].textContent,
      el.children[1].textContent,
    ]);
    let [startTime, endTime] = timeRange
      .split("-")
      .map((text) => fixTime(text.trim()));
    const startDate = new Date(`${date} ${startTime} GMT+7`);
    const startCron = `${startDate.getUTCMinutes()} ${startDate.getUTCHours()} * * ${startDate.getUTCDay()}`;
    await fs.appendFile(
      courseTimeCsvFile,
      `${courseIndex},${date},${startTime},${endTime},${startCron}\n`
    );

    console.log(startTime, endTime);

    const openSubmitLink = await page.$(
      "a[href^='https://spada.upnyk.ac.id/mod/attendance/attendance.php']"
    );
    if (!openSubmitLink) {
      console.log("Tidak ada link submit");
      continue;
    }

    console.log("Mencoba mensubmit");
    await Promise.all([page.waitForNavigation(), openSubmitLink.click()]);
    await page.waitForNetworkIdle();

    if (page.url().startsWith(attedanceUrl)) {
      console.log("Skip: Kemungkinan sudah teersimpan");
      continue;
    }

    await addSnapshot(`${courseIndex}-submit.html`);
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
      continue;
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

    await testSleep(2000);
  }
  await testSleep(5000);
  await browser.close();
})();
