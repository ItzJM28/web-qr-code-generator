import qrcode from "qrcode-generator"

// Encode text as UTF-8 so accents, emoji and non-Latin scripts scan correctly.
const lib = qrcode as unknown as {
  stringToBytes?: unknown
  stringToBytesFuncs?: Record<string, unknown>
}
try {
  if (lib.stringToBytesFuncs && lib.stringToBytesFuncs["UTF-8"]) {
    lib.stringToBytes = lib.stringToBytesFuncs["UTF-8"]
  }
} catch {
  /* keep library default */
}

export type QrType = "link" | "wifi" | "email" | "phone" | "sms"
export type Values = Record<string, string>
export type BuildResult =
  | { kind: "empty" }
  | { kind: "error"; errors: Record<string, string>; summary: string }
  | { kind: "ok"; payload: string }

const fail = (id: string, msg: string, summary: string): BuildResult => ({
  kind: "error",
  errors: { [id]: msg },
  summary,
})

const wifiEsc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1")
const phoneOk = (s: string) =>
  /^\+?[0-9\s().-]{3,25}$/.test(s) && s.replace(/\D/g, "").length >= 3
const digits = (s: string) => s.replace(/[^\d+]/g, "")

export function buildPayload(type: QrType, vals: Values): BuildResult {
  const raw = (id: string) => (vals[id] ?? "").toString()
  const v = (id: string) => raw(id).trim()

  switch (type) {
    case "link":
      return v("text") ? { kind: "ok", payload: v("text") } : { kind: "empty" }

    case "wifi": {
      if (!v("ssid")) return { kind: "empty" }
      const sec = vals.sec || "WPA"
      const pass = raw("pass")
      const summary = "Almost there. Fix the password to see your code."
      if (sec !== "nopass" && !pass)
        return fail("pass", 'Enter the Wi-Fi password, or choose "No password" above.', summary)
      if (sec === "WPA" && pass.length < 8)
        return fail("pass", "WPA passwords have at least 8 characters.", summary)
      return {
        kind: "ok",
        payload:
          `WIFI:T:${sec};S:${wifiEsc(raw("ssid"))};` +
          (sec === "nopass" ? "" : `P:${wifiEsc(pass)};`) +
          (vals.hidden ? "H:true;" : "") +
          ";",
      }
    }

    case "email": {
      if (!v("to")) return { kind: "empty" }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("to")))
        return fail(
          "to",
          "That email address looks incomplete. Use the form name@example.com.",
          "Check the email address to see your code."
        )
      const q: string[] = []
      if (v("subject")) q.push("subject=" + encodeURIComponent(v("subject")))
      if (v("body")) q.push("body=" + encodeURIComponent(v("body")))
      return { kind: "ok", payload: "mailto:" + v("to") + (q.length ? "?" + q.join("&") : "") }
    }

    case "phone":
      if (!v("tel")) return { kind: "empty" }
      if (!phoneOk(v("tel")))
        return fail("tel", "Use digits only, with an optional + at the start.", "Check the phone number to see your code.")
      return { kind: "ok", payload: "tel:" + digits(v("tel")) }

    case "sms":
      if (!v("num")) return { kind: "empty" }
      if (!phoneOk(v("num")))
        return fail("num", "Use digits only, with an optional + at the start.", "Check the phone number to see your code.")
      return { kind: "ok", payload: "SMSTO:" + digits(v("num")) + ":" + v("msg") }
  }
}

/** Throws if the payload is too long for a single QR code. */
export function makeMatrix(payload: string): boolean[][] {
  const qr = qrcode(0, "M")
  qr.addData(payload, "Byte")
  qr.make()
  const n = qr.getModuleCount()
  const rows: boolean[][] = []
  for (let r = 0; r < n; r++) {
    const row: boolean[] = []
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c))
    rows.push(row)
  }
  return rows
}

const QUIET = 4

export function toSvg(m: boolean[][], fg: string, bg: string): string {
  const n = m.length
  const t = n + QUIET * 2
  let d = ""
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${t * 10}" height="${t * 10}" shape-rendering="crispEdges">` +
    `<rect width="${t}" height="${t}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`
  )
}

export function toCanvas(m: boolean[][], size: number, fg: string, bg: string): HTMLCanvasElement {
  const n = m.length
  const t = n + QUIET * 2
  const cell = size / t
  const cv = document.createElement("canvas")
  cv.width = cv.height = size
  const ctx = cv.getContext("2d")
  if (!ctx) throw new Error("no canvas")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = fg
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (m[r][c]) {
        const x0 = Math.round((c + QUIET) * cell)
        const x1 = Math.round((c + QUIET + 1) * cell)
        const y0 = Math.round((r + QUIET) * cell)
        const y1 = Math.round((r + QUIET + 1) * cell)
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      }
  return cv
}

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => {
    const x = parseInt(hex.substr(i, 2), 16) / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contrast(fg: string, bg: string) {
  const a = lum(fg)
  const b = lum(bg)
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), inverted: a > b }
}
