import express from 'express';
import cors from 'cors';
import https from 'https';
import fs from 'fs';
import SFU from './classes/SFU';
import 'dotenv/config';

/*
run this to run SFU locally to generate self-signed certificates
UBUNTU: openssl req -new -neopenssl req -new -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt
MACOS: openssl req -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt
*/

const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.crt', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const httpsServer = https.createServer(credentials, app);

app.use(cors());
const RTC_CONFIG = JSON.parse(process.env.RTC_CONFIG) || null;
const SIGNAL_SERVER_URL = process.env.SIGNAL_SERVER_URL;
const SFU_ID = process.env.SFU_ID
if (!SFU_ID || !RTC_CONFIG || !SIGNAL_SERVER_URL) {
  throw new Error("A valid .env configuration file needs to be included to run this server. Please refer to the documentation for more details.")
}
const sfu = new SFU(SIGNAL_SERVER_URL, RTC_CONFIG, SFU_ID);
sfu.listen();

export default httpsServer;
