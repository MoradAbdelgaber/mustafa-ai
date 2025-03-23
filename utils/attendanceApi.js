const axios = require("axios");

class AttendanceApi {
  async login() {
    const response = await axios.post(
      process.env.attendanceAPI + "/users/login",
      {
        user_name: process.env.attendanceUsername,
        pass: process.env.attendancePassword,
      }
    );

    return response.data;
  }

  async saveDevice(serialNo) {
    try {
      // const { token } = await this.login();
      // await axios.post(
      //   process.env.attendanceAPI + "/devices",
      //   {
      //     name: "Untitled",
      //     serial: serialNo,
      //     status: false,
      //     serverip: "0.0.0.0",
      //   },
      //   {
      //     headers: {
      //       Authorization: `Bearer ${token}`,
      //     },
      //   }
      // );
      return { success: true };
    } catch (error) {
      //added before
      if (error.response?.data == "Error creating device") {
        return { success: true };
      }
      throw error;
    }
  }

  async getPendingRequests() {
    const { token } = await this.login();
    const response = await axios.get(
      process.env.attendanceAPI + "/requests?status=pending",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return {
      token,
      requests: response.data,
    };
  }

  updateRequest(request, token) {
    return axios.put(
      process.env.attendanceAPI + "/requests/" + request._id,
      request,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
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
    const { requests, token } = await this.getPendingRequests();
    if (!requests.length) {
      console.log("No pending requests");
      return;
    }

    for (const request of requests) {
      //run request
      await this.executeRequest(request);
      //update request
      await this.updateRequest(request, token);
    }

    return { success: true };
  }

  async saveCheck(serialNo, record) {
    // const { token } = await this.login();
    const body = {
      enrollid: record.enrollid,
      name: "",
      time: record.time,
      fetch_date: new Date().toISOString(),
      image: record.image ?? "",
      device_sn: serialNo,
      event: record.event,
    };

    return axios.post(
      process.env.attendanceAPI + "/fingerprints/socket",
      body,
      {
        // headers: {
        //   Authorization: `Bearer ${token}`,
        // },
      }
    );
  }
}

module.exports = AttendanceApi;
