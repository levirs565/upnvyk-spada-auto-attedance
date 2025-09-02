import fs from "fs-extra";
import axios from "axios";
import "dotenv/config";

function fixTime(time) {
  const splitIndex = time.length - 2;
  return (
    time.substring(0, splitIndex) +
    (time.includes(":") ? " " : ":00 ") +
    time.substring(splitIndex)
  );
}

function generateJobDetail(course) {
  let [startTime] = course.timeRange
    .split("-")
    .map((text) => fixTime(text.trim()));
  const startDate = new Date(`${course.date} ${startTime}`);
  const body = {
    ref: "main",
    inputs: {
      attedance_id: course.attedanceId,
    },
  };
  return {
    job: {
      enabled: true,
      title: `${course.name}`,
      saveResponses: false,
      url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/auto.yaml/dispatches`,
      notification: {
        onFailure: false,
        onSuccess: false,
        onDisable: true,
      },
      extendedData: {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      type: 0,
      requestTimeout: 30,
      redirectSuccess: false,
      folderId: parseInt(process.env.CRONJOB_FOLDERID),
      schedule: {
        timezone: "Asia/Jakarta",
        hours: [startDate.getHours()],
        mdays: [-1],
        minutes: [startDate.getMinutes() + 1],
        months: [-1],
        wdays: [startDate.getDay()],
        expiresAt: 0,
      },
      requestMethod: 1,
    },
  };
}

function createJob(job) {
  return axios.put("https://api.cron-job.org/jobs", job, {
    headers: {
      Authorization: `Bearer ${process.env.CRONJOB_KEY}`,
    },
  });
}

async function run() {
  const courseDataList = await fs.readJSON("./courses.json");
  const maxReqPerMinute = 5;
  const delay = 60 * 1000 / maxReqPerMinute;
  for await (const courseData of courseDataList) {
    console.log(`Membuat cron ${courseData.name}`);
    if (!courseData.attedanceId) {
      console.log("Tidak ada link presensi");
      continue;
    }
    try {
      const response = await createJob(generateJobDetail(courseData));
      console.log(response.data);
    } catch (e) {
      if (e.response) {
        console.log("Error response: ");
        console.log(JSON.stringify(e.response.status));
        console.log(JSON.stringify(e.response.headers));
        console.log(JSON.stringify(e.response.data));
      } else if (e.request) {
        console.log("Error request: ");
        console.log(e.request);
      } else {
        console.log(`Error: ${e.message}`);
        console.log(e);
      }
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }
}

run();
