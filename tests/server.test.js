const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../app');

const savePath = path.join(__dirname, '..', 'save-data', 'caught-red.json');

describe('server routes', () => {
  afterAll(() => {
    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath);
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
});
