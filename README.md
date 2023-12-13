![arbiter_banner](https://github.com/Arbiter-WRTC/client/assets/57457673/55b44136-8c74-4e0d-b970-b53eabdb020a)

## Overview

Arbiter's SFU is built using node.js, running on express.

## Developer Usage

The Arbiter SFU is designed to run on AWS ECS as a container, as a part of the Backend.

However, it is still possible to run it locally on your own machine.

### Running as a process

1) Run `npm install`
2) Initialize a .env file with
    - `SIGNAL_SERVER_URL` variable that references your Arbiter Signaling Stack
    - `RTC_CONFIG` variable that references STUN/TURN server(s) in the following format:
        `{"iceServers":[{"urls":"stun:url:3478"},{"urls":"turn:url:3478","username":"username","credential":"password"}]}`
    - `SFU_ID` variable that represents the unique ID of the SFU. Any string is acceptable.
3) Run `npm start` and the SFU will connect to your signaling server and be available for use.

### Running as a container

To run the SFU container, you will need to pass environment variables to the container upon instantiation to function properly. You need to include

1) `SIGNAL_SERVER_URL` variable that references your Arbiter Signaling Stack
2) `RTC_CONFIG` variable that references STUN/TURN server(s) in the following format:
        `{"iceServers":[{"urls":"stun:url:3478"},{"urls":"turn:url:3478","username":"username","credential":"password"}]}`
3) `SFU_ID` variable that represents the unique ID of the SFU. Any string is acceptable.

### Design

Arbiter's SFU is designed to use a Producer/Consumer relationship of stream forwarding. The diagram below demonstrates how peer streams are forwarded. Refer to [Arbiter's case study](https://arbiter-framework.com/case-study) for more detailed information.
![ProdConNegotiation3](https://github.com/Arbiter-WRTC/node-sfu/assets/57457673/2e1aa01d-b4c0-47b9-bf89-6a5dd713cad2)

## The Team

**<a href="https://github.com/watzmonium" target="_blank">Stephen Watzman</a>** _Software Engineer_ • Detroit, MI

**<a href="https://github.com/frye-t" target="_blank">Tyler Frye</a>** _Software Engineer_ • Tampa Bay, FL

**<a href="https://github.com/jayjayabose" target="_blank">Jay Jayabose</a>** _Software Engineer_ • New York, NY
