export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (err) {
    if (err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_UNSUPPORTED_RESOLVE')) {
      for (const ext of ['.ts', '.tsx']) {
        try { return await next(specifier + ext, context) } catch {}
        try { return await next(specifier + '/index' + ext, context) } catch {}
      }
    }
    throw err
  }
}
