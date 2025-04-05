const WebSocket = require("ws");
const AttendanceApi = require("./attendanceApi");
const crypto = require("crypto");
const { readFile } = require("fs/promises");
const { join, dirname } = require("path");
const secretKey = "morad";
const secretIv = "mostafa";
const openLimit = true;

class WebSocketLoader {
  attendanceApi = new AttendanceApi();
  #registeredDevices = new Map();
  #pendingResponses = new Map();
  #pendingSendUserResponses = new Map();
  #serials = [];

  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      //load serials
      const filePath = join(__dirname, "../serials.txt"); //  dev
      // const filePath = join(dirname(process.execPath), "serials.txt"); // pkg
      const data = await readFile(filePath, "utf-8");
      //decrypt
      const decryptedData = this.decrypt(data.trim());
      this.#serials = decryptedData.split(",") || [];
      //initialize socket
      this.initializeSocket();
    } catch (error) {
      console.error("Error loading serials");
    }
  }

  formatKeyAndIV() {
    const keyBuffer = crypto.createHash("sha256").update(secretKey).digest(); // Ensure 32 bytes
    const ivBuffer = crypto.createHash("md5").update(secretIv).digest(); // Ensure 16 bytes
    return { key: keyBuffer, iv: ivBuffer };
  }

  encrypt(text) {
    const { key, iv } = this.formatKeyAndIV();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  decrypt(encryptedText) {
    const { key, iv } = this.formatKeyAndIV();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  isValid(serialNo) {
    //Free
    if (openLimit) return true;
    if (!this.#serials.length) return openLimit;
    //validate
    return this.#serials.includes(serialNo);
  }

  initializeSocket() {
    const wsPort =
      process.env.type == "DEV" ? process.env.wsPortLocal : process.env.wsPort;
    this.server = new WebSocket.Server({ port: wsPort });
    this.server.on("connection", (ws, req) => {
      console.log(`New connection from ${req.socket.remoteAddress}`);
      ws.on("message", (message) => this.handleMessage(ws, message));
      ws.on("close", (code, reason) => this.handleClose(ws, code, reason));
    });
    console.log(`WebSocket server started on port ${wsPort}`);
  }

  handleMessage(ws, message) {
    try {
      const jsonMsg = JSON.parse(message);
      console.log("🚀 Received :", jsonMsg);
      const cmd = jsonMsg.cmd;
      const ret = jsonMsg.ret;
      const sn = jsonMsg.sn;

      //validate serial
      if (!this.isValid(sn)) {
        console.error("Invalid serial number : " + sn);
        return;
      }

      if (cmd) {
        switch (cmd) {
          case "reg":
            this.handleRegister(ws, jsonMsg);
            break;
          case "sendlog":
            this.handleSendLog(ws, jsonMsg);
            break;
          case "senduser":
            this.handleSendUser(ws, jsonMsg);
            break;
          default:
            console.log(`Unknown command: ${cmd}`);
        }
      } else if (ret) {
        this.handleResponse(ws, jsonMsg);
      } else {
        console.log("Invalid message format");
      }
    } catch (error) {
      console.error(`Error parsing message: ${error.message}`);
    }
  }

  async handleRegister(ws, jsonMsg) {
    const sn = jsonMsg.sn;

    //save socket
    this.#registeredDevices.set(sn, ws);
    console.log(`Device registered with SN: ${sn}`);

    //send response to device
    const response = {
      ret: "reg",
      result: true,
      cloudtime: new Date().toISOString(),
    };
    ws.send(JSON.stringify(response));
  }

  async handleSendLog(ws, jsonMsg) {
    const records = jsonMsg.record;
    //save logs
    for (let record of records) {
      await this.attendanceApi.saveCheck(jsonMsg.sn, record).catch((err) => {
        console.log(err.response?.data);
      });
    }

    // logging
    records.forEach((record) => {
      const enrollid = record.enrollid;
      const time = record.time;
      const mode = record.mode;
      const inout = record.inout;
      const event = record.event;
      console.log(
        `Log Entry: enrollid=${enrollid}, time=${time}, mode=${mode}, inout=${inout}, event=${event}`
      );
    });

    // send response to device
    const serverTime = new Date().toISOString();
    const response = {
      ret: "sendlog",
      result: true,
      cloudtime: serverTime,
      access: 1, // يمكن تعديلها حسب الحاجة
      message: "Access granted",
    };
    ws.send(JSON.stringify(response));
  }

  handleSendUser(ws, jsonMsg) {
    const enrollid = jsonMsg.enrollid;
    const sn = jsonMsg.sn;
    const backupnum = jsonMsg.backupnum;

    /*
     * backupnum
     * 0~9 fingerprint ,20-27 is static face,30-37 is parlm,50 is photo
     * 11 Rfid card , 10 password
     */

    //send send Data to client
    if (this.#pendingSendUserResponses.has(sn)) {
      const { resolve, timeout } = this.#pendingSendUserResponses.get(sn);
      clearTimeout(timeout);
      resolve({ result: true, ...jsonMsg });
      this.#pendingSendUserResponses.delete(sn);
    }

    //confirm receiving
    const response = {
      ret: "senduser",
      result: true,
      enrollid: enrollid,
      backupnum: backupnum,
    };
    ws.send(JSON.stringify(response));
  }

  handleResponse(ws, jsonMsg) {
    const ret = jsonMsg.ret;
    const sn = this.getSNBySession(ws);

    if (ret && this.#pendingResponses.has(sn)) {
      const { resolve, timeout } = this.#pendingResponses.get(sn);
      clearTimeout(timeout);
      resolve(jsonMsg);
      this.#pendingResponses.delete(sn);
    } else {
      console.log(`No pending request or unknown response: ${ret}`);
    }
  }

  handleClose(ws, code, reason) {
    console.log(`Connection closed: ${code} - ${reason}`);
    const sn = this.getSNBySession(ws);
    if (sn) {
      this.#registeredDevices.delete(sn);
      console.log(`Device with SN: ${sn} disconnected`);
    }
  }

  getSNBySession(ws) {
    for (const [sn, session] of this.#registeredDevices.entries()) {
      if (session === ws) {
        return sn;
      }
    }
    return null;
  }

  sendCommand(sn, payload) {
    if (!this.isValid(sn)) {
      throw new Error(`Invalid serial number: ${sn}`);
    }

    const session = this.#registeredDevices.get(sn);
    if (!session) {
      throw new Error(`No session found for device with SN: ${sn}`);
    }

    console.log(`Sending payload to device ${sn}: ${JSON.stringify(payload)}`);
    session.send(JSON.stringify(payload));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingResponses.delete(sn);
        reject(new Error(`Timeout waiting for response from SN: ${sn}`));
      }, 30000); // مهلة الانتظار 10 ثوانٍ

      this.#pendingResponses.set(sn, { resolve, reject, timeout });
    });
  }

  isRegistered(sn) {
    return this.#registeredDevices.has(sn);
  }

  // دوال للعمليات المختلفة

  async getUserList(sn, from = 0, to = 100) {
    const payload = {
      cmd: "getuserlist",
      stn: true,
      from,
      to,
    };
    return await this.sendCommand(sn, payload);
  }

  async getUserInfo(sn, enrollid, backupnum) {
    const payload = {
      cmd: "getuserinfo",
      enrollid,
      backupnum,
    };
    return await this.sendCommand(sn, payload);
  }

  async setUserInfo(sn, userInfo) {
    const payload = {
      cmd: "setuserinfo",
      ...userInfo,
    };
    return await this.sendCommand(sn, payload);
  }

  async deleteUser(sn, enrollid, backupnum) {
    const payload = {
      cmd: "deleteuser",
      enrollid,
      backupnum,
    };
    return await this.sendCommand(sn, payload);
  }

  async cleanUser(sn) {
    const payload = {
      cmd: "cleanuser",
    };
    return await this.sendCommand(sn, payload);
  }

  async getNewLog(sn, from = 0, to = 100) {
    const payload = {
      cmd: "getnewlog",
      stn: true,
      from,
      to,
    };
    return await this.sendCommand(sn, payload);
  }

  async getAllLog(sn, stn = true, from = 0, to = 100) {
    const payload = {
      cmd: "getalllog",
      stn,
      from,
      to,
    };
    return await this.sendCommand(sn, payload);
  }

  async cleanLog(sn) {
    const payload = {
      cmd: "cleanlog",
    };
    return await this.sendCommand(sn, payload);
  }

  async initSys(sn) {
    const payload = {
      cmd: "initsys",
    };
    return await this.sendCommand(sn, payload);
  }

  async cleanAdmin(sn) {
    const payload = {
      cmd: "cleanadmin",
    };
    return await this.sendCommand(sn, payload);
  }

  async setDevInfo(sn, devInfo) {
    const payload = {
      cmd: "setdevinfo",
      ...devInfo,
    };
    return await this.sendCommand(sn, payload);
  }

  async getDevInfo(sn) {
    const payload = {
      cmd: "getdevinfo",
    };
    return await this.sendCommand(sn, payload);
  }

  async openDoor(sn) {
    const payload = {
      cmd: "opendoor",
    };
    return await this.sendCommand(sn, payload);
  }

  // الدوال الجديدة التي طلبتها

  async setDevLock(sn, devLockInfo) {
    const payload = {
      cmd: "setdevlock",
      ...devLockInfo,
    };
    return await this.sendCommand(sn, payload);
  }

  async getDevLock(sn) {
    const payload = {
      cmd: "getdevlock",
    };
    return await this.sendCommand(sn, payload);
  }

  async getUserLock(sn, enrollid) {
    const payload = {
      cmd: "getuserlock",
      enrollid,
    };
    return await this.sendCommand(sn, payload);
  }

  async setUserLock(sn, userLockInfo) {
    const payload = {
      cmd: "setuserlock",
      ...userLockInfo,
    };
    return await this.sendCommand(sn, payload);
  }

  async deleteUserLock(sn, enrollid) {
    const payload = {
      cmd: "deleteuserlock",
      enrollid,
    };
    return await this.sendCommand(sn, payload);
  }

  async cleanUserLock(sn) {
    const payload = {
      cmd: "cleanuserlock",
    };
    return await this.sendCommand(sn, payload);
  }

  async disableDevice(sn) {
    const payload = {
      cmd: "disabledevice",
    };
    return await this.sendCommand(sn, payload);
  }

  async enableDevice(sn) {
    const payload = {
      cmd: "enabledevice",
    };
    return await this.sendCommand(sn, payload);
  }

  async getHoliday(sn, index = 0, stn = true) {
    const payload = {
      cmd: "getholiday",
      index,
      stn,
    };
    return await this.sendCommand(sn, payload);
  }

  async setHoliday(sn, holidayInfo) {
    const payload = {
      cmd: "setholiday",
      ...holidayInfo,
    };
    return await this.sendCommand(sn, payload);
  }

  async deleteHoliday(sn, index) {
    const payload = {
      cmd: "deleteholiday",
      index,
    };
    return await this.sendCommand(sn, payload);
  }

  async cleanHoliday(sn) {
    const payload = {
      cmd: "cleanholiday",
    };
    return await this.sendCommand(sn, payload);
  }

  async getDeviceInfo(sn) {
    const payload = {
      cmd: "getdevcap",
    };
    return await this.sendCommand(sn, payload);
  }

  async getReport(sn, reportInfo) {
    const payload = {
      cmd: "getalllog",
      stn: true,
      ...reportInfo,
    };
    return await this.sendCommand(sn, payload);
  }

  async addUserInfo(sn, userInfo) {
    const payload = {
      cmd: "adduser",
      flag: 2,
      ...userInfo,
    };

    //check live session
    const session = this.#registeredDevices.get(sn);
    if (!session) {
      throw new Error(`No session found for device with SN: ${sn}`);
    }

    console.log(`Sending payload to device ${sn}: ${JSON.stringify(payload)}`);
    session.send(JSON.stringify(payload));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingSendUserResponses.delete(sn);
        reject(
          new UnprocessableEntityException(
            `Timeout waiting for response from SN: ${sn}`
          )
        );
      }, 30000); // 30 seconds

      this.#pendingSendUserResponses.set(sn, { resolve, reject, timeout });
    });
  }

  async getTime(sn) {
    const payload = {
      cmd: "gettime",
    };
    return await this.sendCommand(sn, payload);
  }

  async setTime(sn, time) {
    const payload = {
      cmd: "settime",
      cloudtime: time,
    };
    return await this.sendCommand(sn, payload);
  }

  async getStatus(sn) {
    await this.getTime(sn);
    return {
      result: true,
      online: this.#registeredDevices.has(sn),
    };
  }

  async reboot(sn) {
    const payload = {
      cmd: "reboot",
    };
    this.sendCommand(sn, payload).catch((err) =>
      console.log(`reboot device : ${sn} `)
    );
    return { ret: "reboot", sn, result: true };
  }

  async dynamicEvent(sn, payload) {
    return await this.sendCommand(sn, payload);
  }
}

module.exports = WebSocketLoader;
