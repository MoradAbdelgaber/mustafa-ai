const axios = require("axios");
const ApiRequest = require("../models/ApiRequest");

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

  async saveCheck(serialNo, record) {
    const body = {
      enrollid: record.enrollid,
      name: "",
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

    return axios.post(`http://localhost:${port}/ap/fingerprints/socket`, body);
  }
}

module.exports = AttendanceApi;
