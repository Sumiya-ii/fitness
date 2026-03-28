import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { BarcodesController } from '../../src/barcodes/barcodes.controller';
import { BarcodesService } from '../../src/barcodes/barcodes.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Barcodes (e2e)', () => {
  let app: INestApplication;

  const mockLookup = {
    code: '4901234567890',
    food: {
      id: 'food-1',
      name: 'Pocky',
      servings: [{ id: 's-1', label: '1 box', grams: 75 }],
      nutrients: { caloriesPer100g: 480, proteinPer100g: 6, carbsPer100g: 65, fatPer100g: 22 },
    },
  };

  const mockService = {
    lookup: jest.fn().mockResolvedValue(mockLookup),
    submitUnknown: jest.fn().mockResolvedValue({ status: 'submitted', foodId: 'food-new' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BarcodesController],
      providers: [
        { provide: BarcodesService, useValue: mockService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('GET /barcodes/:code', () => {
    it('looks up a barcode', () =>
      request(app.getHttpServer())
        .get(url('barcodes/4901234567890'))
        .expect(200)
        .expect((res) => {
          expect(res.body.data.code).toBe('4901234567890');
          expect(res.body.data.food).toHaveProperty('name');
          expect(mockService.lookup).toHaveBeenCalledWith('4901234567890');
        }));
  });

  describe('POST /barcodes/submit', () => {
    const validSubmission = {
      code: '4901234567891',
      normalizedName: 'New Snack',
      caloriesPer100g: 400,
      proteinPer100g: 5,
      carbsPer100g: 60,
      fatPer100g: 18,
      servingLabel: '1 pack',
      gramsPerUnit: 50,
    };

    it('submits a barcode', () =>
      request(app.getHttpServer())
        .post(url('barcodes/submit'))
        .send(validSubmission)
        .expect(201)
        .expect((res) => {
          expect(res.body.data.status).toBe('submitted');
          expect(mockService.submitUnknown).toHaveBeenCalledWith(
            TEST_USER.id,
            expect.objectContaining({ code: '4901234567891' }),
          );
        }));

    it('rejects missing code', () =>
      request(app.getHttpServer())
        .post(url('barcodes/submit'))
        .send({ ...validSubmission, code: undefined })
        .expect(400));

    it('rejects negative calories', () =>
      request(app.getHttpServer())
        .post(url('barcodes/submit'))
        .send({ ...validSubmission, caloriesPer100g: -1 })
        .expect(400));

    it('rejects zero gramsPerUnit', () =>
      request(app.getHttpServer())
        .post(url('barcodes/submit'))
        .send({ ...validSubmission, gramsPerUnit: 0 })
        .expect(400));

    it('rejects code longer than 50 chars', () =>
      request(app.getHttpServer())
        .post(url('barcodes/submit'))
        .send({ ...validSubmission, code: 'x'.repeat(51) })
        .expect(400));

    it('accepts optional labelPhotoUrls', () =>
      request(app.getHttpServer())
        .post(url('barcodes/submit'))
        .send({ ...validSubmission, labelPhotoUrls: ['https://example.com/photo.jpg'] })
        .expect(201));
  });
});
