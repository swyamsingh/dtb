# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Your app binds to port 3001, but Vercel will manage the external port
EXPOSE 3001

# Define the command to run your app
CMD [ "node", "src/index.js" ]
