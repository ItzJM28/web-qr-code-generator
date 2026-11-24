import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { toast } from "sonner"
import {
  CircleAlert,
  ClipboardPaste,
  Download,
  Link2,
  Mail,
  MessageSquare,
  Phone,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { buildPayload, contrast, makeMatrix, toCanvas, toSvg, type QrType, type Values } from "@/lib/qr"

type FieldKind = "area" | "text" | "email" | "tel" | "password" | "check" | "radio"
type FieldDef = {
  id: string
  label: string
  kind: FieldKind
  ph?: string
  max?: number
  opt?: boolean
  main?: boolean
  help?: string
  opts?: [string, string][]
  hideIf?: (v: Values) => boolean
}
type TypeDef = { id: QrType; name: string; icon: LucideIcon; empty: [string, string]; fields: FieldDef[] }

const TYPES: TypeDef[] = [
  {
    id: "link",
    name: "Link or text",
    icon: Link2,
    empty: ["Your QR code will appear here", "Type or paste a link or any text."],
    fields: [{ id: "text", label: "Link or text", kind: "area", max: 1000, ph: "https://example.com or any text", main: true }],
  },
  {
    id: "wifi",
    name: "Wi-Fi",
    icon: Wifi,
    empty: ["Add a network name to start", "Guests scan the code to join your Wi-Fi without typing the password."],
    fields: [
      { id: "ssid", label: "Network name", kind: "text", ph: "e.g. Cafe Guest", max: 32, main: true },
      {
        id: "sec",
        label: "Security",
        kind: "radio",
        opts: [
          ["WPA", "WPA / WPA2 / WPA3 (most common)"],
          ["WEP", "WEP"],
          ["nopass", "No password"],
        ],
      },
      { id: "pass", label: "Password", kind: "password", ph: "Wi-Fi password", max: 63, hideIf: (v) => v.sec === "nopass" },
      { id: "hidden", label: "This is a hidden network", kind: "check" },
    ],
  },
  {
    id: "email",
    name: "Email",
    icon: Mail,
    empty: ["Add an email address to start", "Scanning opens a new email with the subject and message filled in."],
    fields: [
      { id: "to", label: "Email address", kind: "email", ph: "hello@example.com", main: true },
      { id: "subject", label: "Subject", kind: "text", ph: "Question about my order", opt: true, max: 150 },
      { id: "body", label: "Message", kind: "area", ph: "Optional pre-written message", opt: true, max: 500 },
    ],
  },
  {
    id: "phone",
    name: "Phone",
    icon: Phone,
    empty: ["Add a phone number to start", "Scanning offers to call that number."],
    fields: [
      { id: "tel", label: "Phone number", kind: "tel", ph: "+1 555 010 0199", main: true, help: "Include the country code, such as +1, so it works anywhere." },
    ],
  },
  {
    id: "sms",
    name: "SMS",
    icon: MessageSquare,
    empty: ["Add a phone number to start", "Scanning opens a text message, with your wording ready to send."],
    fields: [
      { id: "num", label: "Phone number", kind: "tel", ph: "+1 555 010 0199", main: true },
      { id: "msg", label: "Message", kind: "area", ph: "Optional pre-written text", opt: true, max: 300 },
    ],
  },
]

const PRESETS = [
  { n: "Classic black on white", f: "#000000", b: "#ffffff" },
  { n: "Forest on white", f: "#0f4d3f", b: "#ffffff" },
  { n: "Navy on white", f: "#1b2a4a", b: "#ffffff" },
  { n: "Berry on white", f: "#7a1f4b", b: "#ffffff" },
  { n: "Ink on cream", f: "#222222", b: "#fdf6e3" },
]
const SIZES = [
  { n: "Small", v: 512 },
  { n: "Standard", v: 1024 },
  { n: "Print", v: 2048 },
]

// Same key as the single-file version, so saved size and colors carry over.
const KEY = "qrgen.redesign.v1"
const DEFAULT_STYLE = { size: 1024, fg: "#000000", bg: "#ffffff" }
type Style = typeof DEFAULT_STYLE
const HEX = /^#[0-9a-f]{6}$/i
const EMPTY_VALS: Values = { sec: "WPA" }

function loadStyle(): Style {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}")
    return {
      size: [512, 1024, 2048].includes(s.size) ? s.size : DEFAULT_STYLE.size,
      fg: HEX.test(s.fg || "") ? s.fg : DEFAULT_STYLE.fg,
      bg: HEX.test(s.bg || "") ? s.bg : DEFAULT_STYLE.bg,
    }
  } catch {
    return { ...DEFAULT_STYLE }
  }
}

const nf = new Intl.NumberFormat()
const plural = (n: number, w: string) => `${nf.format(n)} ${w}${n === 1 ? "" : "s"}`
const looksLikeBareDomain = (t: string) =>
  !!t && !/\s/.test(t) && !/^[a-z][a-z0-9+.-]*:/i.test(t) && /^(www\.)?[^\s/]+\.[a-z]{2,}(\/.*)?$/i.test(t)

type View =
  | { kind: "empty" }
  | { kind: "error"; errors: Record<string, string>; summary: string }
  | { kind: "toolong" }
  | { kind: "qr"; m: boolean[][]; svg: string }

export default function App() {
  const [type, setType] = useState<QrType>("link")
  const [vals, setVals] = useState<Values>(EMPTY_VALS)
  const [style, setStyle] = useState<Style>(loadStyle)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(style))
    } catch {
      /* private mode: ignore */
    }
  }, [style])

  const def = TYPES.find((t) => t.id === type) ?? TYPES[0]

  const view = useMemo<View>(() => {
    const r = buildPayload(type, vals)
    if (r.kind !== "ok") return r
    try {
      const m = makeMatrix(r.payload)
      return { kind: "qr", m, svg: toSvg(m, style.fg, style.bg) }
    } catch {
      return { kind: "toolong" }
    }
  }, [type, vals, style.fg, style.bg])

  const errors = view.kind === "error" ? view.errors : {}
  const qr = view.kind === "qr" ? view : null
  const dataUrl = qr ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qr.svg) : ""
  const cr = contrast(style.fg, style.bg)
  const warning = !qr
    ? ""
    : cr.inverted
      ? "Light code on a dark background may not scan on every phone. Test it before printing."
      : cr.ratio < 3
        ? "These colors are too close together and may not scan. Pick a darker code or a lighter background."
        : ""
  const preset = PRESETS.find(
    (p) => p.f.toLowerCase() === style.fg.toLowerCase() && p.b.toLowerCase() === style.bg.toLowerCase()
  )
  const hasInput = Object.entries(vals).some(([k, v]) => k !== "sec" && !!v)
  const showTip = type === "link" && looksLikeBareDomain((vals.text || "").trim())

  const setVal = (id: string, v: string) => setVals((prev) => ({ ...prev, [id]: v }))
  const updateStyle = (patch: Partial<Style>) => setStyle((s) => ({ ...s, ...patch }))
  const focusField = (id: string) => requestAnimationFrame(() => document.getElementById(`f-${id}`)?.focus())

  async function paste(f: FieldDef) {
    try {
      const t = await navigator.clipboard.readText()
      if (!t) {
        toast("Your clipboard is empty. Copy something first.")
        return
      }
      setVal(f.id, f.max ? t.slice(0, f.max) : t)
      focusField(f.id)
    } catch {
      toast("Paste was blocked. Press and hold in the box, then choose Paste.")
    }
  }

  function clearAll() {
    setVals(EMPTY_VALS)
    setShowPw(false)
    focusField(def.fields[0].id)
  }

  function saveBlob(blob: Blob, name: string) {
    try {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast(`Saved ${name}`)
    } catch {
      toast("Download was blocked. Press and hold the code to save it instead.")
    }
  }

  function downloadPng() {
    if (!qr) return
    setBusy(true)
    try {
      const cv = toCanvas(qr.m, style.size, style.fg, style.bg)
      if (!cv.toBlob) {
        setBusy(false)
        toast("This browser cannot make PNGs. Try the SVG download.")
        return
      }
      cv.toBlob((blob) => {
        setBusy(false)
        if (blob) saveBlob(blob, `qr-${type}.png`)
        else toast("Could not make the PNG. Try the SVG download.")
      }, "image/png")
    } catch {
      setBusy(false)
      toast("Could not make the PNG. Try a smaller size or the SVG download.")
    }
  }

  function downloadSvg() {
    if (!qr) return
    saveBlob(new Blob([qr.svg], { type: "image/svg+xml" }), `qr-${type}.svg`)
  }

  function renderField(f: FieldDef) {
    if (f.hideIf?.(vals)) return null
    const id = `f-${f.id}`
    const value = vals[f.id] ?? ""
    const err = errors[f.id]

    if (f.kind === "check") {
      return (
        <div key={f.id} className="flex min-h-11 items-center gap-3">
          <Checkbox id={id} checked={value === "1"} onCheckedChange={(c) => setVal(f.id, c === true ? "1" : "")} />
          <Label htmlFor={id} className="cursor-pointer font-medium">
            {f.label}
          </Label>
        </div>
      )
    }

    if (f.kind === "radio" && f.opts) {
      return (
        <div key={f.id} className="grid min-w-0 gap-1">
          <span id={`lbl-${f.id}`} className="text-[0.95rem] font-semibold">
            {f.label}
          </span>
          <RadioGroup
            aria-labelledby={`lbl-${f.id}`}
            value={value || f.opts[0][0]}
            onValueChange={(v) => setVal(f.id, v)}
            className="gap-0"
          >
            {f.opts.map(([v, l]) => (
              <div key={v} className="flex min-h-11 items-center gap-3">
                <RadioGroupItem value={v} id={`${id}-${v}`} />
                <Label htmlFor={`${id}-${v}`} className="cursor-pointer font-medium">
                  {l}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )
    }

    const describedBy = [f.help && `help-${f.id}`, err && `err-${f.id}`].filter(Boolean).join(" ") || undefined
    const shared = {
      id,
      value,
      placeholder: f.ph,
      maxLength: f.max,
      autoComplete: "off",
      autoCapitalize: "off",
      spellCheck: false,
      "aria-invalid": err ? true : undefined,
      "aria-describedby": describedBy,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(f.id, e.target.value),
    }
    const n = value.length

    return (
      <div key={f.id} className="grid min-w-0 gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id}>
            {f.label}
            {f.opt && <span className="text-sm font-normal text-muted-foreground"> (optional)</span>}
          </Label>
          {f.kind === "area" && f.max && (
            <span
              className={cn(
                "shrink-0 text-sm tabular-nums text-muted-foreground",
                n > f.max * 0.9 && "font-semibold text-warn"
              )}
            >
              {nf.format(n)} / {nf.format(f.max)}
            </span>
          )}
        </div>

        {f.kind === "area" ? (
          <Textarea rows={3} {...shared} />
        ) : f.kind === "password" ? (
          <div className="relative">
            <Input type={showPw ? "text" : "password"} enterKeyHint="done" className="pr-20" {...shared} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute inset-y-0.5 right-0.5 min-h-0 rounded-lg"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((s) => !s)}
            >
              {showPw ? "Hide" : "Show"}
            </Button>
          </div>
        ) : (
          <Input
            type={f.kind}
            inputMode={f.kind === "tel" ? "tel" : f.kind === "email" ? "email" : undefined}
            enterKeyHint="done"
            {...shared}
          />
        )}

        {f.help && (
          <p id={`help-${f.id}`} className="text-sm text-muted-foreground">
            {f.help}
          </p>
        )}
        {err && (
          <p id={`err-${f.id}`} className="text-sm font-semibold text-destructive">
            {err}
          </p>
        )}

        {f.main && (
          <div className="mt-1 flex flex-wrap gap-2">
            {canPaste && (
              <Button type="button" variant="chip" size="sm" onClick={() => paste(f)}>
                <ClipboardPaste />
                Paste
              </Button>
            )}
            <Button type="button" variant="chip" size="sm" disabled={!hasInput} onClick={clearAll}>
              <X />
              Clear all
            </Button>
          </div>
        )}

        {f.id === "text" && showTip && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-accent px-4 py-3 text-sm text-accent-foreground">
            <span className="min-w-0">This looks like a website. Add https:// so phones open it as a link.</span>
            <Button
              type="button"
              variant="chip"
              size="sm"
              onClick={() => setVal("text", "https://" + (vals.text || "").trim())}
            >
              Add https://
            </Button>
          </div>
        )}
      </div>
    )
  }

  const sizeLabel = SIZES.find((s) => s.v === style.size)?.n ?? "Custom"
  const order = (i: number) => ({ "--i": i }) as CSSProperties

  return (
    <>
      <main className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-12">
        <header className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2.1rem,8vw,4.75rem)] uppercase text-ink">
              QR code <br className="hidden min-[420px]:inline" />
              generator
            </h1>
            <p className="mt-3 max-w-[52ch] text-[0.98rem] font-medium text-ink md:text-lg">
              Pick what the code should do, fill in the details and download it. Free, no sign-up.
            </p>
          </div>
          <svg aria-hidden="true" viewBox="0 0 100 100" className="hidden size-24 shrink-0 text-white md:block lg:size-32">
            <g stroke="currentColor" strokeWidth="9">
              <line x1="50" y1="6" x2="50" y2="94" />
              <line x1="12" y1="28" x2="88" y2="72" />
              <line x1="12" y1="72" x2="88" y2="28" />
            </g>
          </svg>
        </header>

        <div className="rounded-[28px] bg-shell p-3 md:rounded-[36px] md:p-4">
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as QrType)
              setShowPw(false)
            }}
            className="bento"
          >
            <section aria-labelledby="h-type" className="tile tile-sky tile-blob area-types" style={order(0)}>
              <h2 id="h-type" className="font-display mb-4 text-2xl md:text-[1.75rem]">
                What should it do?
              </h2>
              <TabsList aria-label="QR code type">
                {TYPES.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-tint text-orange-ink transition-colors duration-150 group-data-[state=active]/tab:bg-orange group-data-[state=active]/tab:text-ink">
                      <t.icon aria-hidden="true" />
                    </span>
                    <span className="min-w-0 leading-tight">{t.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </section>

            <section aria-labelledby="h-details" className="tile tile-orange tile-blob area-form flex flex-col" style={order(1)}>
              <h2 id="h-details" className="font-display mb-4 text-[1.75rem] text-white md:text-[2rem]">
                Details
              </h2>
              <div className="inner-card">
                {TYPES.map((t) => (
                  <TabsContent key={t.id} value={t.id}>
                    <form noValidate autoComplete="off" onSubmit={(e) => e.preventDefault()} className="grid gap-4">
                      {t.fields.map(renderField)}
                    </form>
                  </TabsContent>
                ))}
              </div>
              <ol aria-label="How it works" className="mt-auto hidden gap-2 pt-6 md:grid">
                {["Pick a type", "Fill in the details", "Download PNG or SVG"].map((step, i) => (
                  <li
                    key={step}
                    className="flex min-h-11 items-center gap-3 rounded-full border-[1.5px] border-white/70 bg-orange-tint py-1.5 pr-4 pl-1.5 text-sm font-bold text-orange-ink"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-xs text-white tabular-nums">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="h-preview" className="tile tile-sky tile-blob area-preview flex flex-col" style={order(2)}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
                <h2 id="h-preview" className="font-display text-[1.75rem] md:text-[2rem]">
                  Your QR code
                </h2>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-ink">{def.name}</span>
              </div>
              <div className="inner-card grid flex-1 place-items-center content-center">
                <div
                  className={cn(
                    "grid aspect-square w-full max-w-[340px] place-items-center overflow-hidden rounded-[14px]",
                    qr ? "bg-white" : "border-2 border-dashed border-input bg-secondary"
                  )}
                >
                  {qr ? (
                    <img
                      src={dataUrl}
                      alt={`QR code for your ${def.name.toLowerCase()}`}
                      className="block size-full [image-rendering:pixelated]"
                    />
                  ) : (
                    <EmptyState view={view} def={def} />
                  )}
                </div>
                <p
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "w-full max-w-[340px] rounded-[10px] text-sm",
                    warning && "mt-3 bg-warn-tint px-3 py-2.5 font-medium text-warn"
                  )}
                >
                  {warning}
                </p>
              </div>
            </section>

            <section aria-labelledby="h-download" className="tile tile-orange tile-blob area-download" style={order(3)}>
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <h2 id="h-download" className="font-display text-[1.75rem] text-white md:text-[2rem]">
                    Download
                  </h2>
                  <p className="mt-2 text-sm font-semibold">
                    {qr ? `${plural(qr.m.length, "module")} wide` : "Fill in the details to unlock"}
                  </p>
                </div>
                <p className="text-right">
                  <span className="font-display block text-[clamp(2.5rem,6vw,3.5rem)] tabular-nums text-white">
                    {nf.format(style.size)}
                  </span>
                  <span className="text-sm font-semibold">px PNG · {sizeLabel}</span>
                </p>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                <Button type="button" size="lg" disabled={!qr || busy} onClick={downloadPng}>
                  <Download aria-hidden="true" />
                  {busy ? "Saving…" : "Download PNG"}
                </Button>
                <Button type="button" size="lg" variant="outline" disabled={!qr} onClick={downloadSvg}>
                  <Download aria-hidden="true" />
                  Download SVG
                </Button>
              </div>
              <p className="mt-3 text-sm font-medium">
                SVG stays sharp at any size, which is best for print. On a phone you can also press and hold the code
                to save it.
              </p>
            </section>

            <section aria-labelledby="h-options" className="tile tile-sky tile-blob area-options" style={order(4)}>
              <h2 id="h-options" className="font-display mb-1 text-[1.75rem] md:text-[2rem]">
                Size &amp; colors
              </h2>
              <p className="mb-4 text-sm font-semibold">
                {nf.format(style.size)} px · {preset ? preset.n : "Custom colors"}
              </p>
              <div className="grid gap-3">
                <div className="inner-card grid gap-2">
                  <span id="lbl-size" className="text-[0.95rem] font-bold">
                    PNG size
                  </span>
                  <RadioGroupPrimitive.Root
                    aria-labelledby="lbl-size"
                    value={String(style.size)}
                    onValueChange={(v) => updateStyle({ size: Number(v) })}
                    className="grid grid-cols-3 gap-1 rounded-[12px] bg-secondary p-1 min-[1100px]:grid-cols-1"
                  >
                    {SIZES.map((s) => (
                      <RadioGroupPrimitive.Item
                        key={s.v}
                        value={String(s.v)}
                        className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-[9px] px-1 py-2 text-center text-sm font-bold min-[1100px]:flex-row min-[1100px]:justify-between min-[1100px]:px-3 min-[1100px]:py-1 text-muted-foreground outline-none transition-[background-color,color] duration-150 ease-out-soft focus-visible:ring-[3px] focus-visible:ring-ring data-[state=checked]:bg-ink data-[state=checked]:text-white"
                      >
                        {s.n}
                        <span className="block text-xs font-medium tabular-nums">{nf.format(s.v)} px</span>
                      </RadioGroupPrimitive.Item>
                    ))}
                  </RadioGroupPrimitive.Root>
                </div>

                <div className="inner-card grid gap-2">
                  <span className="text-[0.95rem] font-bold">Colors</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => {
                      const on = preset?.n === p.n
                      return (
                        <button
                          key={p.n}
                          type="button"
                          title={p.n}
                          aria-label={p.n}
                          aria-pressed={on}
                          onClick={() => updateStyle({ fg: p.f, bg: p.b })}
                          style={{ background: p.b }}
                          className={cn(
                            "size-11 rounded-[12px] border-2 p-[5px] outline-none transition-[border-color,transform] duration-150 ease-out-soft active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2",
                            on ? "border-orange" : "border-border"
                          )}
                        >
                          <span className="block size-full rounded-[5px]" style={{ background: p.f }} />
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-2 min-[401px]:grid-cols-2 md:grid-cols-1 min-[1240px]:grid-cols-2">
                    {(
                      [
                        ["fg", "Code"],
                        ["bg", "Background"],
                      ] as const
                    ).map(([k, name]) => (
                      <label
                        key={k}
                        className="flex min-h-13 min-w-0 cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-input bg-card px-2.5 py-2 focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/25"
                      >
                        <input
                          type="color"
                          value={style[k]}
                          aria-label={`${name} color`}
                          onChange={(e) => updateStyle({ [k]: e.target.value } as Partial<Style>)}
                          className="size-[34px] shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0 outline-none"
                        />
                        <span className="min-w-0">
                          <b className="block text-sm">{name}</b>
                          <code className="text-xs text-muted-foreground">{style[k].toUpperCase()}</code>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setStyle({ ...DEFAULT_STYLE })
                      toast("Size and colors reset")
                    }}
                  >
                    <RotateCcw />
                    Reset size &amp; colors
                  </Button>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="h-privacy"
              className="tile tile-orange tile-blob area-privacy flex flex-col justify-between gap-4"
              style={order(5)}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="h-privacy" className="text-sm font-bold uppercase tracking-[0.08em]">
                  Private by design
                </h2>
                <span className="grid size-10 place-items-center rounded-xl bg-white text-orange-ink">
                  <ShieldCheck aria-hidden="true" className="size-5" />
                </span>
              </div>
              <p>
                <span className="font-display block text-[3.5rem] text-white">0</span>
                <span className="mt-1 block text-[0.95rem] font-semibold">
                  bytes sent anywhere. Nothing you type is stored: the code is made right in your browser.
                </span>
              </p>
            </section>
          </Tabs>
        </div>

        <footer className="mt-6 text-center text-sm font-medium text-ink">Free to use. Nothing you type is stored.</footer>
      </main>
      <Toaster />
    </>
  )
}

function EmptyState({ view, def }: { view: View; def: TypeDef }) {
  const isErr = view.kind === "error" || view.kind === "toolong"
  const [title, text] =
    view.kind === "error"
      ? ["Something needs fixing", view.summary]
      : view.kind === "toolong"
        ? ["Too much for one QR code", "Shorten your text a little. QR codes hold roughly 2,900 characters at most."]
        : def.empty
  const Icon = isErr ? CircleAlert : QrCode
  return (
    <div
      className={cn(
        "grid justify-items-center gap-2 p-6 text-center text-[0.92rem]",
        isErr ? "text-destructive" : "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "grid size-16 place-items-center rounded-2xl",
          isErr ? "bg-[#fde8e6]" : "bg-orange-tint text-orange-ink"
        )}
      >
        <Icon aria-hidden="true" className="size-9" strokeWidth={1.75} />
      </span>
      <strong className={cn("mt-1 text-base", isErr ? "text-destructive" : "text-ink")}>{title}</strong>
      <span>{text}</span>
    </div>
  )
}
