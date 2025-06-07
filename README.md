# Pokédex Tracker

This repository hosts a lightweight Express server and web client for keeping track of which Pokémon you have caught in the Game Boy games. Caught data is stored locally so you can resume your progress at any time.

## Getting Started

Install the dependencies with [pnpm](https://pnpm.io/):

```bash
pnpm install
```

Then run the server:

```bash
pnpm start
```

The server uses the `PORT` environment variable (default `3000`). You can place this and other variables in a `.env` file which is loaded automatically.

## Data Files

- `pokemon-data-gen1.json` and `pokemon-data-gen2.json` contain Pokédex information for Generations 1 and 2.
- Progress is saved under `save-data/<USER_ID>/caught-<game>.json` where `<USER_ID>` is the unique Google account id. An example file is included as `example_caught.json`.

## Authentication

This app uses Google OAuth for login via [Passport](https://www.passportjs.org/). To run locally you will need to create a Google OAuth client and provide these variables in your `.env` file:

```bash
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=some_random_string
```

Once configured, start the server and click "Login with Google" on the homepage.

## Docker

Use the provided `docker-compose.yml` to build and run the application:

```bash
docker-compose up
```

This will expose the configured port and mount the `save-data/` directory so your caught data persists between runs.
