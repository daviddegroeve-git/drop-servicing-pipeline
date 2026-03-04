FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Run the single-cycle script for Cloud Run Jobs
CMD ["node", "run_cloud_job.js"]
