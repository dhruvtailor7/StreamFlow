# CCTV Recorder Service with Google Drive Integration

This service records CCTV footage from an RTSP stream, saves hourly clips, and uploads them to Google Drive. It uses a modular architecture with separate recorder and uploader services that communicate via MQTT.

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
2. The file should export an object with `id`, `name`, and `sql` properties
3. Example:

```javascript
module.exports = {
  id: 3,
  name: 'add_new_column',
  sql: `
    ALTER TABLE recordings 
    ADD COLUMN new_column TEXT;
  `
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

## Configuration

1. Create a `.env` file in the project root with the following variables:
   ```
   # MQTT Configuration
   MQTT_HOST=localhost
   MQTT_PORT=1883
   
   # RTSP Configuration (from constants.js)
   RTSP_USERNAME=your_username
   RTSP_PASSWORD=your_password
   RTSP_IP=192.168.1.6
   RTSP_PORT=5543
   ```

2. Update the RTSP URL and other settings in the `config/constants.js` file as needed.

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

## How It Works

1. **Recorder Service**:
   - Records hourly clips from the RTSP stream
   - Stores recording metadata in SQLite database
   - Sends MQTT message when recording is completed

2. **Uploader Service**:
   - Listens for new recording messages via MQTT
   - Uploads recordings to Google Drive
   - Updates the database with upload status
   - Periodically checks for failed uploads and retries

## Google Drive Structure

Recordings in Google Drive will be organized as:
- CCTV Recordings (main folder)
  - 2023-05-01 (date folder)
    - clip_00.mp4 (hourly clips)
    - clip_01.mp4
    - ...
  - 2023-05-02
    - ... 