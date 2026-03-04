import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | null = null;

/**
 * Sets up OpenTelemetry tracing with OTLP exporter.
 * Skips initialization if no endpoint is configured.
 *
 * @param endpoint - OTLP endpoint (e.g. http://localhost:4318). If not provided, uses OTEL_EXPORTER_OTLP_ENDPOINT env var.
 * @returns true if tracing was started, false if skipped
 */
export function setupTracing(endpoint?: string): boolean {
  const url = endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!url) {
    return false;
  }

  const traceUrl = url.endsWith('/v1/traces') ? url : `${url.replace(/\/$/, '')}/v1/traces`;
  const traceExporter = new OTLPTraceExporter({ url: traceUrl });

  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  return true;
}

/**
 * Shuts down the tracing SDK. Call before process exit to flush spans.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
