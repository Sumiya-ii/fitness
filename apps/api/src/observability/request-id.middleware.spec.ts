import { Request, Response } from 'express';
import { RequestIdMiddleware, REQUEST_ID_HEADER } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockNext: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockNext = jest.fn();
  });

  it('should generate UUID when X-Request-Id header is absent', () => {
    const req = { headers: {} } as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    middleware.use(req, res, mockNext);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.requestId);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use incoming X-Request-Id when present', () => {
    const incomingId = 'existing-request-id-123';
    const req = {
      headers: { [REQUEST_ID_HEADER.toLowerCase()]: incomingId },
    } as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    middleware.use(req, res, mockNext);

    expect(req.requestId).toBe(incomingId);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, incomingId);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should generate UUID when X-Request-Id is empty string', () => {
    const req = {
      headers: { [REQUEST_ID_HEADER.toLowerCase()]: '' },
    } as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    middleware.use(req, res, mockNext);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should trim whitespace from incoming request ID', () => {
    const incomingId = '  trimmed-id  ';
    const req = {
      headers: { [REQUEST_ID_HEADER.toLowerCase()]: incomingId },
    } as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    middleware.use(req, res, mockNext);

    expect(req.requestId).toBe('trimmed-id');
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'trimmed-id');
    expect(mockNext).toHaveBeenCalled();
  });
});
