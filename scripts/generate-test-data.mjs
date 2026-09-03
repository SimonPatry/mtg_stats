import { writeFileSync } from 'fs'

const users = [
  { id: '3efb27ec-2d86-457f-8d9a-279d8c7505a5', name: 'Simon', active: true },
  { id: 'f4e68ba1-38c0-4334-8fa0-40eb9711ed84', name: 'Alex', active: true },
  { id: '7f841418-074f-42b6-9efe-4a000da56771', name: 'Jordan', active: true },
  { id: '0b4be267-7c20-46ae-9aed-28e594a61f38', name: 'Sam', active: true },
  { id: '9ed93096-9525-4b5c-8ced-ab31d2d88b16', name: 'Test', active: true },
]

const uid = {
  simon: '3efb27ec-2d86-457f-8d9a-279d8c7505a5',
  alex: 'f4e68ba1-38c0-4334-8fa0-40eb9711ed84',
  jordan: '7f841418-074f-42b6-9efe-4a000da56771',
  sam: '0b4be267-7c20-46ae-9aed-28e594a61f38',
  test: '9ed93096-9525-4b5c-8ced-ab31d2d88b16',
}

function deck(id, userId, com, bracket, variation, opts = {}) {
  const createdAt =
    opts.createdAt ?? opts.history?.[0]?.date ?? '2025-09-01'
  return {
    id,
    userId,
    com,
    bracket,
    bracketVariation: variation ?? null,
    deckUrl: opts.deckUrl ?? `https://moxfield.com/decks/${id.slice(0, 8)}`,
    active: opts.active !== false,
    createdAt,
    ...(opts.previousDeckId ? { previousDeckId: opts.previousDeckId } : {}),
    ...(opts.history ? { history: opts.history } : {}),
    ...(opts.comPrint ? { comPrint: opts.comPrint } : {}),
  }
}

function historyEntry(date, prev, next, cause, bracket, variation) {
  return {
    date,
    previousValue: prev,
    newValue: next,
    cause,
    bracket,
    bracketVariation: variation ?? null,
  }
}

// --- Deck IDs (stable) ---
const IDS = {
  atraxa_v1: 'd1000001-0000-4000-8000-000000000001',
  atraxa_v2: 'd1000001-0000-4000-8000-000000000002',
  atraxa_v3: 'd1000001-0000-4000-8000-000000000003',
  atraxa_v4: '1713151f-ff98-4931-bd74-50f54d324378',
  kinnan: '8f2e3f9c-9b06-4320-a774-20364c491391',
  simon_krenko: '5db15ea8-c9fb-453a-ba8e-2a8a20802430',
  chulane: 'd1000001-0000-4000-8000-000000000010',
  tatyova: 'd1000001-0000-4000-8000-000000000011',

  naj_v1: 'cb454f0a-4b75-45e9-a680-76977cfc8edd',
  naj_v2: 'd1000002-0000-4000-8000-000000000002',
  naj_v3: 'd1000002-0000-4000-8000-000000000003',
  naj_v4: '85856abe-fad1-4dbe-abc1-baa4e8df7f24',

  krenko_v1: 'a60497bf-9793-4627-a17f-411f8fe95125',
  krenko_v2: 'd1000003-0000-4000-8000-000000000002',
  krenko_v3: 'd1000003-0000-4000-8000-000000000003',
  krenko_v4: '877c74bb-96a4-444d-a09a-9f8ed5bf2dc4',
  yuriko: 'd1000002-0000-4000-8000-000000000010',
  kenrith: 'd1000002-0000-4000-8000-000000000011',

  mul_v1: 'd1000004-0000-4000-8000-000000000001',
  mul_v2: 'd1000004-0000-4000-8000-000000000002',
  mul_v3: 'd1000004-0000-4000-8000-000000000003',
  mul_v4: 'e141beb8-676d-4d75-90f2-dfcef6264512',
  aesi: 'd1000004-0000-4000-8000-000000000010',
  wilhelt: 'd1000004-0000-4000-8000-000000000011',
  teysa: 'd1000004-0000-4000-8000-000000000012',

  kor_v1: 'd1000005-0000-4000-8000-000000000001',
  kor_v2: 'd1000005-0000-4000-8000-000000000002',
  kor_v3: 'd1000005-0000-4000-8000-000000000003',
  kor_v4: '194fdee1-912b-418c-a9fb-6b0c13b645b2',
  edgar: 'd1000005-0000-4000-8000-000000000010',
  gitrog: 'd1000005-0000-4000-8000-000000000011',
  prosper: 'd1000005-0000-4000-8000-000000000012',

  test_1: 'd1000006-0000-4000-8000-000000000001',
  test_2: 'd1000006-0000-4000-8000-000000000002',
  test_3: 'd1000006-0000-4000-8000-000000000003',
  test_4: 'd1000006-0000-4000-8000-000000000004',
}

const decks = [
  // Simon — Atraxa 4 versions
  deck(IDS.atraxa_v1, uid.simon, "Atraxa, Praetors' Voice", 2, null, {
    active: false,
    deckUrl: 'https://moxfield.com/decks/atrx-v1',
    createdAt: '2026-01-01',
  }),
  deck(IDS.atraxa_v2, uid.simon, "Atraxa, Praetors' Voice", 3, null, {
    active: false,
    previousDeckId: IDS.atraxa_v1,
    history: [
      historyEntry('2026-02-01', 'B2', 'B3', 'newVersion', 2, null),
    ],
  }),
  deck(IDS.atraxa_v3, uid.simon, "Atraxa, Praetors' Voice", 3, 'low', {
    active: false,
    previousDeckId: IDS.atraxa_v2,
    history: [
      historyEntry('2026-03-15', 'B3', 'B3 - low', 'levelAdjustment', 3, null),
    ],
  }),
  deck(IDS.atraxa_v4, uid.simon, "Atraxa, Praetors' Voice", 3, 'high', {
    previousDeckId: IDS.atraxa_v3,
    history: [
      historyEntry('2026-05-01', 'B3 - low', 'B3 - high', 'newVersion', 3, 'high'),
    ],
  }),
  deck(IDS.kinnan, uid.simon, 'Kinnan, Bonder Prodigy', 4, 'high'),
  deck(IDS.simon_krenko, uid.simon, 'Krenko, Mob Boss', 2, 'low', {
    deckUrl: '',
    comPrint: {
      'Krenko, Mob Boss': {
        scryfallId: '45b2ec40-cb5f-476f-9c23-2c89eb8ff8c1',
        set: 'SLD',
        collectorNumber: '2407',
        setName: 'Secret Lair Drop',
        imageUrl:
          'https://cards.scryfall.io/large/front/4/5/45b2ec40-cb5f-476f-9c23-2c89eb8ff8c1.jpg?1783903430',
      },
    },
  }),
  deck(IDS.chulane, uid.simon, 'Chulane, Teller of Tales', 3, null),
  deck(IDS.tatyova, uid.simon, 'Tatyova, Benthic Druid', 2, 'high'),

  // Alex — Najeela 4 versions
  deck(IDS.naj_v1, uid.alex, 'Najeela, the Blade-Blossom', 3, 'high', {
    active: false,
    history: [
      historyEntry('2026-01-20', 'B4', 'B3 - high', 'levelAdjustment', 4, null),
    ],
  }),
  deck(IDS.naj_v2, uid.alex, 'Najeela, the Blade-Blossom', 3, null, {
    active: false,
    previousDeckId: IDS.naj_v1,
    history: [
      historyEntry('2026-03-01', 'B3 - high', 'B3', 'newVersion', 3, 'high'),
    ],
  }),
  deck(IDS.naj_v3, uid.alex, 'Najeela, the Blade-Blossom', 4, null, {
    active: false,
    previousDeckId: IDS.naj_v2,
    history: [
      historyEntry('2026-04-20', 'B3', 'B4', 'levelAdjustment', 3, null),
    ],
  }),
  deck(IDS.naj_v4, uid.alex, 'Najeela, the Blade-Blossom', 4, 'high', {
    previousDeckId: IDS.naj_v3,
    history: [
      historyEntry('2026-06-10', 'B4', 'B4 - high', 'newVersion', 4, null),
    ],
  }),

  // Alex — Krenko 4 versions
  deck(IDS.krenko_v1, uid.alex, 'Krenko, Mob Boss', 3, null, {
    active: false,
    createdAt: '2025-12-01',
  }),
  deck(IDS.krenko_v2, uid.alex, 'Krenko, Mob Boss', 3, 'high', {
    active: false,
    previousDeckId: IDS.krenko_v1,
    history: [
      historyEntry('2026-02-10', 'B3', 'B3 - high', 'levelAdjustment', 3, null),
    ],
  }),
  deck(IDS.krenko_v3, uid.alex, 'Krenko, Mob Boss', 4, null, {
    active: false,
    previousDeckId: IDS.krenko_v2,
    history: [
      historyEntry('2026-04-05', 'B3 - high', 'B4', 'newVersion', 3, 'high'),
    ],
  }),
  deck(IDS.krenko_v4, uid.alex, 'Krenko, Mob Boss', 4, 'high', {
    previousDeckId: IDS.krenko_v3,
  }),
  deck(IDS.yuriko, uid.alex, 'Yuriko, the Tiger\'s Shadow', 4, 'high'),
  deck(IDS.kenrith, uid.alex, 'Kenrith, the Returned King', 2, null),

  // Jordan — Muldrotha 4 versions
  deck(IDS.mul_v1, uid.jordan, 'Muldrotha, the Gravetide', 2, 'low', {
    active: false,
    deckUrl: 'https://archidekt.com/decks/mul-v1',
    createdAt: '2026-01-10',
  }),
  deck(IDS.mul_v2, uid.jordan, 'Muldrotha, the Gravetide', 3, 'low', {
    active: false,
    previousDeckId: IDS.mul_v1,
    history: [
      historyEntry('2026-02-25', 'B2 - low', 'B3 - low', 'newVersion', 2, 'low'),
    ],
  }),
  deck(IDS.mul_v3, uid.jordan, 'Muldrotha, the Gravetide', 3, null, {
    active: false,
    previousDeckId: IDS.mul_v2,
    history: [
      historyEntry('2026-04-12', 'B3 - low', 'B3', 'levelAdjustment', 3, 'low'),
    ],
  }),
  deck(IDS.mul_v4, uid.jordan, 'Muldrotha, the Gravetide', 3, null, {
    previousDeckId: IDS.mul_v3,
    history: [
      historyEntry('2026-06-01', 'B3 - low', 'B3', 'levelAdjustment', 3, 'low'),
    ],
  }),
  deck(IDS.aesi, uid.jordan, 'Aesi, Tyrant of Tyre\'s Strait', 3, 'high'),
  deck(IDS.wilhelt, uid.jordan, 'Wilhelt, the Rotcleaver', 3, null),
  deck(IDS.teysa, uid.jordan, 'Teysa, Orzhov Scion', 4, null),

  // Sam — Korvold 4 versions
  deck(IDS.kor_v1, uid.sam, 'Korvold, Fae-Cursed King', 2, null, {
    active: false,
    createdAt: '2025-10-15',
  }),
  deck(IDS.kor_v2, uid.sam, 'Korvold, Fae-Cursed King', 3, 'low', {
    active: false,
    previousDeckId: IDS.kor_v1,
    history: [
      historyEntry('2026-03-05', 'B2', 'B3 - low', 'newVersion', 2, null),
    ],
  }),
  deck(IDS.kor_v3, uid.sam, 'Korvold, Fae-Cursed King', 3, null, {
    active: false,
    previousDeckId: IDS.kor_v2,
    history: [
      historyEntry('2026-05-20', 'B3 - low', 'B3', 'levelAdjustment', 3, 'low'),
    ],
  }),
  deck(IDS.kor_v4, uid.sam, 'Korvold, Fae-Cursed King', 3, null, {
    previousDeckId: IDS.kor_v3,
  }),
  deck(IDS.edgar, uid.sam, 'Edgar Markov', 4, 'high'),
  deck(IDS.gitrog, uid.sam, 'The Gitrog Monster', 3, 'high'),
  deck(IDS.prosper, uid.sam, 'Prosper, Tome-Bound', 3, null),

  // Test — 4 decks simples
  deck(IDS.test_1, uid.test, 'Jodah, the Unifier', 4, null),
  deck(IDS.test_2, uid.test, 'Esika, God of the Tree', 3, 'high'),
  deck(IDS.test_3, uid.test, 'Sythis, Harvest\'s Hand', 2, null),
  deck(IDS.test_4, uid.test, 'Tivit, Seller of Secrets', 4, 'low'),
]

const deckById = Object.fromEntries(decks.map((d) => [d.id, d]))
const userById = Object.fromEntries(users.map((u) => [u.id, u]))

function comList(com) {
  return Array.isArray(com) ? com : [com]
}

function slotFromDeckId(deckId, seatOrder, result) {
  const d = deckById[deckId]
  const player = userById[d.userId].name
  return {
    commanders: comList(d.com),
    player,
    bracket: d.bracket,
    bracketVariation: d.bracketVariation,
    seatOrder,
    result,
    deckId,
  }
}

// Remove unused versionGames and fillerPool - kept gameDates below

const gameDates = [
  '2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29', '2026-02-05',
  '2026-02-12', '2026-02-19', '2026-02-26', '2026-03-05', '2026-03-12',
  '2026-03-19', '2026-03-26', '2026-04-02', '2026-04-09', '2026-04-16',
  '2026-04-23', '2026-04-30', '2026-05-07', '2026-05-14', '2026-05-21',
  '2026-05-28', '2026-06-04', '2026-06-11', '2026-06-18', '2026-06-25',
  '2026-07-02', '2026-07-09', '2026-07-16', '2026-07-23', '2026-07-30',
  '2026-08-06', '2026-08-13', '2026-08-20', '2026-08-27', '2026-08-30',
  '2026-08-31', '2026-08-31', '2026-08-31', '2026-08-31', '2026-08-31',
]

const notes = [
  'Partie serrée, politique agressive au milieu de table.',
  'Combo line fermée T7, peu de wipes.',
  'Board wipe T5 qui change tout.',
  'Victoire combat, pas de combo ce soir.',
  'Salt léger sur le stack T6.',
  'Partie rapide, aggro early.',
  'Grind long, beaucoup de removal.',
  'Counter war sur la fin de partie.',
  'Tutor chain impressionnante.',
  'Mana screw pour le seat 3.',
]

// Version windows: 5 games per version (indices 0–19), then block B for Krenko Alex
function versionIndex(gameIndex) {
  if (gameIndex < 5) return 0
  if (gameIndex < 10) return 1
  if (gameIndex < 15) return 2
  return 3
}

function blockBVersionIndex(b) {
  if (b < 4) return 0
  if (b < 8) return 1
  if (b < 12) return 2
  return 3
}

const atraxaChain = [IDS.atraxa_v1, IDS.atraxa_v2, IDS.atraxa_v3, IDS.atraxa_v4]
const najChain = [IDS.naj_v1, IDS.naj_v2, IDS.naj_v3, IDS.naj_v4]
const krenkoChain = [IDS.krenko_v1, IDS.krenko_v2, IDS.krenko_v3, IDS.krenko_v4]
const mulChain = [IDS.mul_v1, IDS.mul_v2, IDS.mul_v3, IDS.mul_v4]
const korChain = [IDS.kor_v1, IDS.kor_v2, IDS.kor_v3, IDS.kor_v4]

const simonBlockB = [IDS.atraxa_v4, IDS.kinnan, IDS.chulane, IDS.tatyova, IDS.simon_krenko]
const jordanBlockB = [IDS.mul_v4, IDS.aesi, IDS.wilhelt, IDS.teysa]
const samBlockB = [IDS.kor_v4, IDS.edgar, IDS.gitrog, IDS.prosper]

const games = []

for (let i = 0; i < 40; i += 1) {
  let slotDeckIds

  if (i < 20) {
    const vi = versionIndex(i)
    slotDeckIds = [
      atraxaChain[vi],
      najChain[vi],
      mulChain[vi],
      korChain[vi],
    ]
  } else if (i >= 36) {
    slotDeckIds = [IDS.test_1, IDS.test_2, IDS.test_3, IDS.test_4]
  } else {
    const b = i - 20
    const vi = blockBVersionIndex(b)
    slotDeckIds = [
      simonBlockB[b % simonBlockB.length],
      krenkoChain[vi],
      jordanBlockB[b % jordanBlockB.length],
      samBlockB[b % samBlockB.length],
    ]
  }

  const winnerIdx = i % 4
  const lastIdx = (winnerIdx + 1 + (i % 3)) % 4
  const bracket = 2 + (i % 3)
  const variations = [null, 'low', 'high', null]
  const bracketVariation = variations[i % variations.length]
  const decks = slotDeckIds.map((deckId, seatIdx) =>
    slotFromDeckId(deckId, seatIdx + 1, seatIdx === winnerIdx ? 'win' : 'loss'),
  )

  games.push({
    id: `game-${String(i + 1).padStart(3, '0')}`,
    date: gameDates[i],
    turns: 6 + (i % 8),
    bracket,
    bracketVariation,
    boardWipes: i % 5 === 0 ? 2 : i % 3,
    winnerProtectedVictory: i % 4 === 0,
    lastPlayer: decks[lastIdx].player,
    notes: notes[i % notes.length],
    decks,
  })
}

// Verify version game counts
const versionDeckIds = new Set([
  ...atraxaChain,
  ...najChain,
  ...krenkoChain,
  ...mulChain,
  ...korChain,
])
const counts = {}
for (const id of versionDeckIds) {
  counts[id] = {
    planned: 0,
    actual: 0,
    label: comList(deckById[id].com)[0],
    version: id,
  }
}
for (const g of games) {
  for (const s of g.decks) {
    if (counts[s.deckId]) counts[s.deckId].actual += 1
  }
}
// expected: v1-v3 = 5 each in block A (0-19), v4 = 5 in block A + extras in block B
for (let vi = 0; vi < 4; vi += 1) {
  for (const chain of [atraxaChain, najChain, mulChain, korChain]) {
    counts[chain[vi]].planned += 5
  }
  counts[krenkoChain[vi]].planned += 4
}

console.log('Version game counts:')
for (const [id, c] of Object.entries(counts)) {
  console.log(`  ${c.label.slice(0, 20)}… ${id.slice(0, 8)}: ${c.actual ?? 0}/${c.planned}`)
}

const decksPerPlayer = {}
for (const d of decks) {
  decksPerPlayer[d.userId] = (decksPerPlayer[d.userId] || 0) + 1
}
console.log('Decks per player:', Object.fromEntries(
  users.map((u) => [u.name, decksPerPlayer[u.id] || 0]),
))

writeFileSync(
  new URL('../src/data/users_test.json', import.meta.url),
  `${JSON.stringify(users, null, 2)}\n`,
)
writeFileSync(
  new URL('../src/data/decks_test.json', import.meta.url),
  `${JSON.stringify(decks, null, 2)}\n`,
)
writeFileSync(
  new URL('../src/data/games_test.json', import.meta.url),
  `${JSON.stringify(games, null, 2)}\n`,
)

console.log(`Wrote ${users.length} users, ${decks.length} decks and ${games.length} games (test).`)
