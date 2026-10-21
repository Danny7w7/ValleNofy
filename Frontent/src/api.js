export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function csrfToken() {
  const cookie = document.cookie.split('; ').find((item) => item.startsWith('csrftoken='))
  return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : ''
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 20000)

  try {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      const token = csrfToken()
      if (!token) throw new ApiError('No pudimos validar tu sesión. Permite las cookies de este sitio y vuelve a cargar la página.', 403)
      headers['X-CSRFToken'] = token
    }
    const response = await fetch(`/api/${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      signal: controller.signal,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
    let data
    try {
      data = await response.json()
    } catch {
      throw new ApiError('La parranda no responde por ahora. Inténtalo de nuevo en un momento.', response.status)
    }
    if (!response.ok) {
      throw new ApiError(data.error || 'No pudimos completar la solicitud. Inténtalo de nuevo.', response.status)
    }
    return data
  } catch (error) {
    if (signal?.aborted) throw error
    if (timedOut) throw new ApiError('La conexión está tardando más de la cuenta. Vuelve a intentarlo.')
    if (error instanceof ApiError) throw error
    throw new ApiError(navigator.onLine
      ? 'No pudimos conectar con ValleNofy. Inténtalo de nuevo en un momento.'
      : 'Parece que te quedaste sin conexión. Reconéctate para seguir la parranda.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export const api = {
  profile: (signal) => request('profile/', { signal }),
  songs: (query, artist, signal) => request('songs/search/?' + new URLSearchParams({ q: query, artist }), { signal }),
  preview: (songId, signal) => request(`songs/${encodeURIComponent(songId)}/preview/`, { signal }),
  onboard: (songs) => request('onboarding/', { method: 'POST', body: { songs } }),
  recommendations: (signal) => request('recommendations/', { signal }),
  react: (songId, reaction) => request(`reactions/${encodeURIComponent(songId)}/`, { method: 'PUT', body: { reaction } }),
  library: (signal) => request('library/', { signal }),
}
