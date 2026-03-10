import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { REQUEST_ID_HEADER } from './request-id.middleware';

describe('AllExceptionsFilter', () => {
  type MockResponse = {
    headersSent: boolean;
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  };

  const sentry = {
    isAvailable: false,
    captureException: jest.fn(),
  };

  const createHost = (response: MockResponse): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          method: 'GET',
          url: '/api/v1/protected',
          requestId: 'req-123',
        }),
      }),
    }) as ArgumentsHost;

  it('sets request id header before writing JSON response', () => {
    const order: string[] = [];
    const response: MockResponse = {
      headersSent: false,
      setHeader: jest.fn(() => order.push('setHeader')),
      status: jest.fn(),
      json: jest.fn(),
    };
    response.status.mockImplementation(() => {
      order.push('status');
      return response;
    });
    response.json.mockImplementation(() => {
      order.push('json');
      return response;
    });
    const filter = new AllExceptionsFilter(sentry as never);
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    filter.catch(exception, createHost(response));

    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-123');
    expect(order).toEqual(['setHeader', 'status', 'json']);
  });

  it('returns early when headers are already sent', () => {
    const response: MockResponse = {
      headersSent: true,
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn(),
    };
    const filter = new AllExceptionsFilter(sentry as never);
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    filter.catch(exception, createHost(response));

    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-123');
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
