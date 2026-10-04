import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { variantsOf } from '../animations'
import { CardViewer } from '../card3d/CardViewer'
import { SafeCanvas } from '../SafeCanvas'
import { ANIM_KINDS, ANIM_LABEL, ANIM_NOTE } from '../cardConfig'
import { BUILTIN_BATTLE, BUILTIN_WEAPONS } from '../cards/catalog'
import {
  LEVEL_LABEL,
  QUALITIES,
  SHOT_MODES,
  STAT_LIMITS,
  WEAPON_MODELS,
  cardPower,
  patternLevelFor,
  qualityOf,
  shotSummary,
} from '../cards/model'
import type { BattleCard, CardDef, ShotMode, WeaponCard } from '../cards/model'
import { PATTERNS, patternById, patternsOfLevel } from '../cards/patterns'
import {
  deleteCard,
  isModified,
  newCardId,
  normalize,
  resetCard,
  saveCard,
  publishCard,
  publishState,
  unpublishCard,
  useCards,
  useGameCards,
} from '../cards/store'
import { BUILTIN_CARDS } from '../cards/catalog'
import {
  BODY_SLIDERS,
  CLOTHES_COLORS,
  EXTRAS,
  FACE_COLORS,
  FACE_SLIDERS,
  GUNS,
  HATS,
  HAT_SLIDERS,
  MUSTACHES,
  randomLook,
  randomName,
} from '../dollParams'
import type { DollLook, Extra, GunStyle, HatStyle, MustacheStyle, SliderDef } from '../dollParams'
import { TracePad } from '../battle/TracePad'
import { CardTile, PatternGlyph, QualityTable } from '../deck/CardTile'
import { FieldPreview } from './FieldPreview'
import { ShootingRange } from './ShootingRange'

// ---------------------------------------------------------------------------
// Mandos
// ---------------------------------------------------------------------------

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  display?: string
}) {
  return (
    <label className="block space-y-0.5">
      <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-200/75">
        {label}
        <span className="font-mono text-[11px] normal-case text-amber-100">
          {display ?? (Number.isInteger(step) ? value.toFixed(0) : value.toFixed(2))}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-full accent-amber-400"
      />
    </label>
  )
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-[11px] leading-tight ${
        active
          ? 'border-amber-300 bg-amber-300/20 text-amber-50'
          : 'border-amber-900/50 bg-black/30 text-amber-200/80 hover:border-amber-500/60'
      }`}
    >
      {children}
    </button>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="panel-wood space-y-2.5 p-3">
      <div>
        <p className="font-west text-base leading-none text-amber-100">{title}</p>
        {note && <p className="mt-1 text-[11px] leading-snug text-amber-200/60">{note}</p>}
      </div>
      {children}
    </section>
  )
}

const ACCENTS = ['#38bdf8', '#facc15', '#ef4444', '#f472b6', '#fb923c', '#a3e635', '#c084fc', '#e5e7eb', '#f59e0b', '#86efac', '#94a3b8', '#a78bfa', '#34d399', '#fde047', '#22d3ee', '#60a5fa']

function NameAndColor({ card, onChange }: { card: CardDef; onChange: (patch: Partial<CardDef>) => void }) {
  return (
    <Section title="Nombre y color">
      <input
        value={card.name}
        maxLength={16}
        onChange={(event) => onChange({ name: event.target.value })}
        className="w-full rounded-lg border border-amber-900/60 bg-black/40 px-2.5 py-1.5 font-west text-lg text-amber-50 outline-none focus:border-amber-400"
      />
      <div className="flex flex-wrap gap-1.5">
        {ACCENTS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ accent: color })}
            className={`h-6 w-6 rounded-full border-2 ${card.accent === color ? 'border-white' : 'border-black/40'}`}
            style={{ background: color }}
            aria-label={color}
          />
        ))}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Patron: se ve, se elige entre los de su dificultad y se practica
// ---------------------------------------------------------------------------

function PatternSection({
  card,
  takenBy,
  onChange,
}: {
  card: BattleCard
  takenBy: Map<string, string>
  onChange: (pattern: string) => void
}) {
  const power = cardPower(card)
  const level = patternLevelFor(power)
  const [practice, setPractice] = useState(0)
  const [result, setResult] = useState<number | null>(null)
  const pattern = patternById(card.pattern)
  const quality = result !== null ? qualityOf(result) : null

  return (
    <Section
      title="Patrón para sacarla"
      note="Cuanto más fuerte es la carta, más difícil es su patrón. Así ninguna carta está rota."
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
              style={{ width: `${Math.min(100, (power / 1.7) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-amber-200/80">
            Fuerza {power.toFixed(2)} · Dificultad <b className="text-amber-50">{LEVEL_LABEL[level]}</b>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {patternsOfLevel(level).map((item) => {
          const owner = takenBy.get(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center rounded-lg border p-1 ${
                card.pattern === item.id ? 'border-amber-300 bg-amber-300/15' : 'border-amber-900/50 bg-black/30'
              }`}
            >
              <PatternGlyph points={item.points} size={44} color={card.accent} />
              <span className="text-[10px] text-amber-100">{item.name}</span>
              {owner && <span className="text-[8px] leading-tight text-amber-200/50">también: {owner}</span>}
            </button>
          )
        })}
      </div>
      <div className="rounded-xl border border-amber-900/40 bg-black/20 p-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-amber-100">Practica el trazo: {pattern.name}</p>
          <button
            type="button"
            onClick={() => {
              setPractice((v) => v + 1)
              setResult(null)
            }}
            className="rounded-md border border-amber-900/60 bg-black/40 px-2 py-0.5 text-[10px] text-amber-200"
          >
            Otra vez
          </button>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <TracePad
            key={`${card.pattern}-${practice}`}
            points={pattern.points}
            color={card.accent}
            title={card.name}
            size={170}
            onDone={(accuracy) => setResult(accuracy)}
          />
          <div className="flex-1 space-y-1 text-[11px]">
            {quality ? (
              <>
                <p className="font-west text-2xl leading-none" style={{ color: quality.color }}>
                  {quality.label}
                </p>
                <p className="text-amber-200/70">Precisión {(result! * 100).toFixed(0)}%</p>
              </>
            ) : (
              <p className="text-amber-200/60">Dibuja encima de la guía, empezando por el punto blanco.</p>
            )}
            <div className="space-y-0.5 pt-1">
              {QUALITIES.map((q) => (
                <p key={q.id} className="flex justify-between gap-2 text-[10px]">
                  <span style={{ color: q.color }}>{q.label.replace(/[¡!]/g, '')}</span>
                  <span className="text-amber-200/60">desde {(q.min * 100).toFixed(0)}%</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Editor de carta de batalla
// ---------------------------------------------------------------------------

/** Deslizador con lo que significa cada punta, como en DER DAED ("Retaco" ↔ "Rascacielos"). */
function LookSlider({ def, value, onChange }: { def: SliderDef; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[12px] text-amber-100">
        {def.label}
        <em className="font-mono text-[11px] not-italic text-amber-300">{value.toFixed(2)}</em>
      </span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-full accent-amber-400"
      />
      <span className="flex justify-between text-[10px] text-amber-200/55">
        <span>{def.ends[0]}</span>
        <span>{def.ends[1]}</span>
      </span>
    </label>
  )
}

function ColorPick({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-amber-900/40 bg-black/25 px-2 py-1">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-11 cursor-pointer rounded border border-amber-900/60 bg-black/40"
      />
      <span className="text-[11px] text-amber-100">{label}</span>
    </label>
  )
}

type LookTab = 'cuerpo' | 'cara' | 'ropa' | 'combate' | 'animaciones'

const LOOK_TABS: { id: LookTab; label: string }[] = [
  { id: 'cuerpo', label: 'Cuerpo' },
  { id: 'cara', label: 'Cara' },
  { id: 'ropa', label: 'Ropa' },
  { id: 'combate', label: 'Combate' },
  { id: 'animaciones', label: 'Animaciones' },
]

function BattleEditor({
  card,
  onChange,
  onPreview,
  takenBy,
}: {
  card: BattleCard
  onChange: (next: BattleCard) => void
  onPreview: (motion: string) => void
  takenBy: Map<string, string>
}) {
  const [tab, setTab] = useState<LookTab>('cuerpo')
  const L = STAT_LIMITS
  const look = card.look
  const patch = (values: Partial<BattleCard>) => onChange({ ...card, ...values })
  const patchLook = (values: Partial<DollLook>) => onChange({ ...card, look: { ...look, ...values } })
  const toggleExtra = (extra: Extra) =>
    patchLook({ extras: look.extras.includes(extra) ? look.extras.filter((e) => e !== extra) : [...look.extras, extra] })
  const surprise = () => onChange({ ...card, name: randomName(), look: randomLook() })

  return (
    <div className="space-y-3">
      <NameAndColor card={card} onChange={(values) => patch(values as Partial<BattleCard>)} />

      <div className="panel-wood p-2">
        <div className="flex flex-wrap items-center gap-1">
          {LOOK_TABS.map((item) => (
            <Chip key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </Chip>
          ))}
          <button
            type="button"
            onClick={surprise}
            className="ml-auto rounded-lg border border-rose-300/60 bg-rose-500/20 px-2 py-1 text-[11px] text-rose-50"
            title="Un muñeco al azar (a veces con proporciones exageradas)"
          >
            🎲 Sorpréndeme
          </button>
        </div>
      </div>

      {tab === 'cuerpo' && (
        <Section title="Cuerpo">
          {BODY_SLIDERS.map((def) => (
            <LookSlider key={def.key} def={def} value={look[def.key]} onChange={(v) => patchLook({ [def.key]: v })} />
          ))}
        </Section>
      )}

      {tab === 'cara' && (
        <Section title="Cara">
          <div>
            <p className="mb-1 text-[12px] text-amber-100">Estilo de bigote</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(MUSTACHES) as MustacheStyle[]).map((id) => (
                <Chip key={id} active={look.mustacheStyle === id} onClick={() => patchLook({ mustacheStyle: id })}>
                  {MUSTACHES[id]}
                </Chip>
              ))}
            </div>
          </div>
          {FACE_SLIDERS.map((def) => (
            <LookSlider key={def.key} def={def} value={look[def.key]} onChange={(v) => patchLook({ [def.key]: v })} />
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            {FACE_COLORS.map((field) => (
              <ColorPick
                key={field.key}
                label={field.label}
                value={look[field.key]}
                onChange={(v) => patchLook({ [field.key]: v })}
              />
            ))}
          </div>
        </Section>
      )}

      {tab === 'ropa' && (
        <Section title="Ropa">
          <div>
            <p className="mb-1 text-[12px] text-amber-100">Sombrero</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(HATS) as HatStyle[]).map((id) => (
                <Chip key={id} active={look.hat === id} onClick={() => patchLook({ hat: id })}>
                  {HATS[id]}
                </Chip>
              ))}
            </div>
          </div>
          {HAT_SLIDERS.map((def) => (
            <LookSlider key={def.key} def={def} value={look[def.key]} onChange={(v) => patchLook({ [def.key]: v })} />
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            {CLOTHES_COLORS.map((field) => (
              <ColorPick
                key={field.key}
                label={field.label}
                value={look[field.key]}
                onChange={(v) => patchLook({ [field.key]: v })}
              />
            ))}
          </div>
          <div>
            <p className="mb-1 text-[12px] text-amber-100">Extras</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(EXTRAS) as Extra[]).map((id) => (
                <Chip key={id} active={look.extras.includes(id)} onClick={() => toggleExtra(id)}>
                  {EXTRAS[id]}
                </Chip>
              ))}
            </div>
          </div>
        </Section>
      )}

      {tab === 'combate' && (
        <>
          <Section title="Arma en la mano" note="Con ella dispara en el campo (la dinamita y la botella van por el aire).">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(GUNS) as GunStyle[]).map((id) => (
                <Chip key={id} active={look.weapon === id} onClick={() => patchLook({ weapon: id })}>
                  {GUNS[id]}
                </Chip>
              ))}
            </div>
          </Section>
          <Section
            title="Estadísticas"
            note="Son los números con calidad EXCELENTE. Si dibujas peor, sale con menos escudo y menos daño."
          >
            <Slider
              label="escudos (vida)"
              value={card.shields}
              min={L.shields.min}
              max={L.shields.max}
              step={1}
              onChange={(v) => patch({ shields: v })}
            />
            <Slider
              label="resistencia a los disparos"
              value={card.resistance}
              min={L.resistance.min}
              max={L.resistance.max}
              step={5}
              display={`${card.resistance}/100`}
              onChange={(v) => patch({ resistance: v })}
            />
            <Slider
              label="daño a la torre"
              value={card.damage}
              min={L.damage.min}
              max={L.damage.max}
              step={5}
              onChange={(v) => patch({ damage: v })}
            />
            <Slider
              label="dispara cada"
              value={card.fireMs}
              min={L.fireMs.min}
              max={L.fireMs.max}
              step={50}
              display={`${(card.fireMs / 1000).toFixed(2)} s`}
              onChange={(v) => patch({ fireMs: v })}
            />
            <Slider
              label="alcance"
              value={card.range}
              min={L.range.min}
              max={L.range.max}
              step={0.1}
              display={`${card.range.toFixed(1)} m`}
              onChange={(v) => patch({ range: v })}
            />
            <Slider
              label="velocidad al andar"
              value={card.speed}
              min={L.speed.min}
              max={L.speed.max}
              step={0.05}
              display={`×${card.speed.toFixed(2)}`}
              onChange={(v) => patch({ speed: v })}
            />
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wider text-amber-200/75">Según tu trazo sale así</p>
              <QualityTable card={card} />
            </div>
          </Section>
          <PatternSection card={card} takenBy={takenBy} onChange={(pattern) => patch({ pattern })} />
        </>
      )}

      {tab === 'animaciones' && (
        <Section title="Animaciones" note="Elige una de las 5 de cada tipo. Al tocarla se prueba en «En el campo».">
          {ANIM_KINDS.map((kind) => (
            <div key={kind} className="space-y-1 rounded-lg border border-amber-900/40 bg-black/20 p-2">
              <p className="text-[11px] uppercase tracking-wider text-amber-200/80">{ANIM_LABEL[kind]}</p>
              <p className="text-[10px] leading-tight text-amber-200/50">{ANIM_NOTE[kind]}</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {variantsOf(kind).map((variant) => {
                  const [num, flavor] = variant.name.split(' · ')
                  const chosen = card.anims[kind] === variant.id
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      title={variant.hint}
                      onClick={() => {
                        patch({ anims: { ...card.anims, [kind]: variant.id } })
                        onPreview(variant.id)
                      }}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1 text-left ${
                        chosen
                          ? 'border-amber-300 bg-amber-300/20 text-amber-50'
                          : 'border-amber-900/50 bg-black/30 text-amber-200/80 hover:border-amber-500/60'
                      }`}
                    >
                      <span className="font-mono text-[11px] text-amber-300/90">{num}</span>
                      <span className="text-[10px] leading-tight">{flavor}</span>
                      {chosen && <span className="ml-auto text-[10px]">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor de arma
// ---------------------------------------------------------------------------

function WeaponEditor({ card, onChange }: { card: WeaponCard; onChange: (next: WeaponCard) => void }) {
  const shot = card.shot
  const patchShot = (values: Partial<WeaponCard['shot']>) => onChange({ ...card, shot: { ...shot, ...values } })
  const setMode = (mode: ShotMode) => {
    const defaults: Record<ShotMode, Partial<WeaponCard['shot']>> = {
      bala: { pellets: 1, spread: 0, radius: 0 },
      perdigones: { pellets: Math.max(3, shot.pellets), spread: shot.spread || 34, radius: 0 },
      perforante: { pellets: 1, spread: 0, radius: 0 },
      explosivo: { pellets: 1, spread: 0, radius: shot.radius || 2.2 },
      rafaga: { pellets: Math.max(3, shot.pellets), spread: 0, radius: 0 },
    }
    patchShot({ mode, ...defaults[mode] })
  }
  return (
    <div className="space-y-3">
      <NameAndColor card={card} onChange={(values) => onChange({ ...card, ...(values as Partial<WeaponCard>) })} />
      <Section title="Modelo">
        <div className="flex flex-wrap gap-1">
          {WEAPON_MODELS.map((model) => (
            <Chip key={model.id} active={card.model === model.id} onClick={() => onChange({ ...card, model: model.id })}>
              {model.label}
            </Chip>
          ))}
        </div>
      </Section>
      <Section title="Disparo" note="Solo defiende: sus balas quitan escudos a las tropas rivales y se rompen al llegar al fuerte, sin dañarlo.">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {SHOT_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setMode(mode.id)}
              className={`rounded-lg border px-2 py-1.5 text-left ${
                shot.mode === mode.id ? 'border-sky-300 bg-sky-400/20' : 'border-amber-900/50 bg-black/30'
              }`}
            >
              <p className="text-[12px] text-amber-50">{mode.label}</p>
              <p className="text-[10px] leading-tight text-amber-200/60">{mode.note}</p>
            </button>
          ))}
        </div>
        <Slider label="alcance" value={shot.range} min={3} max={24} step={0.5} display={`${shot.range.toFixed(1)} m`} onChange={(v) => patchShot({ range: v })} />
        <Slider label="escudos por impacto" value={shot.shieldsPerHit} min={1} max={5} step={1} onChange={(v) => patchShot({ shieldsPerHit: v })} />
        <Slider label="velocidad de la bala" value={shot.speed} min={6} max={45} step={1} onChange={(v) => patchShot({ speed: v })} />
        {(shot.mode === 'perdigones' || shot.mode === 'rafaga') && (
          <Slider label={shot.mode === 'rafaga' ? 'balas de la ráfaga' : 'perdigones'} value={shot.pellets} min={2} max={9} step={1} onChange={(v) => patchShot({ pellets: v })} />
        )}
        {shot.mode === 'perdigones' && (
          <Slider label="apertura del cono" value={shot.spread} min={5} max={80} step={1} display={`${shot.spread.toFixed(0)}°`} onChange={(v) => patchShot({ spread: v })} />
        )}
        {shot.mode === 'explosivo' && (
          <Slider label="radio de la explosión" value={shot.radius} min={0.8} max={5} step={0.1} display={`${shot.radius.toFixed(1)} m`} onChange={(v) => patchShot({ radius: v })} />
        )}
        <p className="rounded-lg bg-black/30 px-2 py-1 text-[11px] text-amber-100">{shotSummary(shot)} · 2 usos</p>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------

type View = 'carta' | 'campo' | 'tiro'

function templateFor(kind: 'batalla' | 'arma'): CardDef {
  const base = kind === 'batalla' ? BUILTIN_BATTLE[0]! : BUILTIN_WEAPONS[0]!
  const copy = normalize(JSON.parse(JSON.stringify(base)) as CardDef)
  // Como en DER DAED: cada muñeco nuevo sale al azar (luego se retoca a gusto).
  if (copy.kind === 'batalla') {
    return { ...copy, id: newCardId(kind), name: randomName(), look: randomLook(), builtin: false }
  }
  return { ...copy, id: newCardId(kind), name: 'Nueva arma', builtin: false }
}

export function Creator({ onExit }: { onExit?: () => void }) {
  const cards = useCards()
  // Solo para enterarse de cuando cambian las cartas del juego.
  useGameCards()
  const [selectedId, setSelectedId] = useState(cards[0]!.id)
  const [draft, setDraft] = useState<CardDef>(() => cards[0]!)
  const [dirty, setDirty] = useState(false)
  const [view, setView] = useState<View>('carta')
  const [preview, setPreview] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  /** Alto real de la cabecera: la vista previa se pega justo debajo, tambien en movil. */
  const headerRef = useRef<HTMLElement>(null)
  const [headerH, setHeaderH] = useState(0)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const measure = () => setHeaderH(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(id)
  }, [flash])

  useEffect(() => {
    if (!preview) return
    const id = setTimeout(() => setPreview(null), 2600)
    return () => clearTimeout(id)
  }, [preview])

  const select = (card: CardDef) => {
    if (dirty && !window.confirm('Tienes cambios sin guardar en esta carta. ¿Descartarlos?')) return
    setSelectedId(card.id)
    setDraft(card)
    setDirty(false)
    setPreview(null)
    if (card.kind === 'arma' && view === 'campo') setView('tiro')
    if (card.kind === 'batalla' && view === 'tiro') setView('campo')
  }

  const change = (next: CardDef) => {
    let fixed = next
    // Si la fuerza cambia de escalon, el patron pasa a uno de su dificultad.
    if (fixed.kind === 'batalla') {
      const level = patternLevelFor(cardPower(fixed))
      if (patternById(fixed.pattern).level !== level) {
        const used = new Set(cards.filter((c) => c.kind === 'batalla' && c.id !== fixed.id).map((c) => (c as BattleCard).pattern))
        const options = patternsOfLevel(level)
        const pick = options.find((p) => !used.has(p.id)) ?? options[0] ?? PATTERNS[0]!
        fixed = { ...fixed, pattern: pick.id }
      }
    }
    setDraft(fixed)
    setDirty(true)
  }

  const save = () => {
    saveCard(draft)
    setDirty(false)
    setFlash('¡Guardada!')
  }

  const create = (kind: 'batalla' | 'arma') => {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return
    const card = templateFor(kind)
    saveCard(card)
    setSelectedId(card.id)
    setDraft(card)
    setDirty(false)
    setView(kind === 'batalla' ? 'carta' : 'carta')
  }

  const duplicate = () => {
    const copy = normalize({ ...(JSON.parse(JSON.stringify(draft)) as CardDef), id: newCardId(draft.kind), builtin: false })
    copy.name = `${draft.name}`.slice(0, 13) + ' II'
    saveCard(copy)
    setSelectedId(copy.id)
    setDraft(copy)
    setDirty(false)
  }

  const accept = () => {
    if (dirty) saveCard(draft)
    publishCard(draft)
    setDirty(false)
    setFlash('¡Aceptada! Ya está en el juego')
  }

  const withdraw = () => {
    if (!window.confirm(`¿Quitar «${draft.name}» del juego? Los jugadores dejarán de tenerla.`)) return
    const problem = unpublishCard(draft.id)
    setFlash(problem ?? 'Quitada del juego')
  }

  const remove = () => {
    if (!window.confirm(`¿Borrar «${draft.name}»? También se quita del juego. No se puede deshacer.`)) return
    const problem = deleteCard(draft.id)
    if (problem) {
      setFlash(problem)
      return
    }
    const first = cards.find((card) => card.id !== draft.id)!
    setSelectedId(first.id)
    setDraft(first)
    setDirty(false)
  }

  const reset = () => {
    resetCard(draft.id)
    const base = BUILTIN_CARDS.find((card) => card.id === draft.id)
    if (base) setDraft(base)
    setDirty(false)
  }

  const takenBy = useMemo(() => {
    const map = new Map<string, string>()
    for (const card of cards) {
      if (card.kind === 'batalla' && card.id !== draft.id) map.set(card.pattern, card.name)
    }
    return map
  }, [cards, draft.id])

  const battleCards = cards.filter((card) => card.kind === 'batalla')
  const weaponCards = cards.filter((card) => card.kind === 'arma')
  const views: { id: View; label: string }[] =
    draft.kind === 'batalla'
      ? [
          { id: 'carta', label: 'La carta 3D' },
          { id: 'campo', label: 'En el campo' },
        ]
      : [
          { id: 'carta', label: 'La carta 3D' },
          { id: 'tiro', label: 'Campo de tiro' },
        ]
  const state = publishState(draft)

  const list = (title: string, items: CardDef[], kind: 'batalla' | 'arma') => (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">{title}</p>
        <button type="button" onClick={() => create(kind)} className="rounded-md border border-amber-300/50 bg-amber-400/15 px-3 py-1.5 text-[11px] text-amber-50 active:scale-95">
          + Nueva
        </button>
      </div>
      {/* En movil la lista es un carrusel: no roba alto y la vista previa queda a la vista. */}
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {items.map((card) => {
          const shown = card.id === draft.id ? draft : card
          const badge = publishState(shown)
          return (
            <div key={card.id} className="relative w-[70px] shrink-0 lg:w-auto">
              <CardTile card={shown} selected={card.id === selectedId} onClick={() => select(card)} />
              <span
                className={`pointer-events-none absolute -right-1 -top-1 rounded-full px-1 text-[9px] font-bold ${
                  badge === 'igual' ? 'bg-emerald-500 text-white' : badge === 'cambios' ? 'bg-amber-400 text-amber-950' : 'bg-zinc-600 text-zinc-100'
                }`}
                title={badge === 'igual' ? 'En el juego' : badge === 'cambios' ? 'Cambios sin enviar al juego' : 'No está en el juego'}
              >
                {badge === 'igual' ? '✔' : badge === 'cambios' ? '✎' : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="min-h-[100dvh] w-full bg-[#0c0804] pb-16 text-amber-50">
      <header ref={headerRef} className="safe-top sticky top-0 z-30 border-b border-amber-900/40 bg-[#1b1108]/95 px-3 pb-2 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2">
          {onExit && (
            <button type="button" onClick={onExit} className="rounded-lg border border-amber-300/40 bg-black/40 px-3 py-2 text-[12px] text-amber-100 active:scale-95">
              ←
            </button>
          )}
          <h1 className="font-west text-base leading-none text-amber-100 sm:text-xl">Creador de cartas</h1>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {flash && <span className="rounded-lg bg-emerald-500/25 px-2 py-1 text-[12px] text-emerald-100">{flash}</span>}
            {dirty && <span className="text-[11px] text-amber-300">Sin guardar</span>}
            <button type="button" onClick={save} disabled={!dirty} className="btn-gold px-3 py-2 text-[12px]">
              Guardar
            </button>
            <button type="button" onClick={duplicate} className="rounded-lg border border-amber-900/60 bg-black/40 px-3 py-2 text-[11px] text-amber-200/85 active:scale-95">
              Duplicar
            </button>
            {draft.builtin ? (
              isModified(draft.id) && (
                <button type="button" onClick={reset} className="rounded-lg border border-amber-900/60 bg-black/40 px-3 py-2 text-[11px] text-amber-200/85 active:scale-95">
                  Restablecer
                </button>
              )
            ) : (
              <button type="button" onClick={remove} className="rounded-lg border border-rose-400/60 bg-rose-500/15 px-3 py-2 text-[11px] text-rose-100 active:scale-95">
                Borrar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* En movil es una columna flexible (en una rejilla de una columna el `sticky` no tiene
          recorrido y la vista previa se iria hacia arriba). En pantalla ancha, tres columnas. */}
      <main className="mx-auto flex max-w-[1500px] flex-col gap-4 px-3 pt-3 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_420px]">
        <aside className="space-y-4">
          {list('Muñecos de batalla', battleCards, 'batalla')}
          {list('Armas', weaponCards, 'arma')}
        </aside>

        {/* La vista previa se queda pegada bajo la cabecera: al bajar a los mandos sigues viendo
            como queda la carta. */}
        <section
          className="sticky z-20 space-y-2 bg-[#0c0804] pb-1 lg:top-16 lg:self-start"
          style={{ top: headerH }}
        >
          <div
            className={`flex flex-wrap items-center gap-2 rounded-xl border-2 p-2 ${
              state === 'igual' ? 'border-emerald-400/40 bg-emerald-900/20' : 'border-amber-300/60 bg-amber-900/25'
            }`}
          >
            {/* En movil el texto largo sobra: el estado ya se ve en la chapa de abajo. */}
            <p className="hidden flex-1 text-[12px] leading-snug text-amber-100 sm:block">
              {state === 'igual'
                ? 'Esta carta está en el juego tal y como la ves.'
                : state === 'cambios'
                  ? 'Has cambiado la carta: el juego sigue con la versión anterior hasta que la aceptes.'
                  : '¿Te gusta? Acéptala y se envía al juego: los jugadores la tendrán desbloqueada.'}
            </p>
            {state !== 'igual' && (
              <button type="button" onClick={accept} className="flex-1 rounded-lg border border-emerald-200/70 bg-gradient-to-b from-emerald-400 to-emerald-700 px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-emerald-950 sm:flex-none sm:py-1.5">
                ✔ {state === 'cambios' ? 'Aceptar cambios' : 'Acepto: al juego'}
              </button>
            )}
            {state !== 'fuera' && (
              <button type="button" onClick={withdraw} className="rounded-lg border border-rose-400/60 bg-rose-500/15 px-2.5 py-2 text-[11px] text-rose-100 sm:py-1.5">
                Quitar del juego
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {views.map((item) => (
              <Chip key={item.id} active={view === item.id} onClick={() => setView(item.id)}>
                {item.label}
              </Chip>
            ))}
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${
                state === 'igual'
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : state === 'cambios'
                    ? 'bg-amber-400/20 text-amber-100'
                    : 'bg-black/40 text-amber-200/70'
              }`}
            >
              {state === 'igual' ? '✔ En el juego' : state === 'cambios' ? '✎ Cambios sin enviar al juego' : 'No está en el juego'}
            </span>
          </div>
          <SafeCanvas note="La carta 3D no se puede ver en este dispositivo, pero puedes seguir editando.">
            {view === 'carta' && (
              <CardViewer card={draft} className="h-[26vh] min-h-[170px] rounded-2xl border border-amber-900/50 bg-[#24150a] lg:h-[46vh] lg:min-h-[340px]" />
            )}
            {view === 'campo' && draft.kind === 'batalla' && <FieldPreview card={draft} preview={preview} />}
            {view === 'tiro' && draft.kind === 'arma' && <ShootingRange key={JSON.stringify(draft.shot)} weapon={draft} />}
          </SafeCanvas>
        </section>

        <aside>
          {draft.kind === 'batalla' ? (
            <BattleEditor
              card={draft}
              onChange={change}
              takenBy={takenBy}
              onPreview={(motion) => {
                setView('campo')
                setPreview(motion)
              }}
            />
          ) : (
            <WeaponEditor card={draft} onChange={change} />
          )}
          <button type="button" onClick={save} disabled={!dirty} className="btn-gold mt-3 w-full">
            {dirty ? 'Guardar esta carta' : 'Guardada'}
          </button>
        </aside>
      </main>
    </div>
  )
}
