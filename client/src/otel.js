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
      { FetchInstrumentation },
      { DocumentLoadInstrumentation },
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { ATTR_SERVICE_NAME },
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
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
    })

    provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    })))

    provider.register()

    new FetchInstrumentation({ propagateTraceHeaderCorsUrls: [/.*/] }).enable()
    new DocumentLoadInstrumentation().enable()

    console.log('[otel] tracing enabled ->', endpoint)
  } catch (e) {
    console.warn('[otel] failed to init:', e)
  }
}
