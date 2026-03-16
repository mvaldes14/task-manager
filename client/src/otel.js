/**
 * OpenTelemetry browser instrumentation.
 * Endpoint is fetched at runtime from /api/settings so no build-time baking needed.
 */
let _initialized = false

export async function initOtel() {
  if (_initialized) return
  _initialized = true
  let endpoint
  try {
    const r = await fetch('/api/settings', { credentials: 'include' })
    if (r.ok) {
      const s = await r.json()
      endpoint = s.otel_frontend_endpoint
    }
  } catch { /* settings fetch failed, skip otel */ }

  if (!endpoint) return

  try {
    const [
      { WebTracerProvider, BatchSpanProcessor },
      { registerInstrumentations },
      { FetchInstrumentation },
      { DocumentLoadInstrumentation },
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { ATTR_SERVICE_NAME },
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/instrumentation'),
      import('@opentelemetry/instrumentation-fetch'),
      import('@opentelemetry/instrumentation-document-load'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
    ])

    const provider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'doit-web',
      }),
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({
        url: '/api/otlp/v1/traces',
      }))],
    })

    provider.register()

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({ propagateTraceHeaderCorsUrls: [/.*/] }),
        new DocumentLoadInstrumentation(),
      ],
      tracerProvider: provider,
    })

    console.log('[otel] tracing enabled ->', endpoint)
  } catch (e) {
    console.warn('[otel] failed to init:', e)
  }
}
