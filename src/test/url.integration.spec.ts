import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UrlController } from '../controllers/url.controller';
import { UrlService } from '../services/url.service';
import { UrlRepository } from '../repositories/url.repository';
import { default as fetch } from 'node-fetch';
const { v4: uuidv4 } = require('uuid');

describe('URL Shortening (e2e)', () => {
  let app: INestApplication;
  const testUrl = 'https://example.com/test-url';
  const realUrl = 'https://news.ycombinator.com/item?id=43979063';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UrlController],
      providers: [UrlService, UrlRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /proxy/urls', () => {
    it('should create a shortened URL', async () => {
      const response = await request(app.getHttpServer())
        .post('/proxy/urls')
        .send({ originalUrl: testUrl })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('originalUrl', testUrl);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('shortUrl');
      expect(response.body.shortUrl).toMatch(/^http:\/\/localhost:3000\/proxy\/[0-9a-f-]+$/);
    });

    it('should create a shortened URL with custom UUID', async () => {
      const customUuid = uuidv4();
      const response = await request(app.getHttpServer())
        .post('/proxy/urls')
        .send({ originalUrl: testUrl, id: customUuid })
        .expect(201);

      expect(response.body).toHaveProperty('id', customUuid);
      expect(response.body).toHaveProperty('originalUrl', testUrl);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('shortUrl');
      expect(response.body.shortUrl).toBe(`http://localhost:3000/proxy/${customUuid}`);
    });

    it('should return 400 for invalid URL', async () => {
      await request(app.getHttpServer())
        .post('/proxy/urls')
        .send({ originalUrl: 'not-a-valid-url' })
        .expect(400);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .post('/proxy/urls')
        .send({ originalUrl: testUrl, id: 'invalid-uuid' })
        .expect(400);
    });
  });

  describe('POST /proxy/urls/batch', () => {
    it('should create multiple shortened URLs', async () => {
      const urls = [
        { originalUrl: 'https://example.com/url1' },
        { originalUrl: 'https://example.com/url2', id: uuidv4() }
      ];

      const response = await request(app.getHttpServer())
        .post('/proxy/urls/batch')
        .send({ urls })
        .expect(201);

      expect(response.body).toHaveProperty('urls');
      expect(response.body.urls).toHaveLength(2);
      expect(response.body.urls[0]).toHaveProperty('id');
      expect(response.body.urls[0]).toHaveProperty('originalUrl', 'https://example.com/url1');
      expect(response.body.urls[0]).toHaveProperty('shortUrl');
      expect(response.body.urls[1]).toHaveProperty('id', urls[1].id);
      expect(response.body.urls[1]).toHaveProperty('originalUrl', 'https://example.com/url2');
      expect(response.body.urls[1]).toHaveProperty('shortUrl');
    });

    it('should handle invalid URLs in batch', async () => {
      const urls = [
        { originalUrl: 'https://example.com/valid' },
        { originalUrl: 'not-a-valid-url' },
        { originalUrl: 'https://example.com/valid2' }
      ];

      const response = await request(app.getHttpServer())
        .post('/proxy/urls/batch')
        .send({ urls })
        .expect(201);

      expect(response.body).toHaveProperty('urls');
      expect(response.body).toHaveProperty('errors');
      expect(response.body.urls).toHaveLength(2);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0]).toContain('Invalid URL format');
    });

    it('should handle invalid UUIDs in batch', async () => {
      const urls = [
        { originalUrl: 'https://example.com/valid', id: uuidv4() },
        { originalUrl: 'https://example.com/invalid', id: 'invalid-uuid' }
      ];

      const response = await request(app.getHttpServer())
        .post('/proxy/urls/batch')
        .send({ urls })
        .expect(201);

      expect(response.body).toHaveProperty('urls');
      expect(response.body).toHaveProperty('errors');
      expect(response.body.urls).toHaveLength(1);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0]).toContain('Invalid URL format');
    });
  });

  describe('GET /proxy/urls/:id', () => {
    let createdUrlId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/proxy/urls')
        .send({ originalUrl: testUrl });
      createdUrlId = response.body.id;
    });

    it('should return URL information', async () => {
      const response = await request(app.getHttpServer())
        .get(`/proxy/urls/${createdUrlId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', createdUrlId);
      expect(response.body).toHaveProperty('originalUrl', testUrl);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('shortUrl');
      expect(response.body.shortUrl).toMatch(/^http:\/\/localhost:3000\/proxy\/[0-9a-f-]+$/);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/proxy/urls/non-existent-uuid')
        .expect(400);
    });

    it('should return 404 for non-existent valid UUID', async () => {
      const nonExistentUuid = uuidv4();
      await request(app.getHttpServer())
        .get(`/proxy/urls/${nonExistentUuid}`)
        .expect(404);
    });
  });

  describe('GET /proxy/:id (redirect)', () => {
    let shortUrlId: string;
    let shortUrl: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/proxy/urls')
        .send({ originalUrl: realUrl });
      shortUrlId = response.body.id;
      shortUrl = response.body.shortUrl;
    });

    it('should redirect to the original URL', async () => {
      const response = await request(app.getHttpServer())
        .get(`/proxy/${shortUrlId}`)
        .expect(302)
        .expect('Location', realUrl);
    });
  });
}); 