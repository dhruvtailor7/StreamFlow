# CCTV Recorder Service with Google Drive Integration

This service records CCTV footage from an RTSP stream, saves clips, and uploads them to Google Drive. It uses a modular architecture with separate recorder and uploader services that communicate via MQTT.

## Architecture

The system consists of two main services:

1. **Recorder Service**: Records CCTV footage from RTSP stream and stores metadata in SQLite database
2. **Uploader Service**: Monitors for new recordings and uploads them to Google Drive

The services communicate via MQTT messages and share a SQLite database to track recording status.

## Database Migrations

The application uses a simple migration system to manage database schema changes. Migrations are applied automatically when the application starts.

### How Migrations Work

1. Migrations are stored as JavaScript files in the `db/migrations` directory
2. Each migration has a unique ID, name, and SQL statement
3. Migrations are applied in order of their IDs
4. Applied migrations are tracked in the `migrations` table
5. Only new migrations that haven't been applied yet will run

### Creating a New Migration

To add a new migration:

1. Create a new file in the `db/migrations` directory with format `XX-description.js` where XX is the next sequential number
2. The file should export an object with `id`, `name`, and `sql` properties. The migrations will be tracked and applied in the order of `id`.
3. Example:

```javascript
module.exports = {
  id: 3,
  name: 'add_new_column',
  up: [`
    ALTER TABLE recordings 
    ADD COLUMN new_column TEXT;
  `],
  down: [`ALTER TABLE recordings 
    DROP COLUMN new_column TEXT;`]
};
```

## Setup Google Drive API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Drive API for your project
4. Create service account credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create credentials" > "Service account"
   - Fill in the service account details
   - Grant this service account access to the project (Role: Editor)
   - Click "Create key" (JSON format)
   - Download the JSON file

5. Rename the downloaded JSON file to `credentials.json` and place it in the root directory of this project.

## Setup MQTT Broker

An MQTT broker is required for the services to communicate. You can:

1. Use a local broker such as [Mosquitto](https://mosquitto.org/):
   ```bash
   # Install on macOS
   brew install mosquitto
   
   # Start the broker
   mosquitto -c /usr/local/etc/mosquitto/mosquitto.conf
   ```

2. Use a hosted MQTT service like [HiveMQ](https://www.hivemq.com/) or [CloudMQTT](https://www.cloudmqtt.com/)

Update the MQTT configuration in `.env` if using a remote broker.

## Installation

```bash
npm install
```

## Environment Variables

1. Create a `.env` file in the project root. Look at the `.env.eample` for the variables that needs to be defined.

## Usage

You can run both services together or separately.

### Running both services together:

```bash
node index.js
# or
node index.js all
```

### Running recorder service only:

```bash
node recorder.js
# or
node index.js recorder
```

### Running uploader service only:

```bash
node uploader.js
# or
node index.js uploader
```

### Running uploader cron:

```bash
node uploaderCron.js
```

## How It Works

1. **Recorder Service**:
   - Records clips from the RTSP stream in parts.
   - Stores part recordings in folder and its corresponding metadata in SQLite database.

2. **Uploader Service**:
   - Subscribes to new recording topic.
   - Uploads recordings to Google Drive when ever recording is generated.
   - Updates the database with upload status and links.

3. **Uploader Cron**:
   - Cron which periodically check the table and process the pending/failed uploads.
   - Uploads recordings to Google Drive.
   - Updates the database with upload status and links.

## Google Drive Structure

Recordings in Google Drive will be organized as:

- CCTV Recordings (main folder)
  - 2023-05-01 (date folder)
    - segment_2025-06-15_15-40-00.mp4 (segments based on the segment duration from env)
    - segment_2025-06-15_16-40-00.mp4 
    - ...
  - 2023-05-02
    - ... 


## Future Improvements

- Integrate Docker for local development.

#### Recorder
  - Add support for other cloud providers for upload.
  - Add support for recording from multiple streams.

#### Uploader
  - Batch upload to google drive keeping in mind the rate limits