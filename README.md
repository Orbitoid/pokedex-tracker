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
- Progress is saved under `save-data/` in files named `caught-<game>.json`. An example file is included as `example_caught.json`.

## Docker

Use the provided `docker-compose.yml` to build and run the application:

```bash
docker-compose up
```

This will expose the configured port and mount the `save-data/` directory so your caught data persists between runs.
