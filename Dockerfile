FROM node:18
WORKDIR /src
COPY package*.json ./
RUN npm install
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD [ "npm", "start" ]
