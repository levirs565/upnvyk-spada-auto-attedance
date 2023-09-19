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

  const courseLinkPrefix = "https://spada.upnyk.ac.id/course/view.php?id=";
  const courseLinkList = (
    await page.$$eval("a.list-group-item.list-group-item-action", (elList) =>
      elList.map((el) => el.href)
    )
  ).filter((link) => link.startsWith(courseLinkPrefix));

  const attendanceLinkSelector =
    ".activityinstance > a[href^='https://spada.upnyk.ac.id/mod/attendance/view.php?id=']";

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

    if (!(await page.$(attendanceLinkSelector))) {
      console.log("Tidak ada link presensi");
      continue;
    }

    await Promise.all([
      page.waitForNavigation(),
      page.click(attendanceLinkSelector),
    ]);
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

    console.log(
      await page.$$eval("a", (elList) =>
        elList
          .filter((el) => el.innerText.toLowerCase().includes("submit"))
          .map((el) => [el.href, el.innerText, el.className, el.id])
      )
    );

    const submitLinkList = await page.$$eval("a", (elList) =>
      elList
        .filter((el) => el.innerText.toLowerCase().includes("submit"))
        .map((el) => el.href)
    );
    if (submitLinkList.length == 0) console.log("Tidak ada link submit");
    for await (const [submitIndex, submitLink] of submitLinkList.entries()) {
      console.log(`Mencoba ${submitLink}`);
      await page.goto(submitLink);
      await page.waitForNetworkIdle();

      await addSnapshot(`${courseIndex}-submit-${submitIndex}.html`);

      console.log(
        await page.$$eval("input", (elList) =>
          elList.map((el) => [el.value, el.className, el.id])
        )
      );

      console.log(
        await page.$$eval("button", (elList) =>
          elList.map((el) => [el.value, el.className, el.id])
        )
      );

      console.log(
        await page.$$eval("a", (elList) =>
          elList.map((el) => [el.href, el.innerText, el.className, el.id])
        )
      );
    }
    await testSleep(2000);
  }
  await testSleep(5000);
  await browser.close();
})();
