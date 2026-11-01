const request = require('supertest');
const fs = require('fs');
const path = require('path');
process.env.BYPASS_AUTH_FOR_TESTS = 'true';
const app = require('../app');

const savePath = path.join(__dirname, '..', 'save-data', 'guest', 'caught-red.json');
const emeraldSavePath = path.join(__dirname, '..', 'save-data', 'guest', 'caught-emerald.json');

describe('server routes', () => {
  afterAll(() => {
    [savePath, emeraldSavePath].forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
    const dir = path.dirname(savePath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  });

  test('GET /caught/red returns an object', async () => {
    const res = await request(app).get('/caught/red');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  test('POST /caught/red saves data', async () => {
    const payload = { id: 1, caught: true };
    const res = await request(app).post('/caught/red').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Data saved for red' });
  });

  test('POST then GET /caught/emerald round-trips data', async () => {
    await request(app).post('/caught/emerald').send({ id: 252, caught: true });
    const res = await request(app).get('/caught/emerald');
    expect(res.status).toBe(200);
    expect(res.body['252']).toBe(true);
  });

  test('GET /pokemon-data-gen3.json serves Gen 3 Pokémon with Emerald data', async () => {
    const res = await request(app).get('/pokemon-data-gen3.json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(135);
    expect(res.body[0]).toMatchObject({ id: 252, name: 'Treecko', hoennDex: 1 });
    expect(res.body[0].availability.emerald.catchable).toBe(true);
  });

  test.each(['ruby', 'sapphire', 'firered', 'leafgreen'])('GET /caught/%s is supported', async (game) => {
    const res = await request(app).get(`/caught/${game}`);
    expect(res.status).toBe(200);
  });

  test('glitch methods only cover Pokémon that are not normally catchable', async () => {
    const res = await request(app).get('/glitch-methods.json');
    expect(res.status).toBe(200);
    const files = ['pokemon-data-gen1.json', 'pokemon-data-gen2.json', 'pokemon-data-gen3.json'];
    const byId = Object.fromEntries(files.flatMap(file => JSON.parse(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))).map(p => [p.id, p]));
    for (const [game, entries] of Object.entries(res.body.games)) {
      for (const [id, entry] of Object.entries(entries)) {
        expect(res.body.methods[entry.method]).toBeDefined();
        expect(byId[id].availability[game].catchable).toBe(false);
      }
    }
  });

  test('every Pokémon has availability for all Gen III games', async () => {
    const files = ['pokemon-data-gen1.json', 'pokemon-data-gen2.json', 'pokemon-data-gen3.json'];
    const all = files.flatMap(file => JSON.parse(fs.readFileSync(path.join(__dirname, '..', file), 'utf8')));
    expect(all).toHaveLength(386);
    for (const game of ['ruby', 'sapphire', 'emerald', 'firered', 'leafgreen']) {
      expect(all.every(p => typeof p.availability[game]?.catchable === 'boolean')).toBe(true);
    }
  });
});
