
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
  const page = await browser.newPage();


  console.log("Mendapatkan daftar kursus");
  const courseLinkList = await Promise.all(
    (
      await page.$$('nav.list-group a[href^=""]')
    ).map((link) => link.evaluate((el) => el.href))
  );
  const courseCsvFile = path.join(snapshotDir, "course-list.csv");
  const courseTimeCsvFile = path.join(snapshotDir, "course-times.csv");

  if (await fs.pathExists(snapshotDir)) await fs.remove(snapshotDir);
  await fs.mkdir(snapshotDir);
  await fs.appendFile(courseCsvFile, "Index,Nama\n");
  await fs.appendFile(courseTimeCsvFile, "Index,Date,StartTime,EndTime,Cron\n");
  await fs.appendFile(snapshotCsvFile, "Nama,Url\n");


  for await (const [courseIndex, courseLink] of courseLinkList.entries()) {
  }
  await testSleep(5000);
  await browser.close();
})();
