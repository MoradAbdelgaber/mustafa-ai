const axios = require("axios");
const ApiRequest = require("../models/ApiRequest");
const Device = require("../models/Device");
const Employee = require("../models/Employee");
class AttendanceApi {
  getPendingRequests() {
    return ApiRequest.find({ status: "pending" }).lean();
  }

  updateRequest(request) {
    return ApiRequest.findByIdAndUpdate(request._id, request);
  }

  executeRequest(request) {
    return new Promise((resolve, reject) => {
      return axios
        .post(request.url, request.body)
        .then(async (res) => {
          //update request
          request.result = "تم الارسال";
          request.status = "approved";
          request.date_done = new Date();
          resolve({ success: true });
        })
        .catch((e) => {
          //save error message
          request.result = e.response?.data?.error;
          //increase running times
          request.running_times++;
          request.last_executed_date = new Date();
          //reject request
          if (request.running_times == +process.env.maxRetry) {
            request.status = "rejected";
          }
          resolve({ success: false });
        });
    });
  }

  async watchRequests() {
    const requests = await this.getPendingRequests();
    if (!requests.length) {
      console.log("No pending requests");
      return;
    }

    for (const request of requests) {
      //run request
      await this.executeRequest(request);
      //update request
      await this.updateRequest(request);
    }

    return { success: true };
  }

  updateOldFlagEvents(records) {
    records.forEach((record) => {
      //check in
      if (record.event == 5) {
        record.event = 1;
      }

      //check out
      if (record.event == 6) {
        record.event = 2;
      }

      //break in
      if (record.event == 7) {
        record.event = 3;
      }

      //break out
      if (record.event == 8) {
        record.event = 4;
      }
    });
  }

  async updateOldFlagRecordsName(owner, records) {
    for (let record of records) {
      const emp = await Employee.findOne({ enroll_id: record.enrollid, owner });
      if (emp) {
        record.name = emp.name;
      }
    }
  }

  async saveLogs(sn, records) {
    //check device
    const device = await Device.findOne({ serial: sn });
    if (!device) {
      throw new Error(`Device with SN: ${sn} not found For Save Logs`);
    }

    //old device
    if (device.oldFlag) {
      //update events
      this.updateOldFlagEvents(records);
      //update name for records
      await this.updateOldFlagRecordsName(device.owner, records);
    }

    //save logs
    for (let record of records) {
      await this.saveCheck(sn, record).catch((err) => {
        console.log(err.response?.data);
      });
    }
  }

  async saveCheck(serialNo, record) {
    const body = {
      enrollid: record.enrollid,
      name: record.name,
      time: record.time,
      fetch_date: new Date().toISOString(),
      image: record.image ?? "",
      device_sn: serialNo,
      event: record.event,
    };

    const port =
      process.env.type == "DEV"
        ? process.env.appPortLocal
        : process.env.appPort;

    return axios.post(`http://localhost:${port}/api/fingerprints/socket`, body);
  }
}

module.exports = AttendanceApi;
