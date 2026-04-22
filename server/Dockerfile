FROM node:20-alpine

# Install compilers for hybrid execution
RUN apk update && apk add --no-cache \
    python3 \
    gcc \
    g++ \
    make \
    openjdk17 \
    curl \
    bash \
    dotnet8-sdk

# Install dotnet-script for C# support
ENV PATH="${PATH}:/root/.dotnet/tools"
RUN dotnet tool install -g dotnet-script

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
