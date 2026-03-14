/**
 * OpenTelemetry browser instrumentation.
 * Only active when VITE_OTEL_ENDPOINT is set at build time.
 */
const endpoint = import.meta.env.VITE_OTEL_ENDPOINT

if (endpoint) {
  Promise.all([
    import('@opentelemetry/sdk-trace-web'),
    import('@opentelemetry/instrumentation-fetch'),
    import('@opentelemetry/instrumentation-document-load'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
  ]).then(([
    { WebTracerProvider, BatchSpanProcessor },
    { FetchInstrumentation },
    { DocumentLoadInstrumentation },
    { OTLPTraceExporter },
    { Resource },
    { SEMRESATTRS_SERVICE_NAME },
  ]) => {
    const provider = new WebTracerProvider({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: import.meta.env.VITE_OTEL_SERVICE_NAME || 'doit-web',
      }),
    })

    provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    })))

    provider.register()

    new FetchInstrumentation({ propagateTraceHeaderCorsUrls: [/.*/] }).enable()
    new DocumentLoadInstrumentation().enable()

    console.log('[otel] tracing enabled ->', endpoint)
  }).catch(e => console.warn('[otel] failed to init:', e))
}
