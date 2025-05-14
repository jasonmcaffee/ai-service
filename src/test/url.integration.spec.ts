import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UrlController } from '../controllers/url.controller';
import { UrlService } from '../services/url.service';
import { UrlRepository } from '../repositories/url.repository';

describe('URL Shortening (e2e)', () => {
  let app: INestApplication;
  const testUrl = 'https://example.com/test-url';

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

    it('should return 400 for invalid URL', async () => {
      await request(app.getHttpServer())
        .post('/proxy/urls')
        .send({ originalUrl: 'not-a-valid-url' })
        .expect(400);
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

    it('should return 404 for non-existent UUID', async () => {
      await request(app.getHttpServer())
        .get('/proxy/urls/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);
    });
  });
}); 