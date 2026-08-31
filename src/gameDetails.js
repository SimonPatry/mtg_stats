import { styleLabel, WIN_STYLES } from './tempGame'

const EVENT_KIND_ORDER = { wipe: 0, mana: 1, death: 2 }

export function formatWipeProtection(wipe) {
  const parts = []
  if (wipe.countered) {
    parts.push(wipe.counteredBy ? `Contré par ${wipe.counteredBy}` : 'Contré')
  }
  if (wipe.protected?.length) {
    parts.push(`Protégés : ${wipe.protected.join(', ')}`)
  }
  if (wipe.partiallyProtected?.length) {
    parts.push(`Partiellement protégés : ${wipe.partiallyProtected.join(', ')}`)
  }
  return parts.join(' · ')
}

export function buildGameEventNotes(game) {
  const lines = []
  for (const w of game.wipeEvents ?? []) {
    const countered = w.countered
      ? w.counteredBy
        ? ` — contré par ${w.counteredBy}`
        : ' — contré'
      : ''
    const prot = w.protected?.length ? ` — protégés: ${w.protected.join(', ')}` : ''
    const partial = w.partiallyProtected?.length
      ? ` — partiellement protégés: ${w.partiallyProtected.join(', ')}`
      : ''
    lines.push(`Wipe tour ${w.turn} — ${w.player}${countered}${prot}${partial}`)
  }
  for (const m of game.manaEvents ?? []) {
    const players = Object.keys(m.manaByPlayer ?? {})
    const mana = players.length
      ? players.map((p) => `${p} ${m.manaByPlayer[p] ?? '?'}`).join(', ')
      : Object.entries(m.manaByPlayer ?? {})
          .map(([p, v]) => `${p} ${v}`)
          .join(', ')
    lines.push(`Mana ${m.manaRule} — ${mana}`)
  }
  for (const d of game.deathEvents ?? []) {
    lines.push(
      `Mort tour ${d.turn}: ${d.victims.join(', ')} — tueur: ${d.killer ?? '?'} — ${styleLabel(d.killStyle)}`,
    )
  }
  return lines.join('\n')
}

export function composeGameNotes(userNotes, game) {
  const recap = buildGameEventNotes(game)
  const user = (userNotes ?? '').trim()
  if (!recap) return user
  if (!user) return recap
  if (recap.split('\n').every((line) => user.includes(line))) return user
  return `${recap}\n\n${user}`
}

export function gameHasLiveDetails(game) {
  return Boolean(
    game.wipeEvents?.length ||
      game.manaEvents?.length ||
      game.deathEvents?.length ||
      game.winStyle ||
      composeGameNotes(game.notes, game),
  )
}

export function buildGameTimeline(game) {
  const events = [
    ...(game.wipeEvents ?? []).map((data) => ({
      kind: 'wipe',
      turn: data.turn,
      data,
    })),
    ...(game.manaEvents ?? []).map((data) => ({
      kind: 'mana',
      turn: data.turn ?? (data.manaRule === 'T4' ? 4 : data.manaRule === 'T5' ? 5 : 0),
      data,
    })),
    ...(game.deathEvents ?? []).map((data) => ({
      kind: 'death',
      turn: data.turn,
      data,
    })),
  ]

  return events.sort(
    (a, b) =>
      a.turn - b.turn ||
      (EVENT_KIND_ORDER[a.kind] ?? 9) - (EVENT_KIND_ORDER[b.kind] ?? 9),
  )
}

export function manaEventsByRule(game) {
  const events = game.manaEvents ?? []
  return {
    t4: events.filter((e) => e.manaRule === 'T4'),
    t5: events.filter((e) => e.manaRule === 'T5'),
  }
}

export function winStyleLabel(id) {
  return styleLabel(id, WIN_STYLES)
}

export function formatManaByPlayer(manaByPlayer) {
  if (!manaByPlayer || typeof manaByPlayer !== 'object') return '—'
  return Object.entries(manaByPlayer)
    .map(([player, mana]) => `${player}: ${mana}`)
    .join(' · ')
}
