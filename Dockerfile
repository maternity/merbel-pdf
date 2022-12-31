FROM node:lts-slim AS build

COPY . /merbel-pdf/
RUN cd /merbel-pdf && \
    npm install && \
    npm run build

FROM ubuntu:jammy

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    # Install node16
    apt-get install -y curl wget gpg && \
    curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    # Feature-parity with node.js base images.
    apt-get install -y --no-install-recommends git openssh-client && \
    npm install -g yarn && \
    # clean apt cache
    rm -rf /var/lib/apt/lists/* && \
    adduser guy

ENV NODE_ENV=production

COPY . /merbel-pdf/
COPY --from=build /merbel-pdf/build /merbel-pdf/build
WORKDIR /merbel-pdf
RUN npm install

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npx playwright install --with-deps chromium && \
    rm -rf /var/lib/apt/lists/*

USER guy
CMD node build/server.js 80

EXPOSE 80
