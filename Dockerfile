FROM node:16-slim
ENV POOL_SIZE 4
ENV INSTANCE_JOB_LIMIT 30
ENV INSTANCE_JOB_TIMEOUT 30

RUN apt-get update \
    && apt-get install -y libasound2 libatk1.0-0 libatk-bridge2.0-0 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgconf-2-4 \
        libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libx11-6  \
        libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 gnupg2 gnupg gnupg1  \
        libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget 

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
        --no-install-recommends gconf-service \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

COPY . .

RUN npm install \
    && npm run build
# If you are building your code for production
# RUN npm ci --only=production

EXPOSE 3000
CMD [ "node", "./dist/index.js" ]
