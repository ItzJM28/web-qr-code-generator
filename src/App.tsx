import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { toast } from "sonner"
import {
  ChevronDown,
  CircleAlert,
  ClipboardPaste,
  Download,
  Link2,
  Mail,
  MessageSquare,
  Phone,
  QrCode,
  RotateCcw,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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

  return (
    <>
      <main className="mx-auto max-w-[960px] px-[max(1rem,env(safe-area-inset-left))] pt-6 md:pt-10">
        <header className="mb-6">
          <h1 className="mb-2 text-[1.6rem] font-bold leading-tight tracking-[-0.015em] md:text-[2rem]">
            Free QR Code Generator
          </h1>
          <p className="max-w-[60ch] text-muted-foreground">
            Pick what the code should do, fill in the details and download it. No sign-up, and nothing you type
            leaves your device.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10">
          <section aria-label="QR code details" className="min-w-0">
            <Tabs
              value={type}
              onValueChange={(v) => {
                setType(v as QrType)
                setShowPw(false)
              }}
            >
              <TabsList aria-label="QR code type">
                {TYPES.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>
                    <t.icon aria-hidden="true" />
                    {t.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TYPES.map((t) => (
                <TabsContent key={t.id} value={t.id}>
                  <form noValidate autoComplete="off" onSubmit={(e) => e.preventDefault()} className="mt-6 grid gap-4">
                    {t.fields.map(renderField)}
                  </form>
                </TabsContent>
              ))}
            </Tabs>

            <Collapsible className="mt-6 border-t pt-4">
              <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-md text-left font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                <span>
                  Size &amp; colors
                  <span className="block text-sm font-normal text-muted-foreground">
                    {style.size} px · {preset ? preset.n : "Custom colors"}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-soft group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-5 pt-3">
                <div className="grid gap-2">
                  <span id="lbl-size" className="text-[0.95rem] font-semibold">
                    PNG size
                  </span>
                  <RadioGroupPrimitive.Root
                    aria-labelledby="lbl-size"
                    value={String(style.size)}
                    onValueChange={(v) => updateStyle({ size: Number(v) })}
                    className="grid grid-cols-3 gap-1 rounded-[10px] bg-secondary p-1"
                  >
                    {SIZES.map((s) => (
                      <RadioGroupPrimitive.Item
                        key={s.v}
                        value={String(s.v)}
                        className="min-h-11 rounded-[7px] px-1 py-2 text-center text-sm font-semibold text-muted-foreground outline-none transition-[background-color,color] duration-150 ease-out-soft focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=checked]:bg-card data-[state=checked]:text-primary data-[state=checked]:shadow-[0_1px_3px_rgba(20,40,33,0.14)]"
                      >
                        {s.n}
                        <span className="block text-xs font-normal tabular-nums">{nf.format(s.v)} px</span>
                      </RadioGroupPrimitive.Item>
                    ))}
                  </RadioGroupPrimitive.Root>
                </div>

                <div className="grid gap-2">
                  <span className="text-[0.95rem] font-semibold">Colors</span>
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
                            "size-11 rounded-[10px] border-2 p-[5px] outline-none transition-[border-color,transform] duration-150 ease-out-soft active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-[3px] focus-visible:ring-ring/40",
                            on ? "border-primary" : "border-border"
                          )}
                        >
                          <span className="block size-full rounded-[4px]" style={{ background: p.f }} />
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-3 min-[401px]:grid-cols-2">
                    {(
                      [
                        ["fg", "Code"],
                        ["bg", "Background"],
                      ] as const
                    ).map(([k, name]) => (
                      <label
                        key={k}
                        className="flex min-h-13 min-w-0 cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] border-input bg-card px-2.5 py-2 focus-within:border-ring"
                      >
                        <input
                          type="color"
                          value={style[k]}
                          aria-label={`${name} color`}
                          onChange={(e) => updateStyle({ [k]: e.target.value } as Partial<Style>)}
                          className="size-[34px] shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0"
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
                    variant="chip"
                    size="sm"
                    onClick={() => {
                      setStyle({ ...DEFAULT_STYLE })
                      toast("Size and colors reset")
                    }}
                  >
                    <RotateCcw />
                    Reset size &amp; colors
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <section aria-label="Your QR code" className="min-w-0 md:sticky md:top-6">
            <Card>
              <CardContent>
                <div
                  className={cn(
                    "mx-auto grid aspect-square w-full max-w-[340px] place-items-center overflow-hidden rounded-[10px]",
                    qr ? "border bg-white" : "border border-dashed border-input bg-[#f0f3f1]"
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
                  className={cn("rounded-[10px] text-sm", warning && "mt-3 bg-warn-tint px-3 py-2.5 text-warn")}
                >
                  {warning}
                </p>

                {qr && (
                  <p className="mt-3 text-center text-sm tabular-nums text-muted-foreground">
                    {plural(qr.m.length, "module")} wide · PNG {nf.format(style.size)} × {nf.format(style.size)} px
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button type="button" size="lg" disabled={!qr || busy} onClick={downloadPng}>
                    <Download aria-hidden="true" />
                    {busy ? "Saving…" : "Download PNG"}
                  </Button>
                  <Button type="button" size="lg" variant="outline" disabled={!qr} onClick={downloadSvg}>
                    <Download aria-hidden="true" />
                    Download SVG
                  </Button>
                </div>
                <p className="mt-3 text-center text-[0.82rem] text-muted-foreground">
                  SVG stays sharp at any size, which is best for print. On a phone you can also press and hold the code
                  to save it.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <footer className="mt-10 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-center text-sm text-muted-foreground">
        Free to use. Nothing you type is stored.
      </footer>
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
    <div className={cn("grid justify-items-center gap-2 p-6 text-center text-[0.92rem]", isErr ? "text-destructive" : "text-muted-foreground")}>
      <Icon aria-hidden="true" className={cn("size-12", !isErr && "text-[#93a19b]")} strokeWidth={1.75} />
      <strong className={cn("text-base", isErr ? "text-destructive" : "text-foreground")}>{title}</strong>
      <span>{text}</span>
    </div>
  )
}
