import puppeteer from "puppeteer";

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: process.env.CI === "true",
  });
  const page = await browser.newPage();

  await page.goto("https://spada.upnyk.ac.id/login/index.php");
  await page.waitForNetworkIdle();

  if (process.env.SPADA_PASSWORD.length == 0) {
    console.log("Password belum di set");
  }

  await page.type("#username", process.env.SPADA_USERNAME);
  await page.type("#password", process.env.SPADA_PASSWORD);

  const loginSelector = "#loginbtn";
  await page.waitForSelector(loginSelector);
  await page.click(loginSelector);

  await page.waitForNetworkIdle();

  console.log(
    process.env.SPADA_PASSWORD.substring(
      0,
      process.env.SPADA_PASSWORD.length / 2
    )
  );
  console.log(page.url());

  const courseLinkPrefix = "https://spada.upnyk.ac.id/course/view.php?id=";
  const courseLinkList = (
    await page.$$eval("a.list-group-item.list-group-item-action", (elList) =>
      elList.map((el) => el.href)
    )
  ).filter((link) => link.startsWith(courseLinkPrefix));

  const attendanceLinkSelector =
    "a[href^='https://spada.upnyk.ac.id/mod/attendance/view.php?id=']";

  for await (const courseLink of courseLinkList) {
    await page.goto(courseLink);
    await page.waitForNetworkIdle();
    const courseName = await page.$eval("h1", (el) => el.innerText);
    console.log(`Mencoba presensi ${courseName}`);

    if (!(await page.$(attendanceLinkSelector))) {
      console.log("Tidak ada link presensi");
      continue;
    }

    await Promise.all([
      page.waitForNavigation(),
      page.click(attendanceLinkSelector),
    ]);
    await page.waitForNetworkIdle();
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
    for await (const submitLink of submitLinkList) {
      console.log(`Mencoba ${submitLink}`);
      await page.goto(submitLink);
      await page.waitForNetworkIdle();

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
    await sleep(2000);
  }
  await sleep(5000);
  await browser.close();
})();
