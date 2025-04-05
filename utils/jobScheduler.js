const Agenda = require("agenda");
const AttendanceApi = require("./attendanceApi");

class JobScheduler {
  attendanceApi = new AttendanceApi();
  constructor() {
    const dbPath =
      process.env.type == "DEV" ? process.env.dbLocal : process.env.db;

    this.agenda = new Agenda({ db: { address: dbPath } });
  }

  async initialize() {
    //define jobs
    this.defineRequestWatcher();

    // Start the agenda processor
    await this.agenda.start();

    //request-watcher
    await this.agenda.every(process.env.jobInterval, "request-watcher");
  }

  defineRequestWatcher() {
    this.agenda.define("request-watcher", async (job) => {
      this.attendanceApi
        .watchRequests()
        .then((_) => {
          console.log("Request watcher executed at : " + new Date());
        })
        .catch((err) => {
          console.log("Request watcher error at : " + new Date());
          console.log(err);
        });
    });
  }
}

module.exports = JobScheduler;
