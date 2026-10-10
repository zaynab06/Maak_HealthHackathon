let csrf = "";

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api(path, options = {}) {
  const method = options.method || "GET";
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...(method !== "GET"
          ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
          : {}),
        ...options.headers,
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Please retry.",
      "server_unavailable",
      0,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "Could not read the server response. Please retry.",
      "server_unavailable",
      response.status,
    );
  }
  if (data.code === "csrf_failed" || data.code === "sign_in_required") {
    // Refresh session metadata, but never automatically repeat a mutation.
    try {
      const freshResponse = await fetch("/api/session", {
        credentials: "same-origin",
      });
      const fresh = await freshResponse.json();
      if (freshResponse.ok && fresh.csrf) csrf = fresh.csrf;
      if (freshResponse.ok && fresh.user === null)
        window.dispatchEvent(new Event("maak:session-expired"));
    } catch {
      /* Keep the original actionable error when connectivity fails. */
    }
    if (data.code === "sign_in_required")
      window.dispatchEvent(new Event("maak:session-expired"));
  }
  if (!response.ok)
    throw new ApiError(
      data.error || "The request could not be completed.",
      data.code || "request_failed",
      response.status,
    );
  if (data.csrf) csrf = data.csrf;
  return data;
}

export const post = (path, body = {}) => api(path, { method: "POST", body });
export const commandId = () => crypto.randomUUID();
